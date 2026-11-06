import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAddress, isAddress } from "viem";

function requireValue(name, value) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function address(name, value) {
  if (!isAddress(value)) throw new Error(`${name} must be an address`);
  return getAddress(value);
}

function bytes32(name, value) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be bytes32 hex`);
  return value.toLowerCase();
}

function positiveInteger(name, value, allowZero = false) {
  if (!/^\d+$/.test(String(value)) || (!allowZero && BigInt(value) === 0n)) {
    throw new Error(`${name} must be ${allowZero ? "a non-negative" : "a positive"} integer string`);
  }
  return String(value);
}

const raw = requireValue("X402_ESCROW_SMOKE_RECORD", process.env.X402_ESCROW_SMOKE_RECORD?.trim());
let input;
try { input = JSON.parse(raw); } catch { throw new Error("X402_ESCROW_SMOKE_RECORD must contain JSON copied from the smoke page"); }

const record = {
  schema: "agentpay.x402-escrow-smoke.v1",
  recordedAt: new Date().toISOString(),
  chainId: positiveInteger("chainId", input.chainId),
  rpcUrl: requireValue("rpcUrl", String(input.rpcUrl || "").trim()),
  factoryAddress: address("factoryAddress", input.factoryAddress),
  vaultAddress: address("vaultAddress", input.vaultAddress),
  createVaultTxHash: requireValue("createVaultTxHash", String(input.createVaultTxHash || "").trim()),
  orderId: bytes32("orderId", input.orderId),
  termsHash: bytes32("termsHash", input.termsHash),
  buyer: address("buyer", input.buyer),
  seller: address("seller", input.seller),
  token: address("token", input.token),
  settlementAuthority: address("settlementAuthority", input.settlementAuthority),
  feeRecipient: address("feeRecipient", input.feeRecipient),
  amount: positiveInteger("amount", input.amount),
  maxFeeAmount: positiveInteger("maxFeeAmount", input.maxFeeAmount, true),
  expiresAt: positiveInteger("expiresAt", input.expiresAt),
  refundAvailableAt: positiveInteger("refundAvailableAt", input.refundAvailableAt),
  blockNumber: positiveInteger("blockNumber", input.blockNumber)
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const deploymentsDir = resolve(scriptDir, "../deployments");
mkdirSync(deploymentsDir, { recursive: true });
const outFile = resolve(deploymentsDir, `x402-escrow-smoke.chain-${record.chainId}.json`);
writeFileSync(outFile, `${JSON.stringify(record, null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({ ok: true, outFile, factoryAddress: record.factoryAddress, vaultAddress: record.vaultAddress }, null, 2) + "\n");
