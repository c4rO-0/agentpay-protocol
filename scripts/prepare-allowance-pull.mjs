import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress } from 'viem';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(scriptDir, '..');
const MODULES_SENTINEL = '0x0000000000000000000000000000000000000001';

const SAFE_ABI = [
  {
    type: 'function',
    name: 'getModulesPaginated',
    stateMutability: 'view',
    inputs: [
      { name: 'start', type: 'address' },
      { name: 'pageSize', type: 'uint256' }
    ],
    outputs: [
      { name: 'array', type: 'address[]' },
      { name: 'next', type: 'address' }
    ]
  }
];

const ALLOWANCE_MODULE_ABI = [
  {
    type: 'function',
    name: 'getTokenAllowance',
    stateMutability: 'view',
    inputs: [
      { name: 'safe', type: 'address' },
      { name: 'delegate', type: 'address' },
      { name: 'token', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256[5]' }]
  },
  {
    type: 'function',
    name: 'generateTransferHash',
    stateMutability: 'view',
    inputs: [
      { name: 'safe', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint96' },
      { name: 'paymentToken', type: 'address' },
      { name: 'payment', type: 'uint96' },
      { name: 'nonce', type: 'uint16' }
    ],
    outputs: [{ name: '', type: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'executeAllowanceTransfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'safe', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint96' }
    ],
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
  if (!isAddress(value)) throw new Error(`${name} must be a valid address`);
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

async function main() {
  const rpcUrl = requireEnv('RPC_URL');
  const chainId = Number.parseInt(process.env.CHAIN_ID?.trim() || '8453', 10);
  const userSafe = requireAddress('USER_SAFE_ADDRESS');
  const settlementExecutor = requireAddress(process.env.SETTLEMENT_EXECUTOR_ADDRESS?.trim() ? 'SETTLEMENT_EXECUTOR_ADDRESS' : 'SETTLEMENT_ADDRESS');
  const token = requireAddress('TOKEN_ADDRESS');
  const amount = requireBigInt('AMOUNT', '1');
  if (amount <= 0n) throw new Error('AMOUNT must be > 0');
  if (amount > (2n ** 96n - 1n)) throw new Error('AMOUNT exceeds uint96');

  const outputPath = process.env.ALLOWANCE_PULL_BUNDLE_FILE?.trim()
    ? resolve(repoDir, process.env.ALLOWANCE_PULL_BUNDLE_FILE.trim())
    : resolve(repoDir, `deployments/allowance-pull.bundle.chain-${chainId}.json`);

  const client = createPublicClient({ transport: http(rpcUrl) });
  const modules = [];
  let cursor = MODULES_SENTINEL;
  for (let i = 0; i < 10; i += 1) {
    const [page, next] = await client.readContract({
      address: userSafe,
      abi: SAFE_ABI,
      functionName: 'getModulesPaginated',
      args: [cursor, 50n]
    });
    modules.push(...page.map(getAddress));
    if (next.toLowerCase() === MODULES_SENTINEL.toLowerCase()) break;
    cursor = next;
  }

  let selectedModule = null;
  let allowanceTuple = null;
  for (const moduleAddress of modules) {
    try {
      const tuple = await client.readContract({
        address: moduleAddress,
        abi: ALLOWANCE_MODULE_ABI,
        functionName: 'getTokenAllowance',
        args: [userSafe, settlementExecutor, token]
      });
      const normalized = tuple.map((value) => BigInt(value));
      if (normalized[0] > 0n) {
        selectedModule = moduleAddress;
        allowanceTuple = normalized;
        break;
      }
    } catch {
      // ignore non-allowance modules
    }
  }

  if (!selectedModule || !allowanceTuple) {
    throw new Error('No allowance module with a positive allowance for the settlement executor was found on userSafe');
  }

  const [totalAllowance, spent, resetTimeMin, lastResetMin, nonce] = allowanceTuple;
  const remaining = totalAllowance > spent ? totalAllowance - spent : 0n;
  if (remaining < amount) {
    throw new Error(`Requested AMOUNT (${amount}) exceeds remaining allowance (${remaining})`);
  }

  const paymentToken = '0x0000000000000000000000000000000000000000';
  const payment = 0n;
  const transferHash = await client.readContract({
    address: selectedModule,
    abi: ALLOWANCE_MODULE_ABI,
    functionName: 'generateTransferHash',
    args: [userSafe, token, settlementExecutor, amount, paymentToken, payment, Number(nonce)]
  });

  const settlementTransaction = {
    label: 'execute-allowance-transfer',
    to: selectedModule,
    value: '0',
    note: 'Execution requires the delegate signature over transferHash; use scripts/execute-allowance-pull.mjs',
    pendingArgs: {
      safe: userSafe,
      token,
      to: settlementExecutor,
      amount: amount.toString(),
      paymentToken,
      payment: payment.toString(),
      delegate: settlementExecutor,
      nonce: nonce.toString()
    }
  };

  const bundle = {
    ok: true,
    mode: 'allowance-pull-prepare',
    chainId,
    rpcUrl,
    userSafe,
    settlementExecutor,
    token,
    requestedAmount: amount.toString(),
    allowanceModuleAddress: selectedModule,
    allowance: {
      total: totalAllowance.toString(),
      spent: spent.toString(),
      remaining: remaining.toString(),
      resetTimeMin: resetTimeMin.toString(),
      lastResetMin: lastResetMin.toString(),
      nonce: nonce.toString()
    },
    transferHash,
    settlementTransaction
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote allowance pull bundle to ${outputPath}\n`);
  process.stdout.write(`Allowance module: ${selectedModule}\n`);
  process.stdout.write(`Remaining allowance: ${remaining.toString()}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
