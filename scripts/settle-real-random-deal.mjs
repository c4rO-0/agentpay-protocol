import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, getAddress, http, isAddress, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(scriptDir, "..");

const DEAL_MANAGER_ABI = [
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
  },
  { type: "function", name: "markFunded", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }, { name: "fundedAmount", type: "uint256" }], outputs: [] },
  { type: "function", name: "releaseToMcp", stateMutability: "nonpayable", inputs: [{ name: "dealId", type: "bytes32" }, { name: "grossAmount", type: "uint256" }, { name: "feeAmount", type: "uint256" }], outputs: [] }
];

const SAFE_ABI = [
  {
    type: "function",
    name: "getModulesPaginated",
    stateMutability: "view",
    inputs: [{ name: "start", type: "address" }, { name: "pageSize", type: "uint256" }],
    outputs: [{ name: "array", type: "address[]" }, { name: "next", type: "address" }]
  }
];

const ALLOWANCE_MODULE_ABI = [
  {
    type: "function",
    name: "getTokenAllowance",
    stateMutability: "view",
    inputs: [{ name: "safe", type: "address" }, { name: "delegate", type: "address" }, { name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256[5]" }]
  },
  {
    type: "function",
    name: "generateTransferHash",
    stateMutability: "view",
    inputs: [
      { name: "safe", type: "address" },
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint96" },
      { name: "paymentToken", type: "address" },
      { name: "payment", type: "uint96" },
      { name: "nonce", type: "uint16" }
    ],
    outputs: [{ name: "", type: "bytes32" }]
  },
  {
    type: "function",
    name: "executeAllowanceTransfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "safe", type: "address" },
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint96" },
      { name: "paymentToken", type: "address" },
      { name: "payment", type: "uint96" },
      { name: "delegate", type: "address" },
      { name: "signature", type: "bytes" }
    ],
    outputs: []
  }
];

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
]);

const MODULES_SENTINEL = '0x0000000000000000000000000000000000000001';
const STATUS = { None: 0, Created: 1, Ready: 2, GracePeriod: 3, Released: 4, Disputed: 5, Refunded: 6, Chargeback: 7, Closed: 8, Cancelled: 9 };

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireHexPrivateKey(name) {
  let value = requireEnv(name);
  if (!value.startsWith('0x')) value = `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be a 32-byte hex private key`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok || payload?.ok === false) {
    throw new Error(`request failed for ${url}: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload.result;
}

async function main() {
  const rpcUrl = requireEnv('RPC_URL');
  const chainId = Number.parseInt(process.env.CHAIN_ID?.trim() || '8453', 10);
  const bundlePath = process.env.REAL_DEAL_BUNDLE_FILE?.trim()
    ? resolve(repoDir, process.env.REAL_DEAL_BUNDLE_FILE.trim())
    : resolve(repoDir, `deployments/real-random-deal.bundle.chain-${chainId}.json`);
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));

  const privateKey = requireHexPrivateKey(process.env.SETTLEMENT_EXECUTOR_PRIVATE_KEY?.trim() ? 'SETTLEMENT_EXECUTOR_PRIVATE_KEY' : 'SETTLEMENT_PRIVATE_KEY');
  const account = privateKeyToAccount(privateKey);
  const settlementExecutor = getAddress(bundle.settlementExecutor);
  if (getAddress(account.address) !== settlementExecutor) {
    throw new Error(`settlement executor private key address ${account.address} does not match settlement executor ${settlementExecutor}`);
  }

  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });

  const deal = await publicClient.readContract({
    address: getAddress(bundle.dealManagerAddress),
    abi: DEAL_MANAGER_ABI,
    functionName: 'getDeal',
    args: [bundle.terms.dealId]
  });

  const amount = BigInt(bundle.terms.amount);
  const dealStatus = Number(deal.status);
  let allowanceModuleAddress = null;
  let pullTxHash = null;
  let pullReceiptStatus = null;
  let markFundedTxHash = null;
  let markFundedReceiptStatus = null;

  if (dealStatus === STATUS.Ready) {
    const modules = [];
    let cursor = MODULES_SENTINEL;
    for (let i = 0; i < 10; i += 1) {
      const [page, next] = await publicClient.readContract({
        address: getAddress(bundle.terms.userSafe),
        abi: SAFE_ABI,
        functionName: 'getModulesPaginated',
        args: [cursor, 50n]
      });
      modules.push(...page.map(getAddress));
      if (next.toLowerCase() === MODULES_SENTINEL.toLowerCase()) break;
      cursor = next;
    }

    let allowanceTuple = null;
    for (const moduleAddress of modules) {
      try {
        const tuple = await publicClient.readContract({
          address: moduleAddress,
          abi: ALLOWANCE_MODULE_ABI,
          functionName: 'getTokenAllowance',
          args: [getAddress(bundle.terms.userSafe), settlementExecutor, getAddress(bundle.token)]
        });
        const normalized = tuple.map((value) => BigInt(value));
        if (normalized[0] > 0n) {
          allowanceModuleAddress = moduleAddress;
          allowanceTuple = normalized;
          break;
        }
      } catch {}
    }

    if (!allowanceModuleAddress || !allowanceTuple) {
      throw new Error('No allowance module with a positive allowance for the settlement executor was found on userSafe');
    }

    const [totalAllowance, spent, , , nonce] = allowanceTuple;
    const remaining = totalAllowance > spent ? totalAllowance - spent : 0n;
    if (remaining < amount) {
      throw new Error(`deal amount ${amount} exceeds remaining allowance ${remaining}`);
    }

    const paymentToken = '0x0000000000000000000000000000000000000000';
    const payment = 0n;
    const transferHash = await publicClient.readContract({
      address: allowanceModuleAddress,
      abi: ALLOWANCE_MODULE_ABI,
      functionName: 'generateTransferHash',
      args: [getAddress(bundle.terms.userSafe), getAddress(bundle.token), settlementExecutor, amount, paymentToken, payment, Number(nonce)]
    });
    const signature = await account.sign({ hash: transferHash });

    pullTxHash = await walletClient.writeContract({
      address: allowanceModuleAddress,
      abi: ALLOWANCE_MODULE_ABI,
      functionName: 'executeAllowanceTransfer',
      args: [
        getAddress(bundle.terms.userSafe),
        getAddress(bundle.token),
        settlementExecutor,
        amount,
        paymentToken,
        payment,
        settlementExecutor,
        signature
      ]
    });
    const pullReceipt = await publicClient.waitForTransactionReceipt({ hash: pullTxHash });
    if (pullReceipt.status !== 'success') {
      throw new Error(`executeAllowanceTransfer reverted: tx=${pullTxHash}`);
    }
    pullReceiptStatus = pullReceipt.status;

    markFundedTxHash = await walletClient.writeContract({
      address: getAddress(bundle.dealManagerAddress),
      abi: DEAL_MANAGER_ABI,
      functionName: 'markFunded',
      args: [bundle.terms.dealId, amount]
    });
    const markFundedReceipt = await publicClient.waitForTransactionReceipt({ hash: markFundedTxHash });
    if (markFundedReceipt.status !== 'success') {
      throw new Error(`markFunded reverted: tx=${markFundedTxHash}`);
    }
    markFundedReceiptStatus = markFundedReceipt.status;
  } else if (dealStatus === STATUS.GracePeriod) {
    // Resume mode: funding already completed in a prior run.
  } else if (dealStatus === STATUS.Released) {
    process.stdout.write(JSON.stringify({
      ok: true,
      chainId,
      dealId: bundle.terms.dealId,
      settlementExecutor,
      allowanceModuleAddress: null,
      pullTxHash: null,
      markFundedTxHash: null,
      payoutTxHash: null,
      payoutReceiptStatus: null,
      releaseTxHash: null,
      releaseReceiptStatus: null,
      randomNumber: null,
      outputHash: null,
      status: Number(deal.status),
      fundedAmount: deal.fundedAmount.toString(),
      releasedAmount: deal.releasedAmount.toString(),
      feePaid: deal.feePaid.toString()
    }, null, 2) + '\n');
    return;
  } else {
    throw new Error(`deal ${bundle.terms.dealId} must be Ready or GracePeriod; current status=${deal.status}`);
  }

  let dealBeforeRelease = await publicClient.readContract({
    address: getAddress(bundle.dealManagerAddress),
    abi: DEAL_MANAGER_ABI,
    functionName: 'getDeal',
    args: [bundle.terms.dealId]
  });
  let statusBeforeRelease = Number(dealBeforeRelease.status);

  // Some RPC backends may lag for a few blocks right after markFunded.
  if (statusBeforeRelease === STATUS.Ready && markFundedTxHash) {
    for (let i = 0; i < 12; i += 1) {
      await sleep(700);
      dealBeforeRelease = await publicClient.readContract({
        address: getAddress(bundle.dealManagerAddress),
        abi: DEAL_MANAGER_ABI,
        functionName: 'getDeal',
        args: [bundle.terms.dealId]
      });
      statusBeforeRelease = Number(dealBeforeRelease.status);
      if (statusBeforeRelease !== STATUS.Ready) break;
    }
  }

  if (statusBeforeRelease === STATUS.Released) {
    process.stdout.write(JSON.stringify({
      ok: true,
      chainId,
      dealId: bundle.terms.dealId,
      settlementExecutor,
      allowanceModuleAddress,
      pullTxHash,
      pullReceiptStatus,
      markFundedTxHash,
      markFundedReceiptStatus,
      payoutTxHash: null,
      payoutReceiptStatus: null,
      releaseTxHash: null,
      releaseReceiptStatus: null,
      randomNumber: null,
      outputHash: null,
      status: statusBeforeRelease,
      fundedAmount: dealBeforeRelease.fundedAmount.toString(),
      releasedAmount: dealBeforeRelease.releasedAmount.toString(),
      feePaid: dealBeforeRelease.feePaid.toString()
    }, null, 2) + '\n');
    return;
  }
  if (statusBeforeRelease !== STATUS.GracePeriod) {
    throw new Error(`deal ${bundle.terms.dealId} must be GracePeriod before payout/release; current status=${statusBeforeRelease}; markFundedTx=${markFundedTxHash || 'none'}`);
  }

  const skipPayout = ['1', 'true', 'yes'].includes((process.env.SETTLE_SKIP_PAYOUT || '').trim().toLowerCase());
  const mcpResult = await requestJson(`${bundle.mcpBaseUrl.replace(/\/$/, '')}/run`, {
    dealId: bundle.terms.dealId,
    prompt: bundle.prompt
  });

  const grossAmount = amount - BigInt(bundle.terms.fee);
  const feeAmount = BigInt(bundle.terms.fee);

  let payoutTxHash = null;
  let payoutReceipt = { status: 'skipped' };
  if (!skipPayout) {
    try {
      payoutTxHash = await walletClient.writeContract({
        address: getAddress(bundle.token),
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [getAddress(bundle.terms.mcpSafe), grossAmount]
      });
      payoutReceipt = await publicClient.waitForTransactionReceipt({ hash: payoutTxHash });
      if (payoutReceipt.status !== 'success') {
        throw new Error(`payout reverted: tx=${payoutTxHash}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `payout failed: ${msg}. If MCP was already paid for this deal, rerun with SETTLE_SKIP_PAYOUT=1 to only execute releaseToMcp.`,
      );
    }
  }

  const releaseTxHash = await walletClient.writeContract({
    address: getAddress(bundle.dealManagerAddress),
    abi: DEAL_MANAGER_ABI,
    functionName: 'releaseToMcp',
    args: [bundle.terms.dealId, grossAmount, feeAmount]
  });
  const releaseReceipt = await publicClient.waitForTransactionReceipt({ hash: releaseTxHash });
  if (releaseReceipt.status !== 'success') {
    throw new Error(`releaseToMcp reverted: tx=${releaseTxHash}`);
  }

  let finalDeal;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    finalDeal = await publicClient.readContract({
      address: getAddress(bundle.dealManagerAddress),
      abi: DEAL_MANAGER_ABI,
      functionName: 'getDeal',
      args: [bundle.terms.dealId]
    });
    if (Number(finalDeal.status) === STATUS.Released) break;
    await sleep(700);
  }

  if (Number(finalDeal.status) !== STATUS.Released) {
    throw new Error(`releaseToMcp tx mined but deal not Released; tx=${releaseTxHash} status=${finalDeal.status} releasedAmount=${finalDeal.releasedAmount}`);
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    chainId,
    dealId: bundle.terms.dealId,
    settlementExecutor,
    allowanceModuleAddress,
    pullTxHash,
    pullReceiptStatus,
    markFundedTxHash,
    markFundedReceiptStatus,
    payoutTxHash,
    payoutReceiptStatus: payoutReceipt.status,
    releaseTxHash,
    releaseReceiptStatus: releaseReceipt.status,
    randomNumber: mcpResult.randomNumber,
    outputHash: mcpResult.outputHash,
    status: Number(finalDeal.status),
    fundedAmount: finalDeal.fundedAmount.toString(),
    releasedAmount: finalDeal.releasedAmount.toString(),
    feePaid: finalDeal.feePaid.toString()
  }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
