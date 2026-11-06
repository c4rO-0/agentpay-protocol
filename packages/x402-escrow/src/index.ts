import type {
  EscrowOrderTerms,
  EscrowVaultStateValue,
  X402PaymentRequired,
  X402SettlementEvidence,
  EvmAddress,
  Bytes32,
  TransactionHash,
} from "@agentpay/types";

export * from "./agentpay.js";

export const BASE_NETWORK = "eip155:8453" as const;
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

export interface X402VerificationProfile {
  network: `eip155:${bigint}`;
  asset: EvmAddress;
  tokenName: "USD Coin";
  tokenVersion: "2";
}

export const BASE_USDC_PROFILE: X402VerificationProfile = {
  network: BASE_NETWORK,
  asset: BASE_USDC,
  tokenName: "USD Coin",
  tokenVersion: "2",
};

export interface EscrowPaymentOrder {
  terms: EscrowOrderTerms;
  termsHash: Bytes32;
  vaultAddress: EvmAddress;
  x402PaymentIdentifier: string;
}

export interface NormalizedVerifyResult {
  isValid: boolean;
  payer?: EvmAddress;
  invalidReason?: string;
}

export interface NormalizedSettlementResult {
  success: boolean;
  payer?: EvmAddress;
  transactionHash?: TransactionHash;
  network?: string;
  errorReason?: string;
}

export interface X402Facilitator {
  readonly provider: string;
  getSupported(): Promise<unknown>;
  verify(
    paymentPayload: unknown,
    requirements: X402PaymentRequired,
  ): Promise<NormalizedVerifyResult>;
  settle(
    paymentPayload: unknown,
    requirements: X402PaymentRequired,
  ): Promise<NormalizedSettlementResult>;
}

export function buildPaymentRequired(
  order: EscrowPaymentOrder,
  maxTimeoutSeconds = 300,
  profile = BASE_USDC_PROFILE,
): X402PaymentRequired {
  if (!Number.isSafeInteger(maxTimeoutSeconds) || maxTimeoutSeconds <= 0)
    throw new TypeError("maxTimeoutSeconds must be positive");
  return {
    scheme: "exact",
    network: profile.network,
    asset: profile.asset,
    amount: order.terms.amount,
    payTo: order.vaultAddress,
    maxTimeoutSeconds,
    extra: { name: profile.tokenName, version: profile.tokenVersion },
    extensions: {
      "agentpay-order": {
        version: "1",
        rail: "x402_exact_escrow",
        orderId: order.terms.orderId,
        vault: order.vaultAddress,
        buyer: order.terms.buyer,
        seller: order.terms.seller,
        termsHash: order.termsHash,
      },
      "payment-identifier": { id: order.x402PaymentIdentifier },
    },
  };
}

export function validatePaymentRequired(
  value: X402PaymentRequired,
  order: EscrowPaymentOrder,
  profile = BASE_USDC_PROFILE,
): void {
  const expected = buildPaymentRequired(
    order,
    value.maxTimeoutSeconds,
    profile,
  );
  const fields: Array<keyof X402PaymentRequired> = [
    "scheme",
    "network",
    "asset",
    "amount",
    "payTo",
  ];
  for (const field of fields)
    if (value[field] !== expected[field])
      throw new Error(`payment requirement mismatch: ${field}`);
  if (JSON.stringify(value.extra) !== JSON.stringify(expected.extra))
    throw new Error("payment requirement mismatch: extra");
  if (JSON.stringify(value.extensions) !== JSON.stringify(expected.extensions))
    throw new Error("payment requirement mismatch: extensions");
}

export interface VaultTermsSnapshot {
  orderId: Bytes32;
  termsHash: Bytes32;
  buyer: EvmAddress;
  seller: EvmAddress;
  token: EvmAddress;
  settlementAuthority: EvmAddress;
  feeRecipient: EvmAddress;
  amount: string;
  maxFeeAmount: string;
  expiresAt: string;
  refundAvailableAt: string;
  state: EscrowVaultStateValue;
}

export function validateVaultTerms(
  snapshot: VaultTermsSnapshot,
  order: EscrowPaymentOrder,
): void {
  const expected = order.terms;
  const pairs: Array<[string, unknown, unknown]> = [
    ["orderId", snapshot.orderId, expected.orderId],
    ["termsHash", snapshot.termsHash, order.termsHash],
    ["buyer", snapshot.buyer, expected.buyer],
    ["seller", snapshot.seller, expected.seller],
    ["token", snapshot.token, expected.token],
    [
      "settlementAuthority",
      snapshot.settlementAuthority,
      expected.settlementAuthority,
    ],
    ["feeRecipient", snapshot.feeRecipient, expected.feeRecipient],
    ["amount", snapshot.amount, expected.amount],
    ["maxFeeAmount", snapshot.maxFeeAmount, expected.maxFeeAmount],
    ["expiresAt", snapshot.expiresAt, expected.expiresAt],
    [
      "refundAvailableAt",
      snapshot.refundAvailableAt,
      expected.refundAvailableAt,
    ],
  ];
  for (const [field, actual, wanted] of pairs)
    if (actual !== wanted) throw new Error(`vault terms mismatch: ${field}`);
  if (snapshot.state !== 1)
    throw new Error("vault must be in Created state before activation");
}

export function validateSettlementEvidence(
  evidence: X402SettlementEvidence,
  order: EscrowPaymentOrder,
  profile = BASE_USDC_PROFILE,
): void {
  if (!/^0x[0-9a-f]{64}$/.test(evidence.transactionHash))
    throw new Error("settlement transaction hash is invalid");
  if (evidence.network !== profile.network)
    throw new Error("settlement evidence network mismatch");
  if (evidence.asset !== profile.asset || evidence.asset !== order.terms.token)
    throw new Error("settlement evidence asset mismatch");
  if (evidence.receiptStatus !== "success")
    throw new Error("settlement receipt failed");
  if (!evidence.transfer)
    throw new Error("settlement Transfer evidence is missing");
  if (evidence.transfer.from !== order.terms.buyer)
    throw new Error("settlement transfer payer mismatch");
  if (evidence.transfer.to !== order.vaultAddress)
    throw new Error("settlement transfer recipient mismatch");
  if (evidence.transfer.value !== order.terms.amount)
    throw new Error("settlement transfer amount mismatch");
  if (BigInt(evidence.observedVaultBalance) < BigInt(order.terms.amount))
    throw new Error("vault balance is insufficient");
}

export interface BalanceRetryOptions {
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}
export async function waitForVaultBalance(
  readBalance: () => Promise<bigint>,
  required: bigint,
  options: BalanceRetryOptions = {},
): Promise<bigint> {
  const attempts = options.attempts ?? 5;
  const delayMs = options.delayMs ?? 1000;
  if (!Number.isSafeInteger(attempts) || attempts < 1)
    throw new TypeError("attempts must be positive");
  const sleep =
    options.sleep ??
    ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let balance = 0n;
  for (let i = 0; i < attempts; i++) {
    balance = await readBalance();
    if (balance >= required) return balance;
    if (i + 1 < attempts) await sleep(delayMs);
  }
  throw new Error(`vault balance remained insufficient: ${balance}`);
}

export class FundingIdempotencyRegistry {
  private readonly payments = new Map<string, string>();
  private readonly transactions = new Map<string, string>();
  claim(
    paymentIdentifier: string,
    transactionHash: string,
    orderId: string,
  ): "new" | "existing" {
    const paymentOrder = this.payments.get(paymentIdentifier);
    const txOrder = this.transactions.get(transactionHash);
    if (
      (paymentOrder && paymentOrder !== orderId) ||
      (txOrder && txOrder !== orderId)
    )
      throw new Error("funding evidence replayed across orders");
    if (paymentOrder === orderId && txOrder === orderId) return "existing";
    if (paymentOrder || txOrder)
      throw new Error("incomplete idempotency association");
    this.payments.set(paymentIdentifier, orderId);
    this.transactions.set(transactionHash, orderId);
    return "new";
  }
}
