import { assertUnixMilliseconds, parseLegacyIsoMilliseconds } from "./time.js";
export const AGENTPAY_DELIVERY_RESULT_V2 =
  "agentpay.delivery-result.v2" as const;
export const AGENTPAY_DELIVERY_V2_MEDIA_TYPE =
  "application/vnd.agentpay.delivery-result-v2+json";
const oldTimes = ["confirmedAt", "reminderDueAt", "releaseDueAt"];
const newTimes = ["confirmedAtMs", "reminderDueAtMs", "releaseDueAtMs"];
function invalid(field: string): never {
  throw new Error(`DELIVERY_RESULT_INVALID:${field}`);
}
const plain = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
/** Receipt retries need not contain schedule times; preserve that distinction.
 * A confirmation can be later than the persisted release due time; do not reschedule it. */
export function normalizeDeliveryResult(
  value: unknown,
): Record<string, unknown> {
  if (!plain(value)) invalid("object");
  const legacy = !Object.hasOwn(value, "version");
  if (!legacy && value.version !== AGENTPAY_DELIVERY_RESULT_V2)
    invalid("version");
  const receipt = Object.hasOwn(value, "receiptId");
  const times = legacy ? oldTimes : newTimes;
  const fields = [
    "orderId",
    "duplicate",
    ...(receipt
      ? [
          "receiptId",
          "billing",
          "authorizationId",
          "deliveryJobId",
          times[1],
          times[2],
        ]
      : [times[0], times[2]]),
    "deadlines",
    "finalizationPolicy",
    "finalization",
    ...(legacy ? [] : ["version"]),
  ];
  if (Object.keys(value).some((key) => !fields.includes(key)))
    invalid("fields");
  if (
    typeof value.orderId !== "string" ||
    !/^0x[0-9a-f]{64}$/.test(value.orderId) ||
    typeof value.duplicate !== "boolean"
  )
    invalid("identity");
  if (receipt) {
    for (const key of ["receiptId", "authorizationId", "deliveryJobId"]) {
      if (
        (key === "receiptId" || Object.hasOwn(value, key)) &&
        (typeof value[key] !== "string" || !value[key].length)
      )
        invalid(key);
    }
    const bill = value.billing;
    const keys = [
      "usageUnits",
      "finalChargeAtomic",
      "sellerAmountAtomic",
      "feeAmountAtomic",
      "buyerReturnAmountAtomic",
    ];
    if (
      !plain(bill) ||
      Object.keys(bill).some((key) => !keys.includes(key)) ||
      keys.some(
        (key) =>
          typeof bill[key] !== "string" || !/^(0|[1-9][0-9]*)$/.test(bill[key]),
      )
    )
      invalid("billing");
    if (
      Object.hasOwn(value, times[1]) !== Object.hasOwn(value, times[2]) ||
      (!value.duplicate &&
        (!Object.hasOwn(value, "deliveryJobId") ||
          !Object.hasOwn(value, times[1])))
    )
      invalid("schedule");
  } else if (!Object.hasOwn(value, times[0]) || !Object.hasOwn(value, times[2]))
    invalid("confirmation");
  for (const key of ["deadlines", "finalizationPolicy", "finalization"])
    if (Object.hasOwn(value, key) && value[key] !== null && !plain(value[key]))
      invalid(key);
  const copy: Record<string, unknown> = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !oldTimes.includes(key) && !newTimes.includes(key),
    ),
  );
  copy.version = AGENTPAY_DELIVERY_RESULT_V2;
  const parse = legacy ? parseLegacyIsoMilliseconds : assertUnixMilliseconds;
  for (let i = 0; i < times.length; i++)
    if (Object.hasOwn(value, times[i]))
      copy[newTimes[i]] = parse(value[times[i]]);
  return copy;
}
