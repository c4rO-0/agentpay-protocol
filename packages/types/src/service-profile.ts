import { keccak256, stringToHex } from "viem";

import type { Bytes32 } from "./x402-escrow.js";

export const AGENTPAY_SERVICE_PROFILE_VERSION =
  "agentpay.service-profile.v1" as const;

export interface AgentPayServiceProfile {
  version: typeof AGENTPAY_SERVICE_PROFILE_VERSION;
  providerId: string;
  serviceId: string;
  mcpEndpoint: string;
  paymentEndpoint: string;
  seller: string;
  network: `eip155:${number}`;
  asset: string;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SERVICE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,190}$/;
const NETWORK = /^eip155:[1-9][0-9]*$/;
const FIELDS = [
  "asset",
  "mcpEndpoint",
  "network",
  "paymentEndpoint",
  "providerId",
  "seller",
  "serviceId",
  "version",
];

/** A challenged MCP invoke URL determines the native payment URL exactly. */
export function paymentEndpointForService(
  mcpEndpoint: string,
  serviceId: string,
): string {
  if (!SERVICE_ID.test(serviceId))
    throw new TypeError("serviceId has invalid canonical format");
  const url = new URL(mcpEndpoint);
  const servicePath = `/services/${encodeURIComponent(serviceId)}/mcp/invoke`;
  const prefix = url.pathname.endsWith(servicePath)
    ? url.pathname.slice(0, -servicePath.length)
    : null;
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /[?#]/.test(mcpEndpoint) ||
    prefix === null ||
    !/^(?:\/[A-Za-z0-9_-]+)*$/.test(prefix) ||
    url.toString() !== mcpEndpoint
  ) {
    throw new TypeError(
      "mcpEndpoint is not a canonical controlled service URL",
    );
  }
  return `${url.origin}${prefix}/services/${encodeURIComponent(serviceId)}/agentpay/invoke`;
}

/** Exact v1 public service identity bytes. Prices and author packages are excluded. */
export function canonicalizeServiceProfile(
  input: AgentPayServiceProfile,
): string {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).sort().join(",") !== FIELDS.join(",")
  ) {
    throw new TypeError("service profile fields are invalid");
  }
  if (
    input.version !== AGENTPAY_SERVICE_PROFILE_VERSION ||
    typeof input.providerId !== "string" ||
    !/^provider:[A-Za-z0-9:._-]{1,183}$/.test(input.providerId) ||
    typeof input.serviceId !== "string" ||
    !SERVICE_ID.test(input.serviceId) ||
    typeof input.network !== "string" ||
    !NETWORK.test(input.network) ||
    !ADDRESS.test(input.seller) ||
    !ADDRESS.test(input.asset)
  ) {
    throw new TypeError("service profile identity is invalid");
  }
  const paymentEndpoint = paymentEndpointForService(
    input.mcpEndpoint,
    input.serviceId,
  );
  if (input.paymentEndpoint !== paymentEndpoint) {
    throw new TypeError("paymentEndpoint differs from the challenged service");
  }
  return JSON.stringify({
    asset: input.asset.toLowerCase(),
    mcpEndpoint: input.mcpEndpoint,
    network: input.network,
    paymentEndpoint,
    providerId: input.providerId,
    seller: input.seller.toLowerCase(),
    serviceId: input.serviceId,
    version: AGENTPAY_SERVICE_PROFILE_VERSION,
  });
}

export function hashServiceProfile(profile: AgentPayServiceProfile): Bytes32 {
  return keccak256(stringToHex(canonicalizeServiceProfile(profile)));
}
