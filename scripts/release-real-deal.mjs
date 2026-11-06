import { getAddress } from 'viem';
import { DEAL_MANAGER_ABI, ERC20_ABI, STATUS, STATUS_NAMES, createExecutorClients, getDeal, readBundle } from './lib/real-deal-runtime.mjs';

async function main() {
  const { chainId, bundlePath, bundle } = readBundle('REAL_DEAL_BUNDLE_FILE', 'real-random-deal.bundle');
  const { publicClient, walletClient, settlementExecutor } = createExecutorClients(bundle);

  const deal = await getDeal(publicClient, bundle.dealManagerAddress, bundle.terms.dealId);
  const currentStatus = Number(deal.status);
  if (currentStatus !== STATUS.GracePeriod && currentStatus !== STATUS.Disputed) {
    throw new Error(`deal ${bundle.terms.dealId} must be GracePeriod or Disputed to release; current status=${STATUS_NAMES[currentStatus] ?? currentStatus}`);
  }

  const grossAmount = BigInt(process.env.RELEASE_GROSS_AMOUNT?.trim() || (BigInt(bundle.terms.amount) - BigInt(bundle.terms.fee)).toString());
  const feeAmount = BigInt(process.env.RELEASE_FEE_AMOUNT?.trim() || bundle.terms.fee);
  const payoutTo = getAddress(process.env.RELEASE_TO_ADDRESS?.trim() || bundle.terms.mcpSafe);
  if (grossAmount < 0n || feeAmount < 0n) throw new Error('release amounts must be >= 0');

  const payoutTxHash = await walletClient.writeContract({
    address: getAddress(bundle.token),
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [payoutTo, grossAmount]
  });
  await publicClient.waitForTransactionReceipt({ hash: payoutTxHash });

  const functionName = currentStatus === STATUS.Disputed ? 'resolveRelease' : 'releaseToMcp';
  const settlementTxHash = await walletClient.writeContract({
    address: getAddress(bundle.dealManagerAddress),
    abi: DEAL_MANAGER_ABI,
    functionName,
    args: [bundle.terms.dealId, grossAmount, feeAmount]
  });
  await publicClient.waitForTransactionReceipt({ hash: settlementTxHash });

  const finalDeal = await getDeal(publicClient, bundle.dealManagerAddress, bundle.terms.dealId);
  process.stdout.write(JSON.stringify({
    ok: true,
    chainId,
    bundlePath,
    dealId: bundle.terms.dealId,
    settlementExecutor,
    action: functionName,
    payoutTo,
    payoutTxHash,
    settlementTxHash,
    status: Number(finalDeal.status),
    releasedAmount: finalDeal.releasedAmount.toString(),
    feePaid: finalDeal.feePaid.toString(),
    refundedAmount: finalDeal.refundedAmount.toString(),
    chargebackAmount: finalDeal.chargebackAmount.toString()
  }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
