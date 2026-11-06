import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AgentPayCommitmentAcceptanceRegistry, buildAgentPayCommitmentTypedData,
  hashAgentPayCommitment, verifyAgentPayPayment,
  FundingIdempotencyRegistry, buildPaymentRequired, validatePaymentRequired,
  validateSettlementEvidence, validateVaultTerms, waitForVaultBalance,
} from "../dist/index.js";
import { privateKeyToAccount } from "viem/accounts";
import { MockX402Facilitator } from "../dist/mock.js";
import { CdpX402Facilitator } from "../dist/cdp.js";

const terms = JSON.parse(readFileSync(new URL("../../types/fixtures/x402-escrow-v1/order-terms.json", import.meta.url)));
const records = JSON.parse(readFileSync(new URL("../../types/fixtures/x402-escrow-v1/records.json", import.meta.url)));
const agentPayRecords = JSON.parse(readFileSync(new URL("../../types/fixtures/agentpay-safe-module-v1/records.json", import.meta.url)));
const order = {
  terms,
  termsHash: records.paymentRequired.extensions["agentpay-order"].termsHash,
  vaultAddress: records.paymentRequired.payTo,
  x402PaymentIdentifier: records.paymentRequired.extensions["payment-identifier"].id,
};

test("verifies the canonical AgentPay Safe Module commitment fixture", async () => {
  const signedPayload = structuredClone(agentPayRecords.paymentPayload);
  const fixtureSigner = privateKeyToAccount(`0x${"aa".repeat(32)}`);
  signedPayload.payload.signature = await fixtureSigner.signTypedData(
    buildAgentPayCommitmentTypedData(agentPayRecords.requirements, signedPayload.payload.commitment),
  );
  const result = await verifyAgentPayPayment(
    signedPayload,
    agentPayRecords.requirements,
    { now: "1799999000", policy: agentPayRecords.policy, verifyScope: async () => true },
  );
  assert.deepEqual(result, agentPayRecords.verifyResponse);
  const reordered = structuredClone(signedPayload);
  reordered.accepted = Object.fromEntries(Object.entries(reordered.accepted).reverse());
  assert.equal((await verifyAgentPayPayment(
    reordered,
    agentPayRecords.requirements,
    { now: "1799999000", policy: agentPayRecords.policy, verifyScope: async () => true },
  )).isValid, true);
  assert.equal(
    hashAgentPayCommitment(agentPayRecords.requirements, agentPayRecords.paymentPayload.payload.commitment),
    agentPayRecords.verifyResponse.extensions.agentpay.commitmentId,
  );
});

test("reference acceptance is idempotent and makes no funding claim", () => {
  const registry = new AgentPayCommitmentAcceptanceRegistry(() => "2026-09-09T00:00:00.000Z");
  const first = registry.accept(agentPayRecords.verifyResponse);
  assert.deepEqual(first, agentPayRecords.acceptance);
  assert.equal(registry.accept(agentPayRecords.verifyResponse), first);
  assert.equal("success" in first, false);
  const conflicting = structuredClone(agentPayRecords.verifyResponse);
  conflicting.extensions.agentpay.commitmentId = `0x${"12".repeat(32)}`;
  assert.throws(() => registry.accept(conflicting), /different accepted commitment/);
});

test("rejects mismatched, expired, over-budget, and bad-scope AgentPay commitments", async () => {
  const signedPayload = structuredClone(agentPayRecords.paymentPayload);
  const fixtureSigner = privateKeyToAccount(`0x${"aa".repeat(32)}`);
  signedPayload.payload.signature = await fixtureSigner.signTypedData(
    buildAgentPayCommitmentTypedData(agentPayRecords.requirements, signedPayload.payload.commitment),
  );
  const verify = (paymentPayload, context = {}) => verifyAgentPayPayment(
    paymentPayload,
    agentPayRecords.requirements,
    { now: "1799999000", policy: agentPayRecords.policy, verifyScope: async () => true, ...context },
  );
  const mismatched = structuredClone(signedPayload);
  mismatched.payload.commitment.amount = "1001";
  assert.equal((await verify(mismatched)).isValid, false);
  assert.match((await verify(mismatched)).invalidMessage, /amount mismatch/);
  assert.match((await verify(signedPayload, { now: "1800000001" })).invalidMessage, /validity window/);
  assert.match((await verify(signedPayload, {
    policy: { ...agentPayRecords.policy, remainingBudget: "999" },
  })).invalidMessage, /remaining budget/);
  assert.match((await verify(signedPayload, { verifyScope: async () => false })).invalidMessage, /scope proof/);
  assert.equal((await verify({ ...signedPayload, unexpected: true })).isValid, false);
});

test("builds and validates exact Base USDC Vault requirements", () => {
  const required = buildPaymentRequired(order);
  assert.deepEqual(required, records.paymentRequired);
  assert.doesNotThrow(() => validatePaymentRequired(required, order));
  for (const [field, value] of [["network", "eip155:1"], ["asset", terms.buyer], ["amount", "999"], ["payTo", terms.seller]]) {
    assert.throws(() => validatePaymentRequired({ ...required, [field]: value }, order), new RegExp(String(field)));
  }
});

test("validates chain evidence and rejects every payment mismatch", () => {
  assert.doesNotThrow(() => validateSettlementEvidence(records.evidence, order));
  const cases = [
    ["network", { network: "eip155:1" }], ["asset", { asset: terms.buyer }],
    ["receipt", { receiptStatus: "reverted" }],
    ["payer", { transfer: { ...records.evidence.transfer, from: terms.seller } }],
    ["recipient", { transfer: { ...records.evidence.transfer, to: terms.seller } }],
    ["amount", { transfer: { ...records.evidence.transfer, value: "999" } }],
    ["balance", { observedVaultBalance: "999" }],
  ];
  for (const [message, change] of cases) assert.throws(() => validateSettlementEvidence({ ...records.evidence, ...change }, order), new RegExp(message));
  assert.throws(() => validateSettlementEvidence({ ...records.evidence, transfer: undefined }, order), /missing/);
});

test("CDP adapter normalizes provider-specific responses", async () => {
  const adapter = CdpX402Facilitator.fromClient({
    async getSupported() { return { kinds: [] }; },
    async verify() { return { isValid: true, payer: terms.buyer }; },
    async settle() { return { success: true, payer: terms.buyer, transaction: records.evidence.transactionHash, network: "eip155:8453" }; },
  });
  assert.deepEqual(await adapter.verify({}, records.paymentRequired), { isValid: true, payer: terms.buyer, invalidReason: undefined });
  assert.equal((await adapter.settle({}, records.paymentRequired)).transactionHash, records.evidence.transactionHash);
});

test("verifies immutable Vault terms before activation", () => {
  const snapshot = { ...terms, termsHash: order.termsHash, state: 1 };
  delete snapshot.protocol; delete snapshot.paymentRail; delete snapshot.chainId; delete snapshot.factoryAddress;
  assert.doesNotThrow(() => validateVaultTerms(snapshot, order));
  assert.throws(() => validateVaultTerms({ ...snapshot, seller: terms.buyer }, order), /seller/);
  assert.throws(() => validateVaultTerms({ ...snapshot, state: 2 }, order), /Created/);
});

test("retries stale balance with explicit bounds", async () => {
  const values = [0n, 999n, 1000n]; let reads = 0;
  const balance = await waitForVaultBalance(async () => values[reads++] ?? 1000n, 1000n, { attempts: 3, delayMs: 0, sleep: async () => {} });
  assert.equal(balance, 1000n); assert.equal(reads, 3);
  await assert.rejects(() => waitForVaultBalance(async () => 1n, 2n, { attempts: 2, delayMs: 0, sleep: async () => {} }), /insufficient/);
});

test("enforces payment and transaction idempotency", () => {
  const registry = new FundingIdempotencyRegistry();
  assert.equal(registry.claim("payment-1", "0xaaa", "order-1"), "new");
  assert.equal(registry.claim("payment-1", "0xaaa", "order-1"), "existing");
  assert.throws(() => registry.claim("payment-1", "0xbbb", "order-2"), /replayed/);
  assert.throws(() => registry.claim("payment-2", "0xaaa", "order-2"), /replayed/);
});

test("mock facilitator implements the provider-neutral contract", async () => {
  const mock = new MockX402Facilitator({ isValid: true, payer: terms.buyer }, { success: true, transactionHash: records.evidence.transactionHash });
  assert.equal((await mock.verify({}, records.paymentRequired)).isValid, true);
  assert.equal((await mock.settle({}, records.paymentRequired)).success, true);
  assert.equal(mock.provider, "mock");
});
