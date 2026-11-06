import {
  assertUnixMilliseconds,
  parseLegacyIsoMilliseconds,
  type UnixMilliseconds,
} from "./time.js";

export const AGENTPAY_FINALIZATION_DISCLOSURE_V2 =
  "agentpay.finalization-disclosure.v2" as const;
export const AGENTPAY_FINALIZATION_V2_MEDIA_TYPE =
  "application/vnd.agentpay.finalization-v2+json";
export const AGENTPAY_ORDER_V2_MEDIA_TYPE =
  "application/vnd.agentpay.participant-order-v2+json";
export interface FinalizationDisclosureV2 {
  version: typeof AGENTPAY_FINALIZATION_DISCLOSURE_V2;
  state: string;
  deliveryAcceptedAtMs: UnixMilliseconds;
  confirmedAtMs: UnixMilliseconds | null;
  releaseScheduledAtMs: UnixMilliseconds | null;
  automaticReleaseBlocked: boolean;
  resolution: "release" | "refund" | null;
  automaticReleaseRequiresConfirmation: false;
}
const oldTimes = [
  "deliveryAcceptedAt",
  "confirmedAt",
  "releaseScheduledAt",
] as const;
const newTimes = [
  "deliveryAcceptedAtMs",
  "confirmedAtMs",
  "releaseScheduledAtMs",
] as const;
const shared = [
  "state",
  "automaticReleaseBlocked",
  "resolution",
  "automaticReleaseRequiresConfirmation",
];
const states = [
  "awaiting_confirmation",
  "cooldown",
  "disputed",
  "resolved",
  "queued",
  "finalized",
];
function invalid(field: string): never {
  throw new Error(`FINALIZATION_DISCLOSURE_INVALID:${field}`);
}

/** The legacy schedule was unversioned ISO. Its adapter requires explicit timezones.
 * Always retain the persisted instant; never recompute release from a local clock. */
export function normalizeFinalizationDisclosure(
  value: unknown,
): FinalizationDisclosureV2 {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    invalid("object");
  const row = value as Record<string, unknown>;
  const legacy = !Object.hasOwn(row, "version");
  if (!legacy && row.version !== AGENTPAY_FINALIZATION_DISCLOSURE_V2)
    invalid("version");
  const timeKeys = legacy ? oldTimes : newTimes;
  const fields = [...shared, ...timeKeys, ...(legacy ? [] : ["version"])];
  const allowed = new Set(fields);
  if (Object.keys(row).some((key) => !allowed.has(key))) invalid("fields");
  if (fields.some((key) => !Object.hasOwn(row, key))) invalid("fields");
  if (typeof row.state !== "string" || !states.includes(row.state))
    invalid("state");
  if (
    row.automaticReleaseRequiresConfirmation !== false ||
    typeof row.automaticReleaseBlocked !== "boolean"
  )
    invalid("flags");
  if (
    row.resolution !== null &&
    row.resolution !== "release" &&
    row.resolution !== "refund"
  )
    invalid("resolution");
  const parse = legacy ? parseLegacyIsoMilliseconds : assertUnixMilliseconds;
  const deliveryAcceptedAtMs = parse(row[timeKeys[0]]);
  const confirmedAtMs =
    row[timeKeys[1]] === null ? null : parse(row[timeKeys[1]]);
  const inactive =
    row.automaticReleaseBlocked ||
    row.state === "finalized" ||
    row.resolution === "refund";
  if (inactive && row[timeKeys[2]] !== null) invalid("inactiveRelease");
  const releaseScheduledAtMs =
    row[timeKeys[2]] === null ? null : parse(row[timeKeys[2]]);
  if (!inactive && releaseScheduledAtMs === null) invalid("missingRelease");
  if (confirmedAtMs !== null && confirmedAtMs < deliveryAcceptedAtMs)
    invalid("confirmationBeforeDelivery");
  if (
    releaseScheduledAtMs !== null &&
    releaseScheduledAtMs < deliveryAcceptedAtMs
  )
    invalid("releaseBeforeDelivery");
  return {
    version: AGENTPAY_FINALIZATION_DISCLOSURE_V2,
    state: row.state,
    deliveryAcceptedAtMs,
    confirmedAtMs,
    releaseScheduledAtMs,
    automaticReleaseBlocked: row.automaticReleaseBlocked,
    resolution: row.resolution,
    automaticReleaseRequiresConfirmation: false,
  };
}

/** HTTP disclosure negotiation only; never a signing or authority selector. */
export function acceptsAgentPayMediaType(
  header: unknown,
  expected: string,
): boolean {
  if (typeof header !== "string") return false;
  return header.split(",").some((item) => {
    const [type, ...params] = item.trim().split(";");
    if (type.trim().toLowerCase() !== expected.toLowerCase()) return false;
    const weights = params
      .map((p) => p.trim())
      .filter((p) => /^q\s*=/i.test(p));
    if (weights.length > 1) return false;
    if (!weights.length) return true;
    const match = weights[0].match(
      /^q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i,
    );
    return !!match && Number(match[1]) > 0;
  });
}
