import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, getAddress, http, isAddress, parseAbi, keccak256, stringToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(scriptDir, '..', '..');

export const DEAL_MANAGER_ABI = [
  {
    type: 'function',
    name: 'getDeal',
    stateMutability: 'view',
    inputs: [{ name: 'dealId', type: 'bytes32' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'dealId', type: 'bytes32' },
        { name: 'userSafe', type: 'address' },
        { name: 'mcpSafe', type: 'address' },
        { name: 'settlement', type: 'address' },
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'fee', type: 'uint256' },
        { name: 'maxRefund', type: 'uint256' },
        { name: 'maxLiability', type: 'uint256' },
        { name: 'gracePeriodEnd', type: 'uint64' },
        { name: 'deadline', type: 'uint64' },
        { name: 'userNonce', type: 'uint256' },
        { name: 'mcpNonce', type: 'uint256' },
        { name: 'status', type: 'uint8' },
        { name: 'userBound', type: 'bool' },
        { name: 'mcpBound', type: 'bool' },
        { name: 'authorizationMode', type: 'uint8' },
        { name: 'fundedAmount', type: 'uint256' },
        { name: 'releasedAmount', type: 'uint256' },
        { name: 'feePaid', type: 'uint256' },
        { name: 'refundedAmount', type: 'uint256' },
        { name: 'chargebackAmount', type: 'uint256' }
      ]
    }]
  },
  { type: 'function', name: 'markFunded', stateMutability: 'nonpayable', inputs: [{ name: 'dealId', type: 'bytes32' }, { name: 'fundedAmount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'releaseToMcp', stateMutability: 'nonpayable', inputs: [{ name: 'dealId', type: 'bytes32' }, { name: 'grossAmount', type: 'uint256' }, { name: 'feeAmount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'resolveRelease', stateMutability: 'nonpayable', inputs: [{ name: 'dealId', type: 'bytes32' }, { name: 'grossAmount', type: 'uint256' }, { name: 'feeAmount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'resolveRefund', stateMutability: 'nonpayable', inputs: [{ name: 'dealId', type: 'bytes32' }, { name: 'refundAmount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'markChargeback', stateMutability: 'nonpayable', inputs: [{ name: 'dealId', type: 'bytes32' }, { name: 'recoveredAmount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'openDispute', stateMutability: 'nonpayable', inputs: [{ name: 'dealId', type: 'bytes32' }, { name: 'reasonHash', type: 'bytes32' }], outputs: [] }
];

export const SAFE_ABI = [
  {
    type: 'function',
    name: 'getModulesPaginated',
    stateMutability: 'view',
    inputs: [{ name: 'start', type: 'address' }, { name: 'pageSize', type: 'uint256' }],
    outputs: [{ name: 'array', type: 'address[]' }, { name: 'next', type: 'address' }]
  }
];

export const ALLOWANCE_MODULE_ABI = [
  {
    type: 'function',
    name: 'getTokenAllowance',
    stateMutability: 'view',
    inputs: [{ name: 'safe', type: 'address' }, { name: 'delegate', type: 'address' }, { name: 'token', type: 'address' }],
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
      { name: 'amount', type: 'uint96' },
      { name: 'paymentToken', type: 'address' },
      { name: 'payment', type: 'uint96' },
      { name: 'delegate', type: 'address' },
      { name: 'signature', type: 'bytes' }
    ],
    outputs: []
  }
];

export const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)'
]);

export const MODULES_SENTINEL = '0x0000000000000000000000000000000000000001';
export const STATUS = { None: 0, Created: 1, Ready: 2, GracePeriod: 3, Released: 4, Disputed: 5, Refunded: 6, Chargeback: 7, Closed: 8, Cancelled: 9 };
export const STATUS_NAMES = Object.fromEntries(Object.entries(STATUS).map(([name, value]) => [value, name]));

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function requireHexPrivateKey(name) {
  let value = requireEnv(name);
  if (!value.startsWith('0x')) value = `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be a 32-byte hex private key`);
  return value;
}

export function readBundle(envName, defaultFilename) {
  const chainId = Number.parseInt(process.env.CHAIN_ID?.trim() || '8453', 10);
  const bundlePath = process.env[envName]?.trim()
    ? resolve(repoDir, process.env[envName].trim())
    : resolve(repoDir, `deployments/${defaultFilename}.chain-${chainId}.json`);
  return {
    chainId,
    bundlePath,
    bundle: JSON.parse(readFileSync(bundlePath, 'utf8'))
  };
}

export function createExecutorClients(bundle, privateKeyEnvCandidates = ['SETTLEMENT_EXECUTOR_PRIVATE_KEY', 'SETTLEMENT_PRIVATE_KEY']) {
  const rpcUrl = requireEnv('RPC_URL');
  const privateKeyEnv = privateKeyEnvCandidates.find((name) => process.env[name]?.trim()) || privateKeyEnvCandidates[0];
  const privateKey = requireHexPrivateKey(privateKeyEnv);
  const account = privateKeyToAccount(privateKey);
  const settlementExecutor = getAddress(bundle.settlementExecutor);
  if (getAddress(account.address) !== settlementExecutor) {
    throw new Error(`settlement executor private key address ${account.address} does not match settlement executor ${settlementExecutor}`);
  }
  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
  return { rpcUrl, privateKey, account, publicClient, walletClient, settlementExecutor };
}

export async function getDeal(publicClient, dealManagerAddress, dealId) {
  return publicClient.readContract({
    address: getAddress(dealManagerAddress),
    abi: DEAL_MANAGER_ABI,
    functionName: 'getDeal',
    args: [dealId]
  });
}

export async function findAllowanceModule(publicClient, sourceSafe, delegate, token) {
  const modules = [];
  let cursor = MODULES_SENTINEL;
  for (let i = 0; i < 10; i += 1) {
    const [page, next] = await publicClient.readContract({
      address: getAddress(sourceSafe),
      abi: SAFE_ABI,
      functionName: 'getModulesPaginated',
      args: [cursor, 50n]
    });
    modules.push(...page.map(getAddress));
    if (next.toLowerCase() === MODULES_SENTINEL.toLowerCase()) break;
    cursor = next;
  }

  for (const moduleAddress of modules) {
    try {
      const tuple = await publicClient.readContract({
        address: moduleAddress,
        abi: ALLOWANCE_MODULE_ABI,
        functionName: 'getTokenAllowance',
        args: [getAddress(sourceSafe), getAddress(delegate), getAddress(token)]
      });
      const normalized = tuple.map((value) => BigInt(value));
      if (normalized[0] > 0n) {
        return { allowanceModuleAddress: moduleAddress, allowanceTuple: normalized };
      }
    } catch {}
  }

  throw new Error(`No allowance module with a positive allowance for delegate ${delegate} was found on safe ${sourceSafe}`);
}

export async function executeAllowancePull({ publicClient, walletClient, account, sourceSafe, delegate, token, to, amount }) {
  const { allowanceModuleAddress, allowanceTuple } = await findAllowanceModule(publicClient, sourceSafe, delegate, token);
  const [totalAllowance, spent, , , nonce] = allowanceTuple;
  const remaining = totalAllowance > spent ? totalAllowance - spent : 0n;
  if (remaining < amount) {
    throw new Error(`requested amount ${amount} exceeds remaining allowance ${remaining}`);
  }

  const paymentToken = '0x0000000000000000000000000000000000000000';
  const payment = 0n;
  const transferHash = await publicClient.readContract({
    address: allowanceModuleAddress,
    abi: ALLOWANCE_MODULE_ABI,
    functionName: 'generateTransferHash',
    args: [getAddress(sourceSafe), getAddress(token), getAddress(to), amount, paymentToken, payment, Number(nonce)]
  });
  const signature = await account.sign({ hash: transferHash });
  const txHash = await walletClient.writeContract({
    address: allowanceModuleAddress,
    abi: ALLOWANCE_MODULE_ABI,
    functionName: 'executeAllowanceTransfer',
    args: [
      getAddress(sourceSafe),
      getAddress(token),
      getAddress(to),
      amount,
      paymentToken,
      payment,
      getAddress(delegate),
      signature
    ]
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { allowanceModuleAddress, allowanceTuple, transferHash, signature, txHash, receipt };
}

export async function maybeOpenDispute({ publicClient, walletClient, dealManagerAddress, dealId, currentStatus, reasonText, reasonHash }) {
  if (!reasonText && !reasonHash) return null;
  if (Number(currentStatus) === STATUS.Disputed) return null;
  const finalReasonHash = reasonHash || keccak256(stringToHex(reasonText));
  const txHash = await walletClient.writeContract({
    address: getAddress(dealManagerAddress),
    abi: DEAL_MANAGER_ABI,
    functionName: 'openDispute',
    args: [dealId, finalReasonHash]
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  return { reasonHash: finalReasonHash, txHash, receipt };
}

export function requireAddressString(value, name) {
  if (!isAddress(value)) throw new Error(`${name} must be an address`);
  return getAddress(value);
}
