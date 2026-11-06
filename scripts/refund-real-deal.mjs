import { getAddress } from 'viem';
import { DEAL_MANAGER_ABI, ERC20_ABI, STATUS, STATUS_NAMES, createExecutorClients, getDeal, maybeOpenDispute, readBundle } from './lib/real-deal-runtime.mjs';

async function main() {
  const { chainId, bundlePath, bundle } = readBundle('REAL_DEAL_BUNDLE_FILE', 'real-random-deal.bundle');
  const { publicClient, walletClient, settlementExecutor } = createExecutorClients(bundle);

  let deal = await getDeal(publicClient, bundle.dealManagerAddress, bundle.terms.dealId);
  const currentStatus = Number(deal.status);
  const reasonText = process.env.DISPUTE_REASON_TEXT?.trim();
  const reasonHash = process.env.DISPUTE_REASON_HASH?.trim();
  const dispute = await maybeOpenDispute({
    publicClient,
    walletClient,
    dealManagerAddress: bundle.dealManagerAddress,
    dealId: bundle.terms.dealId,
    currentStatus,
    reasonText,
    reasonHash
  });
  if (dispute) {
    deal = await getDeal(publicClient, bundle.dealManagerAddress, bundle.terms.dealId);
  }

  const allowed = new Set([STATUS.Ready, STATUS.GracePeriod, STATUS.Disputed, STATUS.Released]);
  if (!allowed.has(Number(deal.status))) {
    throw new Error(`deal ${bundle.terms.dealId} must be Ready, GracePeriod, Disputed, or Released to refund; current status=${STATUS_NAMES[Number(deal.status)] ?? Number(deal.status)}`);
  }

  const refundAmount = BigInt(process.env.REFUND_AMOUNT?.trim() || bundle.terms.amount);
  const refundTo = getAddress(process.env.REFUND_TO_ADDRESS?.trim() || bundle.terms.userSafe);
  const payoutTxHash = await walletClient.writeContract({
    address: getAddress(bundle.token),
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [refundTo, refundAmount]
  });
  await publicClient.waitForTransactionReceipt({ hash: payoutTxHash });

  const resolveRefundTxHash = await walletClient.writeContract({
    address: getAddress(bundle.dealManagerAddress),
    abi: DEAL_MANAGER_ABI,
    functionName: 'resolveRefund',
    args: [bundle.terms.dealId, refundAmount]
  });
  await publicClient.waitForTransactionReceipt({ hash: resolveRefundTxHash });

  const finalDeal = await getDeal(publicClient, bundle.dealManagerAddress, bundle.terms.dealId);
  process.stdout.write(JSON.stringify({
    ok: true,
    chainId,
    bundlePath,
    dealId: bundle.terms.dealId,
    settlementExecutor,
    dispute: dispute ? { reasonHash: dispute.reasonHash, txHash: dispute.txHash } : null,
    refundTo,
    refundAmount: refundAmount.toString(),
    payoutTxHash,
    resolveRefundTxHash,
    status: Number(finalDeal.status),
    refundedAmount: finalDeal.refundedAmount.toString(),
    releasedAmount: finalDeal.releasedAmount.toString(),
    feePaid: finalDeal.feePaid.toString(),
    chargebackAmount: finalDeal.chargebackAmount.toString()
  }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
