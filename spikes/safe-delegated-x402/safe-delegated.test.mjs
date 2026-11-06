import assert from "node:assert/strict";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import {
  InMemorySafeDelegatedChain,
  LocalSafeDelegatedFacilitator,
  PAYMENT_TYPE,
  buildDelegatedPaymentRequired,
  createDelegatedPaymentPayload,
  issueTicket,
} from "./safe-delegated.mjs";

const now = 1_800_000_000;
const delegate = privateKeyToAccount("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

const addresses = {
  safe: "0x1000000000000000000000000000000000000001",
  token: "0x2000000000000000000000000000000000000002",
  factory: "0x3000000000000000000000000000000000000003",
  module: "0x4000000000000000000000000000000000000004",
  vault1: "0x5000000000000000000000000000000000000005",
  vault2: "0x6000000000000000000000000000000000000006",
};

const policy = {
  safe: addresses.safe,
  delegate: delegate.address,
  token: addresses.token,
  factory: addresses.factory,
  moduleAddress: addresses.module,
  maxPerPayment: 1_000_000n,
  totalBudget: 3_000_000n,
  validAfter: now - 60,
  validUntil: now + 86_400,
};

function order(sequence) {
  return {
    chainId: 31_337,
    orderId: `0x${sequence.toString(16).padStart(64, "0")}`,
    termsHash: `0x${(sequence + 100).toString(16).padStart(64, "0")}`,
    buyer: addresses.safe,
    token: addresses.token,
    vault: sequence === 1 ? addresses.vault1 : addresses.vault2,
    amount: 1_000_000n,
  };
}

function setup() {
  const chain = new InMemorySafeDelegatedChain({ now });
  chain.configurePolicy(policy);
  const first = order(1);
  const second = order(2);
  chain.addOrder(first);
  chain.addOrder(second);
  return { chain, facilitator: new LocalSafeDelegatedFacilitator(chain), first, second };
}

test("commitment type matches the Foundry authorization spike", () => {
  assert.equal(
    PAYMENT_TYPE,
    "SafeDelegatedPayment(address safe,address factory,bytes32 orderId,address vault,address token,uint256 amount,bytes32 termsHash,uint256 nonce,uint64 validBefore)",
  );
});

test("one Safe policy supports two x402 orders without owner confirmation", async () => {
  const { chain, facilitator, first, second } = setup();

  for (const [nextOrder, nonce] of [[first, 0], [second, 1]]) {
    const { payload, requirements } = await createDelegatedPaymentPayload({
      order: nextOrder,
      policy,
      delegateSigner: delegate,
      nonce,
      validBefore: now + 300,
    });

    assert.deepEqual(payload.accepted, requirements);
    assert.equal((await facilitator.verify(payload, requirements)).isValid, true);
    const settled = await facilitator.settle(payload, requirements);
    assert.equal(settled.success, true);
    assert.throws(() => issueTicket(chain, nextOrder.orderId), /Funded/);

    const redeemed = await facilitator.redeem(settled.commitmentId);
    assert.equal(redeemed.success, true);
    assert.equal(chain.orders.get(nextOrder.orderId).balance, nextOrder.amount);
    assert.throws(() => issueTicket(chain, nextOrder.orderId), /Funded/);

    chain.activate(nextOrder.orderId);
    assert.equal(issueTicket(chain, nextOrder.orderId).vault, nextOrder.vault);
  }

  assert.equal(chain.ownerConfirmations, 1);
  assert.equal(chain.transfers.length, 2);
  assert.deepEqual(chain.transfers.map(({ from, to, value }) => ({ from, to, value })), [
    { from: addresses.safe, to: addresses.vault1, value: "1000000" },
    { from: addresses.safe, to: addresses.vault2, value: "1000000" },
  ]);
});

test("verify never moves funds and settle is commitment-idempotent", async () => {
  const { chain, facilitator, first } = setup();
  const { payload, requirements } = await createDelegatedPaymentPayload({
    order: first,
    policy,
    delegateSigner: delegate,
    nonce: 0,
    validBefore: now + 300,
  });

  await facilitator.verify(payload, requirements);
  assert.equal(chain.transfers.length, 0);
  assert.equal(chain.orders.get(first.orderId).balance, 0n);

  const firstSettle = await facilitator.settle(payload, requirements);
  const repeatedSettle = await facilitator.settle(payload, requirements);
  assert.equal(repeatedSettle.commitmentId, firstSettle.commitmentId);
  assert.equal(chain.transfers.length, 0);

  const firstRedeem = await facilitator.redeem(firstSettle.commitmentId);
  const repeatedRedeem = await facilitator.redeem(firstSettle.commitmentId);
  assert.equal(repeatedRedeem.transactionHash, firstRedeem.transactionHash);
  assert.equal(chain.transfers.length, 1);
});

test("requirements and commitment mutations are rejected", async () => {
  const { facilitator, first } = setup();
  const { payload, requirements } = await createDelegatedPaymentPayload({
    order: first,
    policy,
    delegateSigner: delegate,
    nonce: 0,
    validBefore: now + 300,
  });

  const wrongPayTo = { ...requirements, payTo: addresses.vault2 };
  assert.match((await facilitator.verify(payload, wrongPayTo)).invalidReason, /payTo/);

  const tampered = structuredClone(payload);
  tampered.payload.commitment.amount = "999999";
  assert.match((await facilitator.verify(tampered, requirements)).invalidReason, /amount/);

  const wrongBinding = structuredClone(payload);
  wrongBinding.payload.binding = "other-binding";
  assert.match((await facilitator.verify(wrongBinding, requirements)).invalidReason, /binding/);
});

test("revoked policy and replayed nonce cannot create a new payment", async () => {
  const { chain, facilitator, first, second } = setup();
  const firstPayment = await createDelegatedPaymentPayload({
    order: first,
    policy,
    delegateSigner: delegate,
    nonce: 0,
    validBefore: now + 300,
  });
  const settled = await facilitator.settle(firstPayment.payload, firstPayment.requirements);
  await facilitator.redeem(settled.commitmentId);

  const replayedNonce = await createDelegatedPaymentPayload({
    order: second,
    policy,
    delegateSigner: delegate,
    nonce: 0,
    validBefore: now + 300,
  });
  assert.match(
    (await facilitator.verify(replayedNonce.payload, replayedNonce.requirements)).invalidReason,
    /nonce/,
  );

  chain.revokePolicy(addresses.safe);
  const revoked = await createDelegatedPaymentPayload({
    order: second,
    policy,
    delegateSigner: delegate,
    nonce: 2,
    validBefore: now + 300,
  });
  assert.match((await facilitator.verify(revoked.payload, revoked.requirements)).invalidReason, /inactive/);
});

test("Payment Required is bound to the per-order Vault", () => {
  const requirements = buildDelegatedPaymentRequired(order(1), policy);
  assert.equal(requirements.scheme, "batch-settlement");
  assert.equal(requirements.payTo, addresses.vault1);
  assert.equal(requirements.extensions["agentpay-safe-policy"].safe, addresses.safe);
  assert.equal(requirements.extra.binding, "agentpay-safe-delegation-v1");
});
