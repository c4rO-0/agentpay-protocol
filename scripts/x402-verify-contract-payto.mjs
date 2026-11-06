#!/usr/bin/env node
import { CDP_FACILITATOR_URL, createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { x402Client } from "@x402/core/client";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { getAddress, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalEnv(name, fallback = "") {
  const value = String(process.env[name] || "").trim();
  return value || fallback;
}

function requireAddress(name, value) {
  if (!isAddress(value)) {
    throw new Error(`${name} must be a 0x-prefixed EVM address`);
  }
  return getAddress(value);
}

function requirePositiveInteger(name, value) {
  if (!/^[0-9]+$/.test(String(value || "")) || BigInt(value) <= 0n) {
    throw new Error(`${name} must be a positive integer string`);
  }
  return String(value);
}

function createAuthHeaders(token) {
  if (!token) return undefined;
  return async () => {
    const headers = { Authorization: `Bearer ${token}` };
    return { verify: headers, supported: headers };
  };
}

const facilitatorProvider = optionalEnv(
  "X402_FACILITATOR_PROVIDER",
  process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET ? "cdp" : "http"
);
const facilitatorUrl = optionalEnv(
  "X402_FACILITATOR_URL",
  facilitatorProvider === "cdp" ? CDP_FACILITATOR_URL : "https://x402.org/facilitator"
).replace(/\/+$/, "");
const facilitatorAuthToken = optionalEnv("X402_FACILITATOR_AUTH_TOKEN");
const privateKey = requiredEnv("X402_BUYER_PRIVATE_KEY");
const rpcUrl = optionalEnv("RPC_URL");
const network = optionalEnv("X402_NETWORK", "eip155:8453");
const asset = requireAddress(
  "X402_ASSET",
  optionalEnv("X402_ASSET", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
);
const payTo = requireAddress("X402_PAY_TO", requiredEnv("X402_PAY_TO"));
const amount = requirePositiveInteger("X402_AMOUNT", optionalEnv("X402_AMOUNT", "1000"));
const maxTimeoutSeconds = Number(optionalEnv("X402_MAX_TIMEOUT_SECONDS", "300"));
const tokenDomainName = optionalEnv("X402_TOKEN_DOMAIN_NAME", "USD Coin");
const tokenDomainVersion = optionalEnv("X402_TOKEN_DOMAIN_VERSION", "2");

if (!Number.isSafeInteger(maxTimeoutSeconds) || maxTimeoutSeconds <= 0) {
  throw new Error("X402_MAX_TIMEOUT_SECONDS must be a positive integer");
}

const account = privateKeyToAccount(privateKey);
const requirements = {
  scheme: "exact",
  network,
  asset,
  amount,
  payTo,
  maxTimeoutSeconds,
  extra: {
    name: tokenDomainName,
    version: tokenDomainVersion
  }
};

const paymentRequired = {
  x402Version: 2,
  resource: {
    url: optionalEnv("X402_RESOURCE_URL", "https://agentpay.local/x402-contract-payto-precheck"),
    description: "AgentPay x402 contract payTo verify-only precheck"
  },
  accepts: [requirements],
  extensions: {
    "agentpay-payto-precheck": {
      version: "1",
      purpose: "verify-only-contract-payto",
      warning: "do-not-settle-this-payload"
    }
  }
};

const client = new x402Client().register(
  network,
  new ExactEvmScheme(account, rpcUrl ? { rpcUrl } : undefined)
);
const paymentPayload = await client.createPaymentPayload(paymentRequired);

let facilitator;
if (facilitatorProvider === "cdp") {
  facilitator = createCdpFacilitatorClient({
    baseUrl: facilitatorUrl || CDP_FACILITATOR_URL
  });
} else if (facilitatorProvider === "http") {
  facilitator = new HTTPFacilitatorClient({
    url: facilitatorUrl,
    timeoutMs: Number(optionalEnv("X402_FACILITATOR_TIMEOUT_MS", "30000")),
    createAuthHeaders: createAuthHeaders(facilitatorAuthToken)
  });
} else {
  throw new Error("X402_FACILITATOR_PROVIDER must be either cdp or http");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      mode: "verify-only",
      warning: "This script calls /verify only. It never calls /settle.",
      facilitatorProvider,
      facilitatorUrl,
      buyer: account.address,
      requirements
    },
    null,
    2
  )
);

try {
  const result = await facilitator.verify(paymentPayload, requirements);
  console.log(JSON.stringify({ ok: true, verify: result }, null, 2));
  if (result.isValid) {
    console.log("RESULT: facilitator /verify accepted this contract payTo payload.");
  } else {
    console.log("RESULT: facilitator /verify returned invalid. Inspect invalidReason/invalidMessage.");
  }
} catch (err) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: {
          name: err?.name || "Error",
          message: err?.message || String(err),
          status: err?.status || null,
          response: err?.response || null
        }
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}
