> Historical snapshot retained on 2026-10-27. Use current progress/TODO for
> status and sequencing; unchecked items here are not automatically cancelled.

# AgentPay Protocol Progress

## Private coordinated rollout — 2026-10-25

Operator rollout passed: protected dispute worker/table checks, seven application
services, existing nginx routes, key exclusions and unchanged frozen terms of all
25 retained Orders. Updated scratch MySQL check passed with exact cleanup. Builds
were capped at 1 GiB. New-order admission remains closed. The internal health
projection was corrected without exposing worker details through public health.
Actual model, browser/role and dispute financial acceptance remain pending.
No participant-machine update, new client release or public invitation is implied.
Earlier source checkpoints below retain their original evidence scope.


## Simplified review corrections — 2026-10-25

Case runtime/schema validation now checks nested financial state, review, verdict
and evidence/event fields. Three focused tests and types compilation passed. The
unpublished 0.14.0 artifact and consumer lock integrity were refreshed together.
No deployment or live business/chain mutation. Review the correction results before
coordinated private rollout; earlier source checkpoints below remain historical.

## Duration and delivery disputes — source checkpoint 2026-10-25

Types 0.14.0 add optional canonical-string `serviceWindowSeconds` and a bounded
case projection/schema. Settlement, User, Wallet and Agent vendor the same package.
Contracts, ABIs and existing hashes are unchanged. Existing Vault fields reserve
the longer refund window; dispute timing remains an off-chain authority rule.

These are source/isolated-test results, **not deployed or participant acceptance**.
New rules apply only to new Orders; existing snapshots remain unchanged. Canonical
rules and the detailed evidence record are in the Settlement repository:
`doc/reference/transaction-rules.md` and
`doc/records/duration-disputes-source-review-2026-10-25.md`.
Isolated real MySQL verification and exact scratch cleanup passed on 2026-10-25.
Next: review simplified corrections and separately agree coordinated deployment, then
participant/operator and actual private financial acceptance. No public release.

Updated 2026-10-23. Current stage: **1 — Private end-to-end acceptance**.

## Verified implementation and private use

- `cancelUnfunded` now atomically requires zero payment-token balance. Offline
  pinned-solc Docker compilation and 39 Solidity tests passed, including 256
  positive-balance fuzz inputs and both funding/cancellation orderings.
- [Reviewed artifact bundle](../records/cancellation-artifact-build-2026-10-22.md)
  24975c180fac14383df1 deployed a new Factory/Controller in private Anvil blocks
  105/106. Runtime/roles and derived clone hash were verified. Old Vaults unchanged.
- Types 0.13.0 waiting/closure schemas were installed in Settlement/User/Wallet.
  Private Policy migration confirmed in blocks 107/108. Closure is enabled privately;
  actual unpaid cancellation, refunds, accept/cancel outcomes and refund restart
  accounting passed through 2026-10-23. The earlier “activation pending” labels are
  superseded, not instructions to rebuild/redeploy.
- Protocol remains business-neutral; common JSON service calls do not introduce
  random-specific variants or change frozen hashes. Existing owner-only Registry
  remains in use; the Registrar exploration was withdrawn, not deployed.

The private final state is 21 Orders, Safe 9.5 rUSDC, Policy spent 4.9 rUSDC;
this operational evidence is reported by the Settlement/Wallet rehearsal records,
not proof of live Base compatibility or an independent contract audit.

## Open gates

Direct-chain funding without a recorded Settlement Commitment remains a recovery
integration gap; the zero-balance guard alone does not establish activation/refund
recovery. Retain the bounded public `fundVault` model while the investigation is scoped.
Public release artifacts/security review, actual chosen-network deployment and
multi-generation Provider compatibility remain open. User/Wallet v0.2 tags do not
include the newer 0.13.0 consumer integration. See [TODO](../TODO.md).

## Planning history

[Earlier progress](before-planning-review-2026-10-23-progress.md) and
[retained task snapshot](before-planning-review-2026-10-23-todo.md) preserve
all prior detail. Their “pending” and “next” labels are historical; unresolved
items are not cancelled. Current [TODO](../TODO.md) governs scheduling.

## Direct-chain boundary characterization — passed 2026-10-23

Two test-only cases added: non-relayer scoped-signature funding followed by public
activation/timeout refund, and still-valid funding after an off-chain five-minute
window. Offline Docker/Solc 0.8.24 execution passed both tests with runner exit 0 under
a 1 GiB cap; no contract implementation or current chain state changed. The latter tests contract scope, not current Wallet signature TTL.
