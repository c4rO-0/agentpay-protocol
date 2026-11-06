import { assertUnixMilliseconds, parseLegacyIsoMilliseconds } from "./time.js";

export const AGENTPAY_SERVICE_AUTHORIZATION_V2 =
  "agentpay.service-authorization.v2" as const;
export const AGENTPAY_AUTHORIZATION_V2_MEDIA_TYPE =
  "application/vnd.agentpay.service-authorization-v2+json";
const core = [
  "authorizationId",
  "orderId",
  "providerId",
  "skillId",
  "profileHash",
  "requestHash",
  "maxUsageUnits",
  "state",
];
const optional = [
  "authorization",
  "claimed",
  "duplicate",
  "decision",
  "refundJobId",
  "deadlines",
  "finalizationPolicy",
  "finalization",
];
const oldTimes = ["expiresAt", "responseDueAt", "respondedAt"];
const newTimes = ["expiresAtMs", "responseDueAtMs", "respondedAtMs"];
const states = [
  "ready",
  "claimed",
  "accepted",
  "rejected",
  "receipt_accepted",
  "response_overdue",
  "rejection_refunded",
  "timeout_refunded",
];
function invalid(field: string): never {
  throw new Error(`SERVICE_AUTHORIZATION_INVALID:${field}`);
}

/** Service Authorization expiry is milliseconds in v2, unlike Order chain expiresAt seconds.
 * This adapter preserves the opaque one-time value and all response identity fields. */
export function normalizeServiceAuthorization(
  value: unknown,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    invalid("object");
  const row = value as Record<string, unknown>;
  const legacy = !Object.hasOwn(row, "version");
  if (!legacy && row.version !== AGENTPAY_SERVICE_AUTHORIZATION_V2)
    invalid("version");
  const times = legacy ? oldTimes : newTimes;
  const allowed = [
    ...core,
    ...optional,
    ...times,
    ...(legacy ? [] : ["version"]),
  ];
  if (
    Object.keys(row).some((key) => !allowed.includes(key)) ||
    [...core, times[0]].some((key) => !Object.hasOwn(row, key))
  )
    invalid("fields");
  for (const key of ["authorizationId", "providerId"])
    if (typeof row[key] !== "string" || !row[key].length) invalid(key);
  for (const key of ["orderId", "skillId", "profileHash", "requestHash"])
    if (typeof row[key] !== "string" || !/^0x[0-9a-f]{64}$/.test(row[key]))
      invalid(key);
  if (
    typeof row.maxUsageUnits !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(row.maxUsageUnits)
  )
    invalid("maxUsageUnits");
  if (typeof row.state !== "string" || !states.includes(row.state))
    invalid("state");
  for (const key of ["authorization", "refundJobId"])
    if (
      Object.hasOwn(row, key) &&
      (typeof row[key] !== "string" || !row[key].length)
    )
      invalid(key);
  for (const key of ["claimed", "duplicate"])
    if (Object.hasOwn(row, key) && typeof row[key] !== "boolean") invalid(key);
  if (
    Object.hasOwn(row, "decision") &&
    row.decision !== "accept" &&
    row.decision !== "reject"
  )
    invalid("decision");
  for (const key of ["deadlines", "finalizationPolicy", "finalization"]) {
    if (
      Object.hasOwn(row, key) &&
      row[key] !== null &&
      (!row[key] ||
        typeof row[key] !== "object" ||
        Array.isArray(row[key]) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(row[key])))
    )
      invalid(key);
  }
  const parse = legacy ? parseLegacyIsoMilliseconds : assertUnixMilliseconds;
  const copy: Record<string, unknown> = Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => !oldTimes.includes(key) && !newTimes.includes(key),
    ),
  );
  copy.version = AGENTPAY_SERVICE_AUTHORIZATION_V2;
  for (let i = 0; i < times.length; i++)
    if (Object.hasOwn(row, times[i])) copy[newTimes[i]] = parse(row[times[i]]);
  return copy;
}
