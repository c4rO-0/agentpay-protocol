#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CDP_FACILITATOR_URL, createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createPublicClient, getAddress, http, isAddress, parseAbi } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const BASE_CHAIN_ID = "8453";
const BASE_USDC = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const SMOKE_AMOUNT = "1000";
const CONFIRMATION = "I_UNDERSTAND_THIS_SETTLES_1000_USDC";

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireAddress(name, value) {
  if (!isAddress(value)) throw new Error(`${name} must be an EVM address`);
  return getAddress(value);
}

function requirePositiveInteger(name, value) {
  if (!/^\d+$/.test(String(value || "")) || BigInt(value) <= 0n) {
    throw new Error(`${name} must be a positive integer string`);
  }
  return String(value);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(scriptDir, "..");
const recordPath = process.env.X402_ESCROW_SMOKE_RECORD_FILE?.trim()
  ? resolve(repoDir, process.env.X402_ESCROW_SMOKE_RECORD_FILE.trim())
  : resolve(repoDir, "deployments/x402-escrow-smoke.chain-8453.json");
const record = JSON.parse(readFileSync(recordPath, "utf8"));

if (String(record.chainId) !== BASE_CHAIN_ID) throw new Error(`smoke record must use Base mainnet chain ${BASE_CHAIN_ID}`);
const vaultAddress = requireAddress("record.vaultAddress", record.vaultAddress);
const buyer = requireAddress("record.buyer", record.buyer);
const token = requireAddress("record.token", record.token);
const amount = requirePositiveInteger("record.amount", record.amount);
if (token !== BASE_USDC) throw new Error(`smoke record token must be Base USDC ${BASE_USDC}`);
if (amount !== SMOKE_AMOUNT) throw new Error(`smoke record amount must be ${SMOKE_AMOUNT}`);

const privateKey = requiredEnv("X402_BUYER_PRIVATE_KEY");
const account = privateKeyToAccount(privateKey);
if (getAddress(account.address) !== buyer) {
  throw new Error(`X402_BUYER_PRIVATE_KEY address ${account.address} does not match smoke buyer ${buyer}`);
}

const now = BigInt(Math.floor(Date.now() / 1000));
if (BigInt(record.expiresAt) <= now) {
  throw new Error("smoke Vault is expired; create a new Vault before attempting settlement");
}

const rpcUrl = String(process.env.RPC_URL || record.rpcUrl || "https://mainnet.base.org").trim();
const maxTimeoutSeconds = Number(process.env.X402_MAX_TIMEOUT_SECONDS || "300");
if (!Number.isSafeInteger(maxTimeoutSeconds) || maxTimeoutSeconds <= 0) {
  throw new Error("X402_MAX_TIMEOUT_SECONDS must be a positive integer");
}

const requirements = {
  scheme: "exact",
  network: "eip155:8453",
  asset: BASE_USDC,
  amount: SMOKE_AMOUNT,
  payTo: vaultAddress,
  maxTimeoutSeconds,
  extra: { name: "USD Coin", version: "2" }
};
const paymentRequired = {
  x402Version: 2,
  resource: {
    url: "https://agentpay.local/x402-escrow-smoke",
    description: "AgentPay Base mainnet x402 escrow smoke settlement"
  },
  accepts: [requirements],
  extensions: {
    "agentpay-order": {
      version: "1",
      rail: "x402_exact_escrow",
      orderId: record.orderId,
      vault: vaultAddress,
      buyer,
      seller: record.seller,
      termsHash: record.termsHash
    },
    "payment-identifier": { id: `agentpay-x402-smoke-${record.orderId}` }
  }
};

const client = new x402Client().register("eip155:8453", new ExactEvmScheme(account, { rpcUrl }));
const paymentPayload = await client.createPaymentPayload(paymentRequired);
const facilitator = createCdpFacilitatorClient({
  baseUrl: String(process.env.X402_FACILITATOR_URL || CDP_FACILITATOR_URL).replace(/\/+$/, "")
});

console.log(JSON.stringify({
  ok: true,
  mode: "verify-before-settle",
  warning: `This script settles ${SMOKE_AMOUNT} Base USDC only when X402_CONFIRM_SETTLE=${CONFIRMATION}.`,
  recordPath,
  buyer: account.address,
  requirements
}, null, 2));

const verify = await facilitator.verify(paymentPayload, requirements);
console.log(JSON.stringify({ ok: true, verify }, null, 2));
if (!verify.isValid) {
  throw new Error(`facilitator verification failed: ${verify.invalidReason || verify.invalidMessage || "unknown reason"}`);
}

if (String(process.env.X402_CONFIRM_SETTLE || "").trim() !== CONFIRMATION) {
  console.log(`NOT SETTLED: set X402_CONFIRM_SETTLE=${CONFIRMATION} to settle exactly ${SMOKE_AMOUNT} Base USDC into ${vaultAddress}.`);
  process.exit(0);
}

console.log(`SETTLEMENT CONFIRMED: calling CDP /settle for ${SMOKE_AMOUNT} Base USDC to ${vaultAddress}.`);
const settled = await facilitator.settle(paymentPayload, requirements);
console.log(JSON.stringify({ ok: settled.success, settle: settled }, null, 2));
if (!settled.success) {
  throw new Error(`facilitator settlement failed: ${settled.errorReason || settled.errorMessage || "unknown reason"}`);
}

const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) });
const receipt = await publicClient.waitForTransactionReceipt({ hash: settled.transaction });
const expectedBalance = BigInt(SMOKE_AMOUNT);
let vaultUsdcBalance = 0n;
const balanceDeadline = Date.now() + 30_000;
do {
  vaultUsdcBalance = await publicClient.readContract({
    address: BASE_USDC,
    abi: parseAbi(["function balanceOf(address) view returns (uint256)" ]),
    functionName: "balanceOf",
    args: [vaultAddress]
  });
  if (vaultUsdcBalance >= expectedBalance) break;
  await new Promise((resolve) => setTimeout(resolve, 1_000));
} while (Date.now() < balanceDeadline);
if (vaultUsdcBalance < expectedBalance) {
  throw new Error(`settlement transaction succeeded but Vault balance remained ${vaultUsdcBalance}; inspect ${settled.transaction} before retrying`);
}
const settlementRecord = {
  schema: "agentpay.x402-escrow-settle-smoke.v1",
  settledAt: new Date().toISOString(),
  vaultAddress,
  buyer,
  amount: SMOKE_AMOUNT,
  facilitator: String(process.env.X402_FACILITATOR_URL || CDP_FACILITATOR_URL).replace(/\/+$/, ""),
  facilitatorTransaction: settled.transaction,
  receiptStatus: receipt.status,
  receiptBlockNumber: receipt.blockNumber.toString(),
  vaultUsdcBalance: vaultUsdcBalance.toString(),
  facilitatorResponse: settled
};
const outFile = resolve(repoDir, "deployments/x402-escrow-settle-smoke.chain-8453.json");
writeFileSync(outFile, `${JSON.stringify(settlementRecord, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ok: true, outFile, vaultUsdcBalance: vaultUsdcBalance.toString(), receiptStatus: receipt.status }, null, 2));
