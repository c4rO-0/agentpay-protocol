import type {
  BuyerOrderProjection,
  ProviderOrderProjection,
  ParticipantOrderProjection,
} from "./native-service.js";
import {
  assertUnixMilliseconds,
  assertUnixSeconds,
  parseLegacyIsoMilliseconds,
  type UnixMilliseconds,
} from "./time.js";

export const AGENTPAY_PARTICIPANT_ORDER_V2 =
  "agentpay.participant-order.v2" as const;
type OldTimeKeys =
  | "version"
  | "createdAt"
  | "updatedAt"
  | "providerResponseDueAt";
interface ProjectionTimeV2 {
  version: typeof AGENTPAY_PARTICIPANT_ORDER_V2;
  createdAtMs: UnixMilliseconds;
  updatedAtMs: UnixMilliseconds;
}
export type BuyerOrderProjectionV2 = Omit<BuyerOrderProjection, OldTimeKeys> &
  ProjectionTimeV2 & {
    providerResponseDueAtMs: UnixMilliseconds | null;
  };
export type ProviderOrderProjectionV2 = Omit<
  ProviderOrderProjection,
  OldTimeKeys
> &
  ProjectionTimeV2 & {
    providerResponseDueAtMs: UnixMilliseconds;
  };
export type ParticipantOrderProjectionV2 =
  | BuyerOrderProjectionV2
  | ProviderOrderProjectionV2;

const coreKeys = [
  "version",
  "role",
  "orderId",
  "orderStatus",
  "vaultAddress",
  "vaultState",
  "chainId",
  "assetAddress",
  "prepaidAmountAtomic",
  "basePriceAtomic",
  "unitPriceAtomic",
  "maxUsageUnits",
  "maxFeeAmountAtomic",
  "skillId",
  "profileHash",
  "providerId",
  "requestHash",
  "expiresAt",
  "refundAvailableAt",
  "serviceState",
  "usageUnits",
  "settlementTransactionHash",
];
const buyerKeys = [
  "buyerAddress",
  "sellerAmountAtomic",
  "feeAmountAtomic",
  "buyerRefundAmountAtomic",
];
const providerKeys = ["sellerAddress"];
const oldTimes = ["createdAt", "updatedAt", "providerResponseDueAt"];
const newTimes = ["createdAtMs", "updatedAtMs", "providerResponseDueAtMs"];
const orderStates = [
  "Created",
  "Funding",
  "Funded",
  "ServiceReady",
  "Accepted",
  "Rejected",
  "Delivered",
  "ReleasePending",
  "Released",
  "RefundPending",
  "Refunded",
  "Disputed",
  "Failed",
];
const vaultStates = [
  "Created",
  "Funded",
  "Delivered",
  "Released",
  "Refunded",
  "Cancelled",
];
const serviceStates = [
  "ready",
  "claimed",
  "accepted",
  "rejected",
  "delivered",
  "closed",
];
const uint = /^(0|[1-9][0-9]*)$/;
const address = /^0x[0-9a-fA-F]{40}$/;
const bytes32 = /^0x[0-9a-f]{64}$/;
const transaction = /^0x[0-9a-fA-F]{64}$/;
function invalid(field: string): never {
  throw new Error(`PARTICIPANT_ORDER_INVALID:${field}`);
}
function stringMatch(value: unknown, pattern: RegExp, field: string) {
  if (typeof value !== "string" || !pattern.test(value)) invalid(field);
}
function validateShape(value: unknown): {
  row: Record<string, unknown>;
  legacy: boolean;
} {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    invalid("object");
  const row = value as Record<string, unknown>;
  const legacy = row.version === "agentpay.participant-order.v1";
  if (!legacy && row.version !== AGENTPAY_PARTICIPANT_ORDER_V2)
    invalid("version");
  if (row.role !== "buyer" && row.role !== "provider") invalid("role");
  const fields = [
    ...coreKeys,
    ...(row.role === "buyer" ? buyerKeys : providerKeys),
    ...(legacy ? oldTimes : newTimes),
  ];
  const allowed = new Set(fields);
  for (const field of Object.keys(row)) if (!allowed.has(field)) invalid(field);
  for (const field of fields) if (!Object.hasOwn(row, field)) invalid(field);
  for (const field of ["orderId", "skillId", "profileHash", "requestHash"])
    stringMatch(row[field], bytes32, field);
  for (const field of [
    "vaultAddress",
    "assetAddress",
    row.role === "buyer" ? "buyerAddress" : "sellerAddress",
  ])
    stringMatch(row[field], address, field);
  for (const field of [
    "chainId",
    "prepaidAmountAtomic",
    "basePriceAtomic",
    "unitPriceAtomic",
    "maxUsageUnits",
    "maxFeeAmountAtomic",
    "expiresAt",
    "refundAvailableAt",
  ])
    stringMatch(row[field], uint, field);
  for (const field of ["expiresAt", "refundAvailableAt"])
    assertUnixSeconds(row[field]);
  for (const field of [
    "usageUnits",
    ...(row.role === "buyer"
      ? ["sellerAmountAtomic", "feeAmountAtomic", "buyerRefundAmountAtomic"]
      : []),
  ]) {
    if (row[field] !== null) stringMatch(row[field], uint, field);
  }
  if (typeof row.providerId !== "string" || !row.providerId.length)
    invalid("providerId");
  if (!orderStates.includes(String(row.orderStatus))) invalid("orderStatus");
  if (!vaultStates.includes(String(row.vaultState))) invalid("vaultState");
  if (
    ![
      ...serviceStates,
      ...(row.role === "buyer" ? ["unavailable"] : []),
    ].includes(String(row.serviceState))
  )
    invalid("serviceState");
  if (row.settlementTransactionHash !== null)
    stringMatch(
      row.settlementTransactionHash,
      transaction,
      "settlementTransactionHash",
    );
  return { row, legacy };
}

/** Explicit v1 adapter. Invalid/ambiguous ISO, missing times and private fields fail closed.
 * Does not infer units, change chain seconds, or modify the input or any signed material. */
export function normalizeParticipantOrder(
  value: unknown,
): ParticipantOrderProjectionV2 {
  const { row, legacy } = validateShape(value);
  const parse = legacy ? parseLegacyIsoMilliseconds : assertUnixMilliseconds;
  const times = legacy ? oldTimes : newTimes;
  const createdAtMs = parse(row[times[0]]);
  const updatedAtMs = parse(row[times[1]]);
  const due = row[times[2]];
  if (due === null && row.role !== "buyer") invalid(times[2]);
  const providerResponseDueAtMs = due === null ? null : parse(due);
  const copy = Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => !oldTimes.includes(key) && !newTimes.includes(key),
    ),
  );
  return {
    ...copy,
    version: AGENTPAY_PARTICIPANT_ORDER_V2,
    createdAtMs,
    updatedAtMs,
    providerResponseDueAtMs,
  } as ParticipantOrderProjectionV2;
}

/** Compatibility egress only; callers should retain integer projections internally. */
export function participantOrderToLegacy(
  value: ParticipantOrderProjectionV2,
): ParticipantOrderProjection {
  const row = normalizeParticipantOrder(value);
  const { createdAtMs, updatedAtMs, providerResponseDueAtMs, ...copy } = row;
  return {
    ...copy,
    version: "agentpay.participant-order.v1",
    createdAt: new Date(createdAtMs).toISOString(),
    updatedAt: new Date(updatedAtMs).toISOString(),
    providerResponseDueAt:
      providerResponseDueAtMs === null
        ? null
        : new Date(providerResponseDueAtMs).toISOString(),
  } as ParticipantOrderProjection;
}
