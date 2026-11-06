import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, getAddress, http, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(scriptDir, '..');

const ALLOWANCE_MODULE_ABI = [
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

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireHexPrivateKey(name) {
  const value = requireEnv(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be a 32-byte hex private key`);
  return value;
}

async function main() {
  const rpcUrl = requireEnv('RPC_URL');
  const chainId = Number.parseInt(process.env.CHAIN_ID?.trim() || '8453', 10);
  const bundlePath = process.env.ALLOWANCE_PULL_BUNDLE_FILE?.trim()
    ? resolve(repoDir, process.env.ALLOWANCE_PULL_BUNDLE_FILE.trim())
    : resolve(repoDir, `deployments/allowance-pull.bundle.chain-${chainId}.json`);
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));

  const privateKey = requireHexPrivateKey(process.env.SETTLEMENT_EXECUTOR_PRIVATE_KEY?.trim() ? 'SETTLEMENT_EXECUTOR_PRIVATE_KEY' : 'SETTLEMENT_PRIVATE_KEY');
  const account = privateKeyToAccount(privateKey);
  const expectedDelegate = getAddress(bundle.settlementExecutor);
  const signerAddress = getAddress(account.address);
  if (signerAddress !== expectedDelegate) {
    throw new Error(`settlement executor private key address ${signerAddress} does not match delegate ${expectedDelegate}`);
  }

  const client = createPublicClient({ transport: http(rpcUrl) });
  const wallet = createWalletClient({ account, transport: http(rpcUrl) });

  const signature = await account.sign({ hash: bundle.transferHash });

  const args = bundle.settlementTransaction.pendingArgs;
  const txHash = await wallet.writeContract({
    address: getAddress(bundle.allowanceModuleAddress),
    abi: ALLOWANCE_MODULE_ABI,
    functionName: 'executeAllowanceTransfer',
    args: [
      getAddress(args.safe),
      getAddress(args.token),
      getAddress(args.to),
      BigInt(args.amount),
      getAddress(args.paymentToken),
      BigInt(args.payment),
      signerAddress,
      signature
    ],
    chain: undefined
  });

  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  process.stdout.write(JSON.stringify({
    ok: true,
    chainId,
    settlementExecutor: signerAddress,
    allowanceModuleAddress: bundle.allowanceModuleAddress,
    transferHash: bundle.transferHash,
    signature,
    txHash,
    status: receipt.status,
    blockNumber: receipt.blockNumber.toString()
  }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
