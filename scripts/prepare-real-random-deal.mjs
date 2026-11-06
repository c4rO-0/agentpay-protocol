import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, encodeFunctionData, getAddress, http, isAddress, padHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

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
    name: "markReadyBySettlement",
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

function requireBigInt(name, fallback) {
  const raw = process.env[name]?.trim() || fallback;
  try {
    return BigInt(raw);
  } catch {
    throw new Error(`${name} must be an integer string`);
  }
}

function requireHexPrivateKey(name) {
  let value = requireEnv(name);
  if (!value.startsWith("0x")) value = `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be a 32-byte hex private key`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const rpcUrl = requireEnv("RPC_URL");
  const chainId = Number.parseInt(process.env.CHAIN_ID?.trim() || "8453", 10);
  const dealManagerAddress = requireAddress("DEAL_MANAGER_ADDRESS");
  const userSafe = requireAddress("USER_SAFE_ADDRESS");
  const mcpSafe = requireAddress("MCP_SAFE_ADDRESS");
  const settlementExecutor = requireAddress(process.env.SETTLEMENT_EXECUTOR_ADDRESS?.trim() ? "SETTLEMENT_EXECUTOR_ADDRESS" : "SETTLEMENT_ADDRESS");
  const token = requireAddress(process.env.SETTLEMENT_TOKEN_ADDRESS?.trim() ? "SETTLEMENT_TOKEN_ADDRESS" : "TOKEN_ADDRESS");
  const privateKey = requireHexPrivateKey(process.env.SETTLEMENT_EXECUTOR_PRIVATE_KEY?.trim() ? "SETTLEMENT_EXECUTOR_PRIVATE_KEY" : "SETTLEMENT_PRIVATE_KEY");
  const amount = requireBigInt("DEAL_AMOUNT", "1000000");
  const fee = requireBigInt("DEAL_FEE", "100000");
  const maxRefund = requireBigInt("DEAL_MAX_REFUND", amount.toString());
  const maxLiability = requireBigInt("DEAL_MAX_LIABILITY", amount.toString());
  const graceSeconds = Number.parseInt(process.env.DEAL_GRACE_PERIOD_SECONDS?.trim() || "7200", 10);
  const deadlineSeconds = Number.parseInt(process.env.DEAL_DEADLINE_SECONDS?.trim() || "86400", 10);
  const prompt = process.env.DEAL_PROMPT?.trim() || "Generate a random number for a real deal flow.";
  const mcpBaseUrl = process.env.RANDOM_MCP_DEMO_BASE_URL?.trim() || "http://127.0.0.1:7789";

  const account = privateKeyToAccount(privateKey);
  if (getAddress(account.address) !== settlementExecutor) {
    throw new Error(`settlement executor private key address ${account.address} does not match settlement executor ${settlementExecutor}`);
  }

  const outputPath = process.env.REAL_DEAL_BUNDLE_FILE?.trim()
    ? resolve(repoDir, process.env.REAL_DEAL_BUNDLE_FILE.trim())
    : resolve(repoDir, `deployments/real-random-deal.bundle.chain-${chainId}.json`);

  const now = Math.floor(Date.now() / 1000);
  const terms = {
    dealId: process.env.DEAL_ID?.trim() || padHex(`0x${randomBytes(32).toString("hex")}`, { size: 32 }),
    userSafe,
    mcpSafe,
    settlement: settlementExecutor,
    token,
    amount,
    fee,
    maxRefund,
    maxLiability,
    gracePeriodEnd: BigInt(now + graceSeconds),
    deadline: BigInt(now + deadlineSeconds),
    userNonce: requireBigInt("DEAL_USER_NONCE", "1"),
    mcpNonce: requireBigInt("DEAL_MCP_NONCE", "1")
  };

  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });

  const bytecode = await publicClient.getBytecode({ address: dealManagerAddress });
  if (!bytecode || bytecode === "0x") {
    throw new Error(`DEAL_MANAGER_ADDRESS ${dealManagerAddress} has no contract bytecode on current RPC (${rpcUrl})`);
  }


  const createDealTxHash = await walletClient.writeContract({
    address: dealManagerAddress,
    abi: DEAL_MANAGER_ABI,
    functionName: "createDeal",
    args: [terms]
  });
  const createDealReceipt = await publicClient.waitForTransactionReceipt({ hash: createDealTxHash });
  if (createDealReceipt.status !== "success") {
    throw new Error(`createDeal reverted: tx=${createDealTxHash}`);
  }

  let createdDeal;
  let persistedDealId;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      createdDeal = await publicClient.readContract({
        address: dealManagerAddress,
        abi: [
          {
            type: "function",
            name: "getDeal",
            stateMutability: "view",
            inputs: [{ name: "dealId", type: "bytes32" }],
            outputs: [{
              name: "",
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
                { name: "mcpNonce", type: "uint256" },
                { name: "status", type: "uint8" },
                { name: "userBound", type: "bool" },
                { name: "mcpBound", type: "bool" },
                { name: "authorizationMode", type: "uint8" },
                { name: "fundedAmount", type: "uint256" },
                { name: "releasedAmount", type: "uint256" },
                { name: "feePaid", type: "uint256" },
                { name: "refundedAmount", type: "uint256" },
                { name: "chargebackAmount", type: "uint256" }
              ]
            }]
          }
        ],
        functionName: "getDeal",
        args: [terms.dealId]
      });
      persistedDealId = typeof createdDeal === "object" && createdDeal !== null
        ? (createdDeal.dealId ?? createdDeal[0])
        : undefined;
      if ((persistedDealId || "").toLowerCase() === terms.dealId.toLowerCase()) break;
    } catch {}
    await sleep(800);
  }

  if ((persistedDealId || "").toLowerCase() !== terms.dealId.toLowerCase()) {
    const safeReadback = createdDeal
      ? JSON.stringify(createdDeal, (_, value) => typeof value === "bigint" ? value.toString() : value)
      : "<unavailable>";
    throw new Error(`createDeal did not persist deal ${terms.dealId}; tx=${createDealTxHash}; readback=${safeReadback}`);
  }

  const markReadyData = encodeFunctionData({ abi: DEAL_MANAGER_ABI, functionName: "markReadyBySettlement", args: [terms.dealId] });
  const markReadyTxHash = await walletClient.sendTransaction({
    to: dealManagerAddress,
    data: markReadyData,
    gas: 300000n
  });
  const markReadyReceipt = await publicClient.waitForTransactionReceipt({ hash: markReadyTxHash });

  const bundle = {
    ok: true,
    mode: "real-random-deal-prepare",
    chainId,
    rpcUrl,
    dealManagerAddress,
    settlementExecutor,
    token,
    mcpBaseUrl,
    prompt,
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
    settlementTransactions: {
      createDeal: {
        label: "create-deal",
        to: dealManagerAddress,
        value: "0",
        txHash: createDealTxHash,
        blockNumber: createDealReceipt.blockNumber.toString()
      },
      markReadyBySettlement: {
        label: "mark-ready-by-settlement",
        to: dealManagerAddress,
        value: "0",
        txHash: markReadyTxHash,
        blockNumber: markReadyReceipt.blockNumber.toString(),
        data: encodeFunctionData({ abi: DEAL_MANAGER_ABI, functionName: "markReadyBySettlement", args: [terms.dealId] })
      }
    }
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
  process.stdout.write(`Wrote real deal bundle to ${outputPath}\n`);
  process.stdout.write(`createDeal tx: ${createDealTxHash}\n`);
  process.stdout.write(`dealId: ${terms.dealId}\n`);
  process.stdout.write("Next: run node scripts/settle-real-random-deal.mjs to pull funds, mark funded, call the MCP demo, pay the MCP, and release the deal.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
