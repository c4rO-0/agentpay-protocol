import { assertUnixMilliseconds, type UnixMilliseconds } from "./time.js";
/** Separate from delivery deadlines: preparation/payment and Provider acceptance. */
export const AGENTPAY_ORDER_WAITING_V1 = "agentpay.order-waiting.v1" as const;
export interface OrderWaitingV1 {
  version: typeof AGENTPAY_ORDER_WAITING_V1;
  paymentDueAtMs: UnixMilliseconds;
  providerResponseWindowMs: number;
  fundingConfirmedAtMs: UnixMilliseconds | null;
  providerResponseDueAtMs: UnixMilliseconds | null;
}
export function validateOrderWaiting(value: unknown): OrderWaitingV1 {
  const fail = (): never => {
    throw Error("ORDER_WAITING_INVALID");
  };
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    return fail();
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).sort().join(",") !==
      "fundingConfirmedAtMs,paymentDueAtMs,providerResponseDueAtMs,providerResponseWindowMs,version" ||
    row.version !== AGENTPAY_ORDER_WAITING_V1
  )
    return fail();
  const paymentDueAtMs = assertUnixMilliseconds(row.paymentDueAtMs);
  if (
    typeof row.providerResponseWindowMs !== "number" ||
    !Number.isSafeInteger(row.providerResponseWindowMs) ||
    row.providerResponseWindowMs <= 0 ||
    row.providerResponseWindowMs > 253402300799999
  )
    return fail();
  // Before funding both instants are absent; a partial pair is not a usable deadline.
  if (
    (row.fundingConfirmedAtMs === null) !==
    (row.providerResponseDueAtMs === null)
  )
    return fail();
  const fundingConfirmedAtMs =
    row.fundingConfirmedAtMs === null
      ? null
      : assertUnixMilliseconds(row.fundingConfirmedAtMs);
  const providerResponseDueAtMs =
    row.providerResponseDueAtMs === null
      ? null
      : assertUnixMilliseconds(row.providerResponseDueAtMs);
  // A snapshotted deadline may be shorter, but cannot extend the response window.
  if (
    fundingConfirmedAtMs !== null &&
    (providerResponseDueAtMs as number) >
      fundingConfirmedAtMs + row.providerResponseWindowMs
  )
    return fail();
  return {
    version: AGENTPAY_ORDER_WAITING_V1,
    paymentDueAtMs,
    providerResponseWindowMs: row.providerResponseWindowMs,
    fundingConfirmedAtMs,
    providerResponseDueAtMs,
  };
}
