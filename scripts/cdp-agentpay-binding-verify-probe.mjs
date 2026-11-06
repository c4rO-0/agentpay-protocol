#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";

const BASE_NETWORK = "eip155:8453";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const AGENTPAY_FACTORY = "0x0060FC1912872f4f65D33eE952FD88eB1C10F794";
const CANARY_SESSION_KEY = "0x8C8cd379E18C51640D2Dfd04846174a70881be5D";
const envFile = process.argv[2] || "/etc/agentpay/agentpay.env";

function parseSelectedEnvironment(path) {
  const selected = new Set([
    "X402_FACILITATOR_URL",
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET_SOURCE_FILE"
  ]);
  const result = {};
  for (const sourceLine of readFileSync(path, "utf8").split(/\r?\n/u)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (!selected.has(key)) continue;
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"')))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function requireValue(values, name) {
  const value = String(values[name] || "").trim();
  if (!value || value.startsWith("change-me")) {
    throw new Error(`${name} is missing or still a placeholder`);
  }
  return value;
}

function readRootSecret(path) {
  const stat = statSync(path);
  if (!stat.isFile()) throw new Error("CDP secret source is not a regular file");
  if (stat.uid !== 0) throw new Error("CDP secret source must be owned by root");
  if ((stat.mode & 0o077) !== 0) {
    throw new Error("CDP secret source must not be accessible by group or others");
  }
  const value = readFileSync(path, "utf8").trim();
  if (!value) throw new Error("CDP secret source is empty");
  return value;
}

function safeMessage(error, secrets) {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of secrets) {
    if (secret) message = message.split(secret).join("[redacted]");
  }
  return message.replace(/Bearer\s+[A-Za-z0-9._~-]+/giu, "Bearer [redacted]");
}

let apiKeyId = "";
let apiKeySecret = "";

try {
  const values = parseSelectedEnvironment(envFile);
  const baseUrl = requireValue(values, "X402_FACILITATOR_URL").replace(/\/+$/u, "");
  apiKeyId = requireValue(values, "CDP_API_KEY_ID");
  apiKeySecret = readRootSecret(
    requireValue(values, "CDP_API_KEY_SECRET_SOURCE_FILE")
  );

  const facilitator = createCdpFacilitatorClient({ baseUrl, apiKeyId, apiKeySecret });
  const supported = await facilitator.getSupported();
  const baseBatchKind = (supported?.kinds || []).find(
    kind =>
      kind?.x402Version === 2 &&
      kind?.scheme === "batch-settlement" &&
      kind?.network === BASE_NETWORK
  );
  const receiverAuthorizer = String(baseBatchKind?.extra?.receiverAuthorizer || "");
  if (!receiverAuthorizer) {
    throw new Error("CDP does not advertise a Base batch-settlement receiverAuthorizer");
  }

  const requirements = {
    scheme: "batch-settlement",
    network: BASE_NETWORK,
    asset: BASE_USDC,
    amount: "1",
    payTo: AGENTPAY_FACTORY,
    maxTimeoutSeconds: 300,
    extra: {
      receiverAuthorizer,
      withdrawDelay: 900,
      name: "USD Coin",
      version: "2"
    }
  };
  const paymentPayload = {
    x402Version: 2,
    accepted: requirements,
    payload: {
      type: "agentpay-commitment",
      commitment: {
        version: "phase0-canary-v0",
        safe: "0x0000000000000000000000000000000000000001",
        policyId: `0x${"00".repeat(32)}`,
        factory: AGENTPAY_FACTORY,
        orderId: `0x${"01".repeat(32)}`,
        vault: "0x0000000000000000000000000000000000000002",
        token: BASE_USDC,
        amount: "1",
        termsHash: `0x${"02".repeat(32)}`,
        commitmentNonce: `0x${"03".repeat(32)}`,
        validBefore: Math.floor(Date.now() / 1000) + 300,
        delegate: CANARY_SESSION_KEY
      },
      signature: "0x"
    }
  };

  const result = await facilitator.verify(paymentPayload, requirements);
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "verify-only-non-paying-draft",
        warning: "No signer was unlocked and no settlement request was made.",
        submitted: {
          x402Version: 2,
          scheme: requirements.scheme,
          network: requirements.network,
          payloadType: paymentPayload.payload.type,
          agentpayCommitmentVersion: paymentPayload.payload.commitment.version
        },
        verify: {
          isValid: result?.isValid === true,
          payer: result?.payer || null,
          invalidReason: result?.invalidReason || null,
          invalidMessage: result?.invalidMessage || null
        }
      },
      null,
      2
    )
  );
} catch (error) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const embeddedStatus = rawMessage.match(/failed \(([1-5][0-9]{2})\)/u)?.[1];
  const status =
    Number(error?.status || error?.response?.status || embeddedStatus || 0) || null;
  console.error(
    JSON.stringify({
      ok: false,
      mode: "verify-only-non-paying-draft",
      error: {
        name: error?.name || "Error",
        status,
        message: safeMessage(error, [apiKeyId, apiKeySecret])
      }
    })
  );
  process.exitCode = 1;
} finally {
  apiKeyId = "";
  apiKeySecret = "";
}
