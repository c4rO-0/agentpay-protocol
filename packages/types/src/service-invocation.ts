import { sha256, stringToHex } from "viem";
import {
  canonicalizePrivateRequest,
  hashPrivateRequest,
  type PrivateRequestJson,
} from "./native-service.js";
import {
  canonicalizeServiceProfile,
  hashServiceProfile,
  type AgentPayServiceProfile,
} from "./service-profile.js";
import type { Bytes32 } from "./x402-escrow.js";

export const AGENTPAY_SERVICE_REFERENCE_VERSION =
  "agentpay.service-reference.v1" as const;
export const AGENTPAY_SERVICE_INVOCATION_VERSION =
  "agentpay.service-invocation.v1" as const;
export const AGENTPAY_SERVICE_RESULT_VERSION =
  "agentpay.service-result.v1" as const;
export interface AgentPayServiceReference {
  version: typeof AGENTPAY_SERVICE_REFERENCE_VERSION;
  skillId: Bytes32;
  profileHash: Bytes32;
  profile: AgentPayServiceProfile;
  adapter: "agentpay.json.v1";
}
const B32 = /^0x[0-9a-f]{64}$/;
// Frozen envelopes reject extra fields rather than silently dropping caller intent.
function exact(
  value: unknown,
  keys: string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== keys.sort().join(",")
  )
    throw new TypeError("service message fields invalid");
}
/** Verify profile consistency only; Registry qualification is checked by consumers. */
export function normalizeServiceReference(
  value: unknown,
): AgentPayServiceReference {
  exact(value, ["version", "skillId", "profileHash", "profile", "adapter"]);
  if (
    value.version !== AGENTPAY_SERVICE_REFERENCE_VERSION ||
    !B32.test(String(value.skillId)) ||
    !B32.test(String(value.profileHash)) ||
    value.adapter !== "agentpay.json.v1"
  )
    throw new TypeError("service reference invalid");
  const serializedProfile = canonicalizeServiceProfile(
    value.profile as AgentPayServiceProfile,
  );
  if (new TextEncoder().encode(serializedProfile).length > 15000)
    throw new TypeError("service profile size limit");
  const profile = JSON.parse(serializedProfile) as AgentPayServiceProfile;
  if (hashServiceProfile(profile) !== value.profileHash)
    throw new TypeError("service profile hash mismatch");
  return {
    version: AGENTPAY_SERVICE_REFERENCE_VERSION,
    skillId: value.skillId as Bytes32,
    profileHash: value.profileHash as Bytes32,
    profile,
    adapter: value.adapter as AgentPayServiceReference["adapter"],
  };
}
/** UTF-8, recursively sorted JSON; no implicit type conversion, at most 32 levels. */
export function canonicalizeServiceJson(
  value: unknown,
  maxBytes = 262144,
): string {
  let nodes = 0;
  const inspect = (item: unknown, depth: number): void => {
    if (depth > 32 || ++nodes > 50000)
      throw new TypeError("service JSON complexity limit");
    if (item && typeof item === "object") {
      if (Array.isArray(item)) {
        if (item.length > 50000)
          throw new TypeError("service JSON complexity limit");
        for (const entry of item) inspect(entry, depth + 1);
      } else
        for (const key of Object.keys(item))
          inspect((item as Record<string, unknown>)[key], depth + 1);
    }
  };
  inspect(value, 0);
  const result = JSON.stringify(
    JSON.parse(canonicalizePrivateRequest(value as PrivateRequestJson)).request,
  );
  if (new TextEncoder().encode(result).length > maxBytes)
    throw new TypeError("service JSON size limit");
  return result;
}
/** Existing JSON delivery evidence: SHA-256 of UTF-8 JSON.stringify(output).
 * Validate JSON bounds without changing application-owned property order. */
export function hashServiceOutput(value: unknown): Bytes32 {
  canonicalizeServiceJson(value, 1048576);
  return sha256(stringToHex(JSON.stringify(value)));
}
/** Bind bounded JSON to the request hash; business input rules belong to the service. */
export function normalizeServiceInvocation(value: unknown) {
  exact(value, ["version", "orderId", "requestHash", "request"]);
  if (
    value.version !== AGENTPAY_SERVICE_INVOCATION_VERSION ||
    !B32.test(String(value.orderId)) ||
    !B32.test(String(value.requestHash))
  )
    throw new TypeError("service invocation invalid");
  const request = JSON.parse(
    canonicalizeServiceJson(value.request),
  ) as PrivateRequestJson;
  if (hashPrivateRequest(request) !== value.requestHash)
    throw new TypeError("service request hash mismatch");
  return {
    version: AGENTPAY_SERVICE_INVOCATION_VERSION,
    orderId: value.orderId as Bytes32,
    requestHash: value.requestHash as Bytes32,
    request,
  };
}
/** Validate the evidence envelope, not output quality or permission to release funds. */
export function normalizeServiceResult(value: unknown) {
  exact(value, [
    "version",
    "orderId",
    "requestHash",
    "output",
    "outputHash",
    "usageUnits",
  ]);
  if (
    value.version !== AGENTPAY_SERVICE_RESULT_VERSION ||
    !B32.test(String(value.orderId)) ||
    !B32.test(String(value.requestHash)) ||
    !B32.test(String(value.outputHash)) ||
    typeof value.usageUnits !== "string" ||
    !/^(0|[1-9][0-9]{0,76})$/.test(value.usageUnits)
  )
    throw new TypeError("service result invalid");
  canonicalizeServiceJson(value.output, 1048576);
  const output = JSON.parse(JSON.stringify(value.output)) as PrivateRequestJson;
  if (hashServiceOutput(output) !== value.outputHash)
    throw new TypeError("service output hash mismatch");
  return {
    version: AGENTPAY_SERVICE_RESULT_VERSION,
    orderId: value.orderId as Bytes32,
    requestHash: value.requestHash as Bytes32,
    output,
    outputHash: value.outputHash as Bytes32,
    usageUnits: value.usageUnits,
  };
}
