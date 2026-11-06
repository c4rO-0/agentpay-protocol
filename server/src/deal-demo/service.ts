import { createHash, randomUUID } from "node:crypto";

export type DealStatus = "Created" | "Ready" | "Funded" | "Released" | "Failed" | "Cancelled";

export interface BoundSignature {
  signer: string;
  signature: string;
  signedAt: string;
}

export interface DeliveryRecord {
  deliveryId: string;
  deliveredAt: string;
  payload: {
    outputHash: string;
    [key: string]: unknown;
  };
}

export interface DealRecord {
  dealId: string;
  serviceId: string | null;
  userSafe: string;
  mcpSafe: string;
  settlement: string;
  token: string;
  amount: string;
  baseAmount: string;
  unitPrice: string;
  usageUnits: string;
  authorizationMode: "signature" | "settlement_preauthorized";
  onchainDealId: string | null;
  userBinding: BoundSignature | null;
  mcpBinding: BoundSignature | null;
  fundedAmount: string;
  releasedAmount: string;
  status: DealStatus;
  delivery: DeliveryRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealCreateInput {
  dealId?: string;
  serviceId?: string | null;
  onchainDealId?: string;
  userSafe: string;
  mcpSafe: string;
  settlement: string;
  token: string;
  amount?: string;
  baseAmount?: string;
  unitPrice?: string;
  usageUnits?: string;
  userReportedUnits?: string;
  authorizationMode?: "signature" | "settlement_preauthorized";
}

export class DealDemoError extends Error {
  public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "POLICY_VIOLATION";

  constructor(code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT" | "POLICY_VIOLATION", message: string) {
    super(message);
    this.code = code;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

function requireAddressLike(name: string, value: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new DealDemoError("INVALID_INPUT", `${name} must be a 0x-prefixed address`);
  }
  return value;
}

function requireNonNegativeAmount(name: string, value: string): bigint {
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) throw new Error("negative");
    return parsed;
  } catch {
    throw new DealDemoError("INVALID_INPUT", `${name} must be a non-negative integer string`);
  }
}

function requirePositiveAmount(name: string, value: string): bigint {
  const parsed = requireNonNegativeAmount(name, value);
  if (parsed <= 0n) {
    throw new DealDemoError("INVALID_INPUT", `${name} must be a positive integer string`);
  }
  return parsed;
}

function stringify(value: bigint): string {
  return value.toString();
}

function computeAmount(input: DealCreateInput): {
  amount: bigint;
  baseAmount: bigint;
  unitPrice: bigint;
  usageUnits: bigint;
} {
  const baseAmount = requireNonNegativeAmount("baseAmount", input.baseAmount || "0");
  const unitPrice = requireNonNegativeAmount("unitPrice", input.unitPrice || input.amount || "0");
  const usageUnits = requireNonNegativeAmount("usageUnits", input.usageUnits || input.userReportedUnits || "1");
  const explicitAmount =
    input.amount == null || String(input.amount).trim() === ""
      ? null
      : requireNonNegativeAmount("amount", input.amount);
  const amount = explicitAmount ?? (baseAmount + unitPrice * usageUnits);
  if (amount <= 0n) {
    throw new DealDemoError("INVALID_INPUT", "computed amount must be positive");
  }
  return { amount, baseAmount, unitPrice, usageUnits };
}

export class DealDemoSettlementService {
  private readonly deals = new Map<string, DealRecord>();

  listDeals(): DealRecord[] {
    return Array.from(this.deals.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getDeal(dealId: string): DealRecord {
    const deal = this.deals.get(dealId);
    if (!deal) throw new DealDemoError("NOT_FOUND", "deal not found");
    return deal;
  }

  createDeal(input: DealCreateInput): DealRecord {
    const createdAt = nowIso();
    const dealId = input.dealId?.trim() || makeId("deal");
    if (this.deals.has(dealId)) {
      throw new DealDemoError("CONFLICT", "deal already exists");
    }
    const amount = computeAmount(input);
    const deal: DealRecord = {
      dealId,
      serviceId: input.serviceId?.trim() || null,
      onchainDealId: input.onchainDealId?.trim() || null,
      userSafe: requireAddressLike("userSafe", input.userSafe),
      mcpSafe: requireAddressLike("mcpSafe", input.mcpSafe),
      settlement: requireAddressLike("settlement", input.settlement),
      token: requireAddressLike("token", input.token),
      amount: stringify(amount.amount),
      baseAmount: stringify(amount.baseAmount),
      unitPrice: stringify(amount.unitPrice),
      usageUnits: stringify(amount.usageUnits),
      authorizationMode: input.authorizationMode === "settlement_preauthorized" ? "settlement_preauthorized" : "signature",
      userBinding: null,
      mcpBinding: null,
      fundedAmount: "0",
      releasedAmount: "0",
      status: "Created",
      delivery: null,
      createdAt,
      updatedAt: createdAt
    };
    this.deals.set(dealId, deal);
    return deal;
  }

  markReadyBySettlement(dealId: string): DealRecord {
    const deal = this.getDeal(dealId);
    if (deal.status !== "Created") throw new DealDemoError("CONFLICT", "deal is not ready-markable");
    deal.authorizationMode = "settlement_preauthorized";
    deal.status = "Ready";
    return this.touch(deal);
  }

  bindUser(dealId: string, signer: string, signature: string): DealRecord {
    const deal = this.getDeal(dealId);
    if (deal.status !== "Created") throw new DealDemoError("CONFLICT", "deal is not bindable");
    if (signer.toLowerCase() !== deal.userSafe.toLowerCase()) {
      throw new DealDemoError("POLICY_VIOLATION", "user signer must match userSafe");
    }
    if (!signature.trim()) throw new DealDemoError("INVALID_INPUT", "signature is required");
    deal.userBinding = { signer, signature, signedAt: nowIso() };
    this.autoReady(deal);
    return this.touch(deal);
  }

  bindMcp(dealId: string, signer: string, signature: string): DealRecord {
    const deal = this.getDeal(dealId);
    if (deal.status !== "Created") throw new DealDemoError("CONFLICT", "deal is not bindable");
    if (signer.toLowerCase() !== deal.mcpSafe.toLowerCase()) {
      throw new DealDemoError("POLICY_VIOLATION", "mcp signer must match mcpSafe");
    }
    if (!signature.trim()) throw new DealDemoError("INVALID_INPUT", "signature is required");
    deal.mcpBinding = { signer, signature, signedAt: nowIso() };
    this.autoReady(deal);
    return this.touch(deal);
  }

  markFunded(dealId: string, fundedAmount?: string): DealRecord {
    const deal = this.getDeal(dealId);
    if (deal.status !== "Ready" && deal.status !== "Funded") {
      throw new DealDemoError("CONFLICT", "deal is not fundable");
    }
    const funded = requirePositiveAmount("fundedAmount", fundedAmount || deal.amount);
    const amount = requirePositiveAmount("amount", deal.amount);
    if (funded < amount) {
      throw new DealDemoError("POLICY_VIOLATION", "fundedAmount must cover deal amount");
    }
    deal.fundedAmount = stringify(funded);
    deal.status = "Funded";
    return this.touch(deal);
  }

  recordDelivery(dealId: string, payload: Record<string, unknown>, outputHash?: string): DealRecord {
    const deal = this.getDeal(dealId);
    if (deal.status !== "Funded") throw new DealDemoError("CONFLICT", "deal is not ready for delivery");
    const hash =
      outputHash ||
      createHash("sha256")
        .update(JSON.stringify({ dealId, payload }))
        .digest("hex");
    deal.delivery = {
      deliveryId: makeId("delivery"),
      deliveredAt: nowIso(),
      payload: { ...payload, outputHash: hash }
    };
    return this.touch(deal);
  }

  releaseToMcp(dealId: string, amount?: string): DealRecord {
    const deal = this.getDeal(dealId);
    if (deal.status !== "Funded") throw new DealDemoError("CONFLICT", "deal is not releasable");
    const releaseAmount = requirePositiveAmount("releaseAmount", amount || deal.amount);
    const funded = requirePositiveAmount("fundedAmount", deal.fundedAmount);
    if (releaseAmount > funded) {
      throw new DealDemoError("POLICY_VIOLATION", "release exceeds funded amount");
    }
    deal.releasedAmount = stringify(releaseAmount);
    deal.status = "Released";
    return this.touch(deal);
  }

  failDeal(dealId: string): DealRecord {
    const deal = this.getDeal(dealId);
    if (deal.status === "Released") throw new DealDemoError("CONFLICT", "released deal cannot fail");
    deal.status = "Failed";
    return this.touch(deal);
  }

  cancelDeal(dealId: string): DealRecord {
    const deal = this.getDeal(dealId);
    if (deal.status !== "Created" && deal.status !== "Ready") {
      throw new DealDemoError("CONFLICT", "deal is not cancellable");
    }
    deal.status = "Cancelled";
    return this.touch(deal);
  }

  private autoReady(deal: DealRecord): void {
    if (deal.status === "Created" && deal.userBinding && deal.mcpBinding) {
      deal.status = "Ready";
    }
  }

  private touch<T extends DealRecord>(deal: T): T {
    deal.updatedAt = nowIso();
    return deal;
  }
}
