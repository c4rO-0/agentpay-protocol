import { assertUnixMilliseconds, parseLegacyIsoMilliseconds } from "./time.js";
export const AGENTPAY_WALLET_NOTICE_V2 = "agentpay.wallet-notice.v2" as const;
export const AGENTPAY_NOTICE_V2_MEDIA_TYPE =
  "application/vnd.agentpay.wallet-notice-v2+json";
function invalid(field: string): never {
  throw new Error(`WALLET_NOTICE_INVALID:${field}`);
}
const plain = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));
export function normalizeWalletNotice(value: unknown): Record<string, unknown> {
  if (!plain(value)) invalid("object");
  const legacy = !Object.hasOwn(value, "version");
  if (!legacy && value.version !== AGENTPAY_WALLET_NOTICE_V2)
    invalid("version");
  const fields = [
    "noticeId",
    "orderId",
    "type",
    "state",
    "payload",
    ...(legacy ? [] : ["version"]),
  ];
  if (
    fields.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !fields.includes(key))
  )
    invalid("fields");
  if (typeof value.noticeId !== "string" || !value.noticeId.length)
    invalid("noticeId");
  if (
    typeof value.orderId !== "string" ||
    !/^0x[0-9a-f]{64}$/.test(value.orderId)
  )
    invalid("orderId");
  if (
    value.type !== "delivery_confirmation_required" ||
    typeof value.state !== "string" ||
    !["created", "delivered", "acknowledged"].includes(String(value.state))
  )
    invalid("state/type");
  const payload = value.payload;
  if (!plain(payload)) invalid("payload");
  const time = legacy ? "releaseScheduledAt" : "releaseScheduledAtMs";
  const keys = ["orderId", "outputHash", "actions", time];
  if (
    keys.some((key) => !Object.hasOwn(payload, key)) ||
    Object.keys(payload).some((key) => !keys.includes(key))
  )
    invalid("payloadFields");
  if (payload.orderId !== value.orderId) invalid("orderBinding");
  if (
    typeof payload.outputHash !== "string" ||
    !/^0x[0-9a-f]{64}$/.test(payload.outputHash)
  )
    invalid("outputHash");
  if (
    !Array.isArray(payload.actions) ||
    !payload.actions.length ||
    new Set(payload.actions).size !== payload.actions.length ||
    payload.actions.some(
      (action) => action !== "confirm_received" && action !== "open_dispute",
    )
  )
    invalid("actions");
  const releaseScheduledAtMs = (
    legacy ? parseLegacyIsoMilliseconds : assertUnixMilliseconds
  )(payload[time]);
  return {
    ...value,
    version: AGENTPAY_WALLET_NOTICE_V2,
    payload: {
      orderId: payload.orderId,
      outputHash: payload.outputHash,
      actions: [...payload.actions],
      releaseScheduledAtMs,
    },
  };
}
