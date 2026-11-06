import { assertUnixMilliseconds, type UnixMilliseconds } from "./time.js";
export const AGENTPAY_ORDER_CLOSURE_V1 = "agentpay.order-closure.v1" as const;
export interface OrderClosureV1 {
  version: typeof AGENTPAY_ORDER_CLOSURE_V1;
  state: "requested" | "cancelling" | "refunding" | "cancelled" | "refunded";
  reason: "user_cancel" | "payment_timeout" | "provider_response_timeout";
  requestedAtMs: UnixMilliseconds;
  completedAtMs: UnixMilliseconds | null;
  transactionHash: string | null;
  errorCode: string | null;
}
/** Check a closure projection. A transaction hash here is not verified chain evidence. */
export function validateOrderClosure(value: unknown): OrderClosureV1 {
  const fail = (): never => {
    throw Error("ORDER_CLOSURE_INVALID");
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
      "completedAtMs,errorCode,reason,requestedAtMs,state,transactionHash,version" ||
    row.version !== AGENTPAY_ORDER_CLOSURE_V1
  )
    return fail();
  if (
    !["requested", "cancelling", "refunding", "cancelled", "refunded"].includes(
      String(row.state),
    ) ||
    !["user_cancel", "payment_timeout", "provider_response_timeout"].includes(
      String(row.reason),
    )
  )
    return fail();
  const requestedAtMs = assertUnixMilliseconds(row.requestedAtMs),
    completedAtMs =
      row.completedAtMs === null
        ? null
        : assertUnixMilliseconds(row.completedAtMs);
  if (completedAtMs !== null && completedAtMs < requestedAtMs) return fail();
  if (
    ["cancelled", "refunded"].includes(String(row.state)) !==
    (completedAtMs !== null)
  )
    return fail();
  if (
    row.transactionHash !== null &&
    (typeof row.transactionHash !== "string" ||
      !/^0x[0-9a-fA-F]{64}$/.test(row.transactionHash))
  )
    return fail();
  if (row.state === "refunded" && row.transactionHash === null) return fail();
  if (
    row.errorCode !== null &&
    (typeof row.errorCode !== "string" ||
      !/^[A-Z][A-Z0-9_]{0,95}$/.test(row.errorCode))
  )
    return fail();
  return {
    version: AGENTPAY_ORDER_CLOSURE_V1,
    state: row.state as OrderClosureV1["state"],
    reason: row.reason as OrderClosureV1["reason"],
    requestedAtMs,
    completedAtMs,
    transactionHash: row.transactionHash as string | null,
    errorCode: row.errorCode as string | null,
  };
}
