#!/usr/bin/env node

import { privateKeyToAccount } from "viem/accounts";

function usage(message) {
  if (message) {
    console.error(`[runtime-signer-bridge] ${message}`);
  }
  console.error("usage: node scripts/runtime-signer-bridge.mjs <address|sign> [--private-key 0x...]");
  process.exit(1);
}

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && idx + 1 < process.argv.length) {
    return String(process.argv[idx + 1] || "").trim();
  }
  return "";
}

function readPrivateKey() {
  const raw =
    argValue("--private-key") ||
    process.env.SIGNER_PRIVATE_KEY?.trim() ||
    "";
  if (!raw) {
    usage("missing private key: set SIGNER_PRIVATE_KEY or pass --private-key");
  }
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const cmd = String(process.argv[2] || "").trim();
  if (!cmd) {
    usage();
  }
  const account = privateKeyToAccount(readPrivateKey());
  if (cmd === "address") {
    process.stdout.write(`${account.address}\n`);
    return;
  }
  if (cmd === "sign") {
    const message = (await readStdin()).trim();
    if (!message) {
      usage("missing message on stdin for sign");
    }
    const signature = await account.signMessage({ message });
    process.stdout.write(`${signature}\n`);
    return;
  }
  usage(`unknown command: ${cmd}`);
}

main().catch((err) => {
  console.error("[runtime-signer-bridge] failed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
