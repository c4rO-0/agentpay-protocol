#!/usr/bin/env node

import { readFileSync, statSync } from "node:fs";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";

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

function requirePrivateRootFile(path) {
  const stat = statSync(path);
  if (!stat.isFile()) throw new Error("CDP secret source is not a regular file");
  if (stat.uid !== 0) throw new Error("CDP secret source must be owned by root");
  if ((stat.mode & 0o077) !== 0) {
    throw new Error("CDP secret source must not be accessible by group or others");
  }
}

function sanitizePublicData(value) {
  if (Array.isArray(value)) return value.map(sanitizePublicData);
  if (!value || typeof value !== "object") return value;

  const sensitiveKeys = new Set([
    "authorization",
    "authorizationHeader",
    "credential",
    "credentials",
    "password",
    "secret",
    "apiKey",
    "apiKeyId",
    "apiKeySecret",
    "jwt",
    "accessToken",
    "bearerToken"
  ]);
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (sensitiveKeys.has(key)) {
      result[key] = "[redacted]";
    } else {
      result[key] = sanitizePublicData(child);
    }
  }
  return result;
}

function safeErrorMessage(error, secrets) {
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
  const secretFile = requireValue(values, "CDP_API_KEY_SECRET_SOURCE_FILE");
  requirePrivateRootFile(secretFile);
  apiKeySecret = readFileSync(secretFile, "utf8").trim();
  if (!apiKeySecret) throw new Error("CDP secret source is empty");

  const facilitator = createCdpFacilitatorClient({
    baseUrl,
    apiKeyId,
    apiKeySecret
  });
  const supported = await facilitator.getSupported();

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "supported-only",
        facilitatorUrl: baseUrl,
        kinds: sanitizePublicData(Array.isArray(supported?.kinds) ? supported.kinds : []),
        extensions: sanitizePublicData(
          Array.isArray(supported?.extensions) ? supported.extensions : []
        ),
        signers: sanitizePublicData(supported?.signers || {})
      },
      null,
      2
    )
  );
} catch (error) {
  const status = Number(error?.status || error?.response?.status || 0) || null;
  console.error(
    JSON.stringify({
      ok: false,
      mode: "supported-only",
      error: {
        name: error?.name || "Error",
        status,
        message: safeErrorMessage(error, [apiKeyId, apiKeySecret])
      }
    })
  );
  process.exitCode = 1;
} finally {
  apiKeyId = "";
  apiKeySecret = "";
}
