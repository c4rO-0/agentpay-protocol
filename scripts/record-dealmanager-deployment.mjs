import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress } from "viem";

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireAddress(name) {
  const value = requireEnv(name);
  if (!isAddress(value)) throw new Error(`${name} must be an address`);
  return getAddress(value);
}

const chainId = requireEnv("CHAIN_ID");
const rpcUrl = requireEnv("RPC_URL");
const dealManagerAddress = requireAddress("DEAL_MANAGER_ADDRESS");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const deploymentsDir = resolve(scriptDir, "../deployments");
mkdirSync(deploymentsDir, { recursive: true });

const outFile = resolve(deploymentsDir, `safe.chain-${chainId}.env`);
const content = [
  `# recorded by scripts/record-dealmanager-deployment.mjs at ${new Date().toISOString()}`,
  `CHAIN_ID=${chainId}`,
  `RPC_URL=${rpcUrl}`,
  `DEAL_MANAGER_ADDRESS=${dealManagerAddress}`
].join("\n") + "\n";

writeFileSync(outFile, content, "utf8");
process.stdout.write(JSON.stringify({ ok: true, outFile, dealManagerAddress, chainId }, null, 2) + "\n");
