import {
  assertUnixMilliseconds,
  parseLegacyIsoMilliseconds,
  type UnixMilliseconds,
} from "./time.js";

export const AGENTPAY_ORDER_DEADLINES_V2 =
  "agentpay.order-deadlines.v2" as const;
export const AGENTPAY_DEADLINES_V2_MEDIA_TYPE =
  "application/vnd.agentpay.order-deadlines-v2+json";
export interface OrderDeadlinesV2 {
  version: typeof AGENTPAY_ORDER_DEADLINES_V2;
  deliveryDueAtMs: UnixMilliseconds | null;
  chainDeliveryDueAtMs: UnixMilliseconds;
  refundAvailableAtMs: UnixMilliseconds;
  providerResponseDueAtMs: UnixMilliseconds | null;
  chainMarginMs: number | null;
  deadlinePolicyVersion: "agentpay.order-deadlines.v1" | null;
}
const oldTimes = [
  "deliveryDueAt",
  "chainDeliveryDueAt",
  "refundAvailableAt",
  "providerResponseDueAt",
];
const newTimes = [
  "deliveryDueAtMs",
  "chainDeliveryDueAtMs",
  "refundAvailableAtMs",
  "providerResponseDueAtMs",
];
function invalid(field: string): never {
  throw new Error(`ORDER_DEADLINES_INVALID:${field}`);
}

/** Public disclosure version is separate from the persisted per-Order policy version.
 * Legacy Orders retain null receipt-cutoff/policy fields; adaptation cannot upgrade a Vault. */
export function normalizeOrderDeadlines(value: unknown): OrderDeadlinesV2 {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    invalid("object");
  const row = value as Record<string, unknown>;
  const legacy = !Object.hasOwn(row, "version");
  if (!legacy && row.version !== AGENTPAY_ORDER_DEADLINES_V2)
    invalid("version");
  const times = legacy ? oldTimes : newTimes;
  const fields = [
    ...times,
    "chainMarginMs",
    "deadlinePolicyVersion",
    ...(legacy ? [] : ["version"]),
  ];
  if (
    fields.some((key) => !Object.hasOwn(row, key)) ||
    Object.keys(row).some((key) => !fields.includes(key))
  )
    invalid("fields");
  const parse = legacy ? parseLegacyIsoMilliseconds : assertUnixMilliseconds;
  const deliveryDueAtMs = row[times[0]] === null ? null : parse(row[times[0]]);
  const chainDeliveryDueAtMs = parse(row[times[1]]);
  const refundAvailableAtMs = parse(row[times[2]]);
  const providerResponseDueAtMs =
    row[times[3]] === null ? null : parse(row[times[3]]);
  if (
    row.deadlinePolicyVersion !== null &&
    row.deadlinePolicyVersion !== "agentpay.order-deadlines.v1"
  )
    invalid("policyVersion");
  const chainMarginMs = row.chainMarginMs;
  if (row.deadlinePolicyVersion === null) {
    if (deliveryDueAtMs !== null || chainMarginMs !== null)
      invalid("legacyPolicy");
  } else if (
    deliveryDueAtMs === null ||
    typeof chainMarginMs !== "number" ||
    !Number.isSafeInteger(chainMarginMs) ||
    chainMarginMs <= 0 ||
    chainMarginMs > 253402300799999
  )
    invalid("policy");
  if (refundAvailableAtMs <= chainDeliveryDueAtMs)
    invalid("refundBeforeDelivery");
  if (
    deliveryDueAtMs !== null &&
    (deliveryDueAtMs >= chainDeliveryDueAtMs ||
      chainDeliveryDueAtMs - deliveryDueAtMs < (chainMarginMs as number))
  )
    invalid("chainMargin");
  return {
    version: AGENTPAY_ORDER_DEADLINES_V2,
    deliveryDueAtMs,
    chainDeliveryDueAtMs,
    refundAvailableAtMs,
    providerResponseDueAtMs,
    chainMarginMs: chainMarginMs as number | null,
    deadlinePolicyVersion: row.deadlinePolicyVersion,
  };
}
