# Safe Delegated Authorization Findings

## Verified Hypothesis

The spike verifies the AgentPay product invariant at three independent layers:

1. Foundry policy and escrow tests: 11 passed, 0 failed.
2. Node x402 commitment and orchestration tests: 6 passed, 0 failed.
3. Official Safe v1.4.1 Base-fork conformance: 2 passed, 0 failed.

One Safe setup enabled a bounded Agent delegate. The delegate then funded two
independent Factory Vaults without consuming a Safe owner nonce. A standard
Safe owner transaction revoked the policy and invalidated an already signed
commitment. x402 verification moved no funds, settlement stored one idempotent
commitment, redemption funded the Vault, and ticket issuance remained blocked
until Vault activation.

This proves the architecture is feasible. It does not make the spike contract
deployable or establish a public Protocol version.

## Production Blockers In The Spike

The test-only `AgentPaySpendingModuleSpike` intentionally favors a small proof
surface. The following behaviors must not be promoted:

1. `setPolicy()` replaces a policy and resets its sequential nonce to zero. An
   unexpired old signature may become valid again after a matching policy is
   configured.
2. The Module does not mark an `orderId` as consumed. A second commitment with
   a new nonce can fund the same Vault again before `activate()` changes its
   state.
3. A single sequential nonce serializes all payments. Concurrent independent
   Agent purchases can invalidate or block each other.
4. `execTransactionFromModule()` reports whether the token call reverted but
   does not expose ERC-20 return data. A token that returns `false` can be
   accounted as funded even though it did not transfer.
5. The local ECDSA helper does not enforce the complete production signature
   validity rules, including low-`s` malleability rejection.
6. The spike has one mutable policy per Safe and no explicit immutable policy
   identity, seller/service scope, emergency pause, or production event model.
7. The Node chain and facilitator are conformance models. They do not submit the
   Solidity Module transaction or provide durable commitment storage.

## Required Production Model

### Authorization ownership

- The Safe remains the user's custody account.
- The delegate is a per-device/Agent and policy Session Key controlled by the
  user's AgentPay Wallet boundary. The Agent runtime may request a narrowly
  typed commitment signature through Wallet, but it cannot read or export the
  key. Settlement and the facilitator relay commitments but do not own it.
- Enabling the Module and creating, replacing, or revoking a policy are the
  only normal user-confirmed transactions.
- Each policy is bounded by token, approved Factory, per-payment maximum, total
  budget, validity window, and Registry qualification. The 2026-09-12 product
  review superseded the spike's multi-predicate scope proposal: v1 authorizes
  AgentPay's dynamic public Registry list and does not add category,
  verification-tier, price-cap, or deny-status policy choices. Wallet and
  Module independently validate qualification, which cannot be self-asserted
  by a developer or appointed by Settlement.

### Immutable policy identity

Policies must be stored by `(safe, policyId)`. A policy is immutable after
creation except for `spent` and `revoked`. Changing any limit creates a new
`policyId` and revokes the old policy; counters are never reset in place.

Suggested identity:

```text
policyId = keccak256(safe, userPolicySalt, delegate, token, factory, limits, validity, scope)
```

### Concurrent commitment identity

The signed commitment must include:

```text
safe
policyId
factory
orderId
vault
token
amount
termsHash
commitmentNonce (bytes32)
validBefore
```

Use unordered commitment nonces or digests, not one global sequential nonce.
The Module must reject both a reused commitment digest and a second funding for
the same `(safe, factory, orderId)`.

### On-chain redemption checks

Before moving funds, the Module must enforce:

- active immutable policy and time bounds;
- approved delegate signature and EIP-712 domain;
- per-payment and remaining total budget;
- unused commitment and unfunded order;
- `factory.getVault(orderId) == vault`;
- Vault state is `Created`;
- Vault buyer, token, amount, and `termsHash` match the commitment;
- the Skill has valid qualification from the policy's independent Registry;
- the Safe has this Module enabled.

The Module must update replay and budget state before the external call, relying
on transaction rollback on failure. It must call Safe
`execTransactionFromModuleReturnData()`, require call success, and require an
empty ERC-20 return value or decoded `true`.

### x402 lifecycle

> Naming decision (2026-09-08): the spike proved the Safe Module authorization
> mechanics, but its payload is not the currently published EVM payment-channel
> binding. AgentPay uses x402 v2 scheme `agentpay` with binding
> `agentpay.safe-module.v1`; registration under standard EVM
> `batch-settlement` is outside project scope.

The AgentPay binding uses a custom x402 v2 mechanism with capital-backed
delegated authorization:

```text
Payment Required
  -> Wallet validates policy and signs commitment automatically
  -> facilitator /verify simulates Module redemption without state change
  -> Settlement durably accepts one commitment and returns commitmentId internally
  -> redemption worker submits Module transaction
  -> Settlement verifies receipt, Transfer, Vault balance, and immutable terms
  -> Vault activate
  -> /settle may report success
  -> execution ticket
```

Internal acceptance is not a successful x402 `/settle` result. AgentPay does
not serve the paid Skill merely because Settlement accepted a commitment. Its
product policy requires completed redemption and a `Funded` Vault before
settlement success or ticket issuance.

CDP remains an adapter for schemes it natively implements. The hosted CDP
facilitator is not assumed to execute the AgentPay Safe Module binding.

## Next Gate

Before Settlement S2 resumes:

1. approve the production model above;
2. implement the production Module and versioned EIP-712 fixture;
3. add every blocker above as a positive or negative Foundry test;
4. repeat official Safe Base-fork conformance;
5. promote provider-neutral public types, Schema, ABI, and facilitator ports;
6. replace the in-memory Node chain with an Anvil runner that submits the real
   Module redemption transaction and activates the real Vault.
