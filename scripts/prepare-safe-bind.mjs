import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, padHex } from "viem";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(scriptDir, "..");

const DEAL_MANAGER_ABI = [
  {
    type: "function",
    name: "createDeal",
    stateMutability: "nonpayable",
    inputs: [{
      name: "terms",
      type: "tuple",
      components: [
        { name: "dealId", type: "bytes32" },
        { name: "userSafe", type: "address" },
        { name: "mcpSafe", type: "address" },
        { name: "settlement", type: "address" },
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "fee", type: "uint256" },
        { name: "maxRefund", type: "uint256" },
        { name: "maxLiability", type: "uint256" },
        { name: "gracePeriodEnd", type: "uint64" },
        { name: "deadline", type: "uint64" },
        { name: "userNonce", type: "uint256" },
        { name: "mcpNonce", type: "uint256" }
      ]
    }],
    outputs: [{ name: "", type: "bytes32" }]
  },
  {
    type: "function",
    name: "approveUserParticipation",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "approveMcpParticipation",
    stateMutability: "nonpayable",
    inputs: [{ name: "dealId", type: "bytes32" }],
    outputs: []
  }
];

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

function requireBigInt(name, defaultValue) {
  const raw = process.env[name]?.trim() || defaultValue;
  try {
    return BigInt(raw);
  } catch {
    throw new Error(`${name} must be an integer string`);
  }
}

function requireNumber(name, defaultValue) {
  const raw = process.env[name]?.trim() || defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

async function resolveChainId() {
  if (process.env.CHAIN_ID?.trim()) return Number.parseInt(process.env.CHAIN_ID.trim(), 10);
  const rpcUrl = requireEnv("RPC_URL");
  const client = createPublicClient({ transport: http(rpcUrl) });
  return Number(await client.getChainId());
}

async function main() {
  const chainId = await resolveChainId();
  const rpcUrl = requireEnv("RPC_URL");
  const dealManagerAddress = requireAddress("DEAL_MANAGER_ADDRESS");
  const userSafe = requireAddress("USER_SAFE_ADDRESS");
  const mcpSafe = requireAddress("MCP_SAFE_ADDRESS");
  const settlement = requireAddress(process.env.SETTLEMENT_EXECUTOR_ADDRESS?.trim() ? "SETTLEMENT_EXECUTOR_ADDRESS" : "SETTLEMENT_ADDRESS");
  const token = requireAddress("TOKEN_ADDRESS");

  const outputPath = process.env.SAFE_BIND_BUNDLE_FILE?.trim()
    ? resolve(repoDir, process.env.SAFE_BIND_BUNDLE_FILE.trim())
    : resolve(repoDir, `deployments/safe-bind.bundle.chain-${chainId}.json`);

  let existingTerms = null;
  try {
    const existing = JSON.parse(readFileSync(outputPath, "utf8"));
    if (existing && existing.terms) existingTerms = existing.terms;
  } catch {}

  const defaultAmount = existingTerms?.amount || process.env.DEAL_AMOUNT?.trim() || "1000000";
  const defaultFee = existingTerms?.fee || process.env.DEAL_FEE?.trim() || "100000";
  const defaultMaxRefund = existingTerms?.maxRefund || process.env.DEAL_MAX_REFUND?.trim() || defaultAmount;
  const defaultMaxLiability = existingTerms?.maxLiability || process.env.DEAL_MAX_LIABILITY?.trim() || defaultAmount;
  const defaultGrace = existingTerms?.gracePeriodEnd || String(Math.floor(Date.now() / 1000) + 7200);
  const defaultDeadline = existingTerms?.deadline || String(Math.floor(Date.now() / 1000) + 86400);
  const defaultUserNonce = existingTerms?.userNonce || "1";
  const defaultMcpNonce = existingTerms?.mcpNonce || "1";

  const terms = {
    dealId: process.env.DEAL_ID?.trim() || existingTerms?.dealId || padHex(`0x${randomBytes(32).toString("hex")}`, { size: 32 }),
    userSafe,
    mcpSafe,
    settlement,
    token,
    amount: requireBigInt("DEAL_AMOUNT", defaultAmount),
    fee: requireBigInt("DEAL_FEE", defaultFee),
    maxRefund: requireBigInt("DEAL_MAX_REFUND", defaultMaxRefund),
    maxLiability: requireBigInt("DEAL_MAX_LIABILITY", defaultMaxLiability),
    gracePeriodEnd: BigInt(requireNumber("DEAL_GRACE_PERIOD_END", String(defaultGrace))),
    deadline: BigInt(requireNumber("DEAL_DEADLINE", String(defaultDeadline))),
    userNonce: requireBigInt("DEAL_USER_NONCE", defaultUserNonce),
    mcpNonce: requireBigInt("DEAL_MCP_NONCE", defaultMcpNonce)
  };

  const settlementTransactions = {
    createDeal: {
      label: "create-deal",
      to: dealManagerAddress,
      value: "0",
      data: encodeFunctionData({ abi: DEAL_MANAGER_ABI, functionName: "createDeal", args: [terms] })
    }
  };

  const userApprovalTransaction = {
    label: "approve-user-participation",
    to: dealManagerAddress,
    value: "0",
    data: encodeFunctionData({ abi: DEAL_MANAGER_ABI, functionName: "approveUserParticipation", args: [terms.dealId] })
  };

  const mcpApprovalTransaction = {
    label: "approve-mcp-participation",
    to: dealManagerAddress,
    value: "0",
    data: encodeFunctionData({ abi: DEAL_MANAGER_ABI, functionName: "approveMcpParticipation", args: [terms.dealId] })
  };

  const bundle = {
    ok: true,
    mode: "safe-bind-prepare",
    chainId,
    rpcUrl,
    dealManagerAddress,
    terms: {
      ...terms,
      amount: terms.amount.toString(),
      fee: terms.fee.toString(),
      maxRefund: terms.maxRefund.toString(),
      maxLiability: terms.maxLiability.toString(),
      gracePeriodEnd: Number(terms.gracePeriodEnd),
      deadline: Number(terms.deadline),
      userNonce: terms.userNonce.toString(),
      mcpNonce: terms.mcpNonce.toString()
    },
    settlementTransactions,
    userApprovalTransaction,
    mcpApprovalTransaction
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote Safe bind bundle to ${outputPath}\n`);
  process.stdout.write("Bundle includes createDeal plus direct Safe approval transactions for userSafe and mcpSafe.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
