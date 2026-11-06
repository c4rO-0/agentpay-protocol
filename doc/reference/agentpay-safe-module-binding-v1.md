# AgentPay Safe Module x402 Binding v1

Status: Phase 0 public binding contract. The wire identity, payment flow,
commitment encoding, and response semantics are fixed. The production Module,
Registry qualification interface, durable Settlement storage, and live Base conformance
remain Phase A work.

## Identity

```text
x402Version = 2
scheme = agentpay
binding = agentpay.safe-module.v1
paymentFlow = escrow
network = eip155:8453
```

`v1` versions this AgentPay binding, not x402 itself. The binding is not an
alias for the published EVM `batch-settlement` payment-channel mechanism.

The facilitator `SupportedKind` is:

```json
{
  "x402Version": 2,
  "scheme": "agentpay",
  "network": "eip155:8453",
  "extra": {
    "binding": "agentpay.safe-module.v1",
    "paymentFlow": "escrow"
  }
}
```

## Payment Requirements

The normal x402 v2 fields retain their meanings. `asset`, `amount`, and
`payTo` are respectively the policy token, exact prepaid amount, and
deterministic order Vault. `extra` binds the approved Module, Safe, immutable
policy, Factory, order, canonical terms, and independently verified dynamic
Registry qualification.

The canonical JSON Schema and fixture are:

- `packages/types/schemas/agentpay-safe-module-v1.schema.json`;
- `packages/types/fixtures/agentpay-safe-module-v1/records.json`.

The committed fixture contains an all-zero, non-paying signature placeholder.
Conformance tests sign the canonical commitment only in process memory with a
known disposable test identity; no signed commitment is stored in Git.

Unknown commitment and binding fields are rejected. Addresses compare by EVM
address value; identifiers and hashes use lowercase `bytes32` hex; token
amounts and timestamps use positive decimal strings.

## Commitment

Wallet signs only this EIP-712 primary type:

```text
AgentPayCommitment(
  address safe,
  bytes32 policyId,
  address factory,
  bytes32 orderId,
  address vault,
  address token,
  uint256 amount,
  bytes32 termsHash,
  bytes32 scopeProofHash,
  bytes32 commitmentNonce,
  uint64 validBefore
)
```

The domain is:

```text
name = AgentPay Safe Module
version = 1
chainId = CAIP-2 eip155 reference
verifyingContract = requirements.extra.module
```

`commitmentId` is the resulting EIP-712 digest. `commitmentNonce` is unordered;
the Module must reject a used digest and a second funding of the same Safe,
Factory, and order. `scopeProofHash` prevents a verified Registry qualification
from being replaced after signing. The policy authorizes the independent public
Registry and its qualification format, not a Settlement-approved verifier or a
frozen list snapshot; newly qualified Skills therefore become eligible
automatically. Providers cannot self-attest qualification. V1 does not add
user-configured category, trust-tier, price, or deny-rule predicates.

## Verify, Accept, And Settle

`POST /verify` is read-only. It validates exact requirements matching,
commitment structure and signature, active policy and validity, per-payment
and remaining budget, Vault/order bindings, replay state, and the Registry
qualification. Wallet performs the same Registry check before signing; the
Module repeats it on-chain during redemption.
It does not persist acceptance, submit a transaction, move funds, activate the
Vault, or authorize Skill execution.

Settlement has a durable internal acceptance boundary:

```text
verify -> accept -> commitmentId -> redemption job
```

Acceptance is idempotent by `commitmentId` and order. Its
`agentpay.commitment-acceptance.v1` record says only that Settlement claimed
the valid commitment for redemption. It is not a successful x402 `/settle`
response and is not funding evidence.

Native `/settle` may return `success: true` only after the relayer redemption
transaction succeeded and Settlement independently confirmed the expected
token Transfer, Vault balance, immutable Vault terms, and activation result.
The response contains the transaction hash, settled amount, `commitmentId`,
order, Vault, and `fundingEvidence: confirmed`. Missing, pending, reverted, or
unverifiable evidence returns `success: false` with no transaction claim.

Settlement may wait only for a bounded interval inside one native `/settle`
request. It first durably and atomically accepts the commitment and enqueues or
resumes its redemption job. If funding and activation remain incomplete when
the interval ends, it returns HTTP 200 with the normal settle response shape,
`success: false`, `errorReason: settlement_pending`, and an empty
`transaction`. A caller retries with the identical signed commitment. The
retry resolves the same `commitmentId` and durable job and must never create a
second blind funding attempt. This retryable native result does not change the
semantics of a standard scheme forwarded to an upstream facilitator.

Skill tickets remain blocked until the Vault is `Funded`. Later delivery,
release, refund, reconciliation, and recovery belong to the AgentPay order
lifecycle and are not redefined as the initial x402 settlement.

## Gateway Compatibility

Settlement dispatches by x402 version, scheme, and network. Native `agentpay`
requests never enter an upstream adapter. Phase one forwards only standard
Base `exact` payloads to CDP unchanged; it performs no signature conversion or
liquidity bridge. An upstream outage removes the upstream capability from
`/supported` and fails standard requests, but cannot disable native AgentPay
verification or acceptance.

The Phase 0 Gateway implementation was deliberately not mounted into the
production server at the time this binding was frozen. It proved the boundary
without real credentials, Session Keys, RPC calls, Safe transactions, or
funds. Later formal-runtime evidence mounts this binding on loopback behind a
default-off switch; consult this repository's [progress](../../progress.md)
for current rollout status.
