import { getAddress } from 'viem';
import { DEAL_MANAGER_ABI, STATUS, STATUS_NAMES, createExecutorClients, executeAllowancePull, getDeal, maybeOpenDispute, readBundle } from './lib/real-deal-runtime.mjs';

async function main() {
  const { chainId, bundlePath, bundle } = readBundle('REAL_DEAL_BUNDLE_FILE', 'real-random-deal.bundle');
  const { publicClient, walletClient, settlementExecutor, account } = createExecutorClients(bundle);

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

  const allowed = new Set([STATUS.Released, STATUS.Disputed, STATUS.Closed]);
  if (!allowed.has(Number(deal.status))) {
    throw new Error(`deal ${bundle.terms.dealId} must be Released, Disputed, or Closed to charge back; current status=${STATUS_NAMES[Number(deal.status)] ?? Number(deal.status)}`);
  }

  const recoveredAmount = BigInt(process.env.CHARGEBACK_AMOUNT?.trim() || deal.releasedAmount.toString());
  if (recoveredAmount <= 0n) throw new Error('CHARGEBACK_AMOUNT must be > 0');

  const pull = await executeAllowancePull({
    publicClient,
    walletClient,
    account,
    sourceSafe: getAddress(bundle.terms.mcpSafe),
    delegate: settlementExecutor,
    token: getAddress(bundle.token),
    to: settlementExecutor,
    amount: recoveredAmount
  });

  const markChargebackTxHash = await walletClient.writeContract({
    address: getAddress(bundle.dealManagerAddress),
    abi: DEAL_MANAGER_ABI,
    functionName: 'markChargeback',
    args: [bundle.terms.dealId, recoveredAmount]
  });
  await publicClient.waitForTransactionReceipt({ hash: markChargebackTxHash });

  const finalDeal = await getDeal(publicClient, bundle.dealManagerAddress, bundle.terms.dealId);
  process.stdout.write(JSON.stringify({
    ok: true,
    chainId,
    bundlePath,
    dealId: bundle.terms.dealId,
    settlementExecutor,
    dispute: dispute ? { reasonHash: dispute.reasonHash, txHash: dispute.txHash } : null,
    allowanceModuleAddress: pull.allowanceModuleAddress,
    transferHash: pull.transferHash,
    pullTxHash: pull.txHash,
    markChargebackTxHash,
    status: Number(finalDeal.status),
    chargebackAmount: finalDeal.chargebackAmount.toString(),
    refundedAmount: finalDeal.refundedAmount.toString(),
    releasedAmount: finalDeal.releasedAmount.toString()
  }, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
