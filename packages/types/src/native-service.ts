import { keccak256, stringToHex } from "viem";

import type {
  AtomicAmount,
  Bytes32,
  EvmAddress,
  IsoDateTime,
  TransactionHash,
  UnixSeconds,
} from "./x402-escrow.js";

export const AGENTPAY_PRIVATE_REQUEST_VERSION =
  "agentpay.private-request.v1" as const;
export const AGENTPAY_PARTICIPANT_ORDER_VERSION =
  "agentpay.participant-order.v1" as const;
export const AGENTPAY_SERVICE_PAYMENT_REQUIRED_VERSION =
  "agentpay.service-payment-required.v1" as const;

export interface AgentPayServicePaymentRequired {
  version: typeof AGENTPAY_SERVICE_PAYMENT_REQUIRED_VERSION;
  resource: { url: string; method: string };
  requirement: {
    scheme: "agentpay";
    network: `eip155:${number}`;
    asset: EvmAddress;
    /** Provider-served paid Skill identity, not the User-installed Skill package identity. */
    skillId: Bytes32;
    profileHash: Bytes32;
    seller: EvmAddress;
    baseAmount: AtomicAmount;
    unitPrice: AtomicAmount;
    maxUsageUnits: AtomicAmount;
    offerId: Bytes32;
    validUntil: UnixSeconds;
    /** Maximum delivery duration from Order creation, distinct from Quote expiry. Omission selects Settlement default. */
    serviceWindowSeconds?: `${bigint}`;
  };
}

export type PrivateRequestJson =
  | null
  | boolean
  | number
  | string
  | PrivateRequestJson[]
  | { [key: string]: PrivateRequestJson };

function canonicalJson(value: unknown, path: string): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new TypeError(`${path} must not contain a non-finite number`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((item, index) => canonicalJson(item, `${path}[${index}]`)).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null)
      throw new TypeError(`${path} must contain only plain JSON objects`);
    const fields = Object.keys(object).sort();
    return `{${fields
      .map((key) => {
        const item = object[key];
        if (
          item === undefined ||
          typeof item === "bigint" ||
          typeof item === "function" ||
          typeof item === "symbol"
        ) {
          throw new TypeError(`${path}.${key} is not a JSON value`);
        }
        return `${JSON.stringify(key)}:${canonicalJson(item, `${path}.${key}`)}`;
      })
      .join(",")}}`;
  }
  throw new TypeError(`${path} is not a JSON value`);
}

/** Canonical bytes are UTF-8 JSON of { request, version }, with object keys sorted lexicographically. */
export function canonicalizePrivateRequest(
  request: PrivateRequestJson,
): string {
  return canonicalJson(
    { request, version: AGENTPAY_PRIVATE_REQUEST_VERSION },
    "privateRequest",
  );
}

export function hashPrivateRequest(request: PrivateRequestJson): Bytes32 {
  return keccak256(stringToHex(canonicalizePrivateRequest(request)));
}

export type ParticipantOrderStatus =
  | "Created"
  | "Funding"
  | "Funded"
  | "ServiceReady"
  | "Accepted"
  | "Rejected"
  | "Delivered"
  | "ReleasePending"
  | "Released"
  | "RefundPending"
  | "Refunded"
  | "Disputed"
  | "Failed";

export interface ParticipantOrderCore {
  version: typeof AGENTPAY_PARTICIPANT_ORDER_VERSION;
  orderId: Bytes32;
  orderStatus: ParticipantOrderStatus;
  vaultAddress: EvmAddress;
  vaultState:
    | "Created"
    | "Funded"
    | "Delivered"
    | "Released"
    | "Refunded"
    | "Cancelled";
  chainId: `${bigint}`;
  assetAddress: EvmAddress;
  prepaidAmountAtomic: AtomicAmount;
  basePriceAtomic: AtomicAmount;
  unitPriceAtomic: AtomicAmount;
  maxUsageUnits: AtomicAmount;
  maxFeeAmountAtomic: AtomicAmount;
  skillId: Bytes32;
  profileHash: Bytes32;
  providerId: string;
  requestHash: Bytes32;
  expiresAt: UnixSeconds;
  refundAvailableAt: UnixSeconds;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface BuyerOrderProjection extends ParticipantOrderCore {
  role: "buyer";
  buyerAddress: EvmAddress;
  serviceState:
    | "unavailable"
    | "ready"
    | "claimed"
    | "accepted"
    | "rejected"
    | "delivered"
    | "closed";
  providerResponseDueAt: IsoDateTime | null;
  usageUnits: AtomicAmount | null;
  sellerAmountAtomic: AtomicAmount | null;
  feeAmountAtomic: AtomicAmount | null;
  buyerRefundAmountAtomic: AtomicAmount | null;
  settlementTransactionHash: TransactionHash | null;
}

export interface ProviderOrderProjection extends ParticipantOrderCore {
  role: "provider";
  sellerAddress: EvmAddress;
  serviceState:
    | "ready"
    | "claimed"
    | "accepted"
    | "rejected"
    | "delivered"
    | "closed";
  providerResponseDueAt: IsoDateTime;
  usageUnits: AtomicAmount | null;
  settlementTransactionHash: TransactionHash | null;
}

export type ParticipantOrderProjection =
  | BuyerOrderProjection
  | ProviderOrderProjection;
