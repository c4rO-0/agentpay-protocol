> Historical snapshot before the 2026-10-23 planning review. Dates, pending labels
> and “next” instructions describe their original checkpoint. Use current progress
> and TODO for scheduling. Unresolved tasks remain retained, not cancelled.

# AgentPay Protocol TODO

## Closure projection candidate

- [x] Add independent closure-v1 schema/type/validator in types 0.13.0; two negative/terminal-state cases and compilation passed.
- [ ] Pack/update reviewed consumers during coordinated rollout; retain frozen wire objects/hashes.
- [ ] Verify actual new Factory clone hash and private cancellation/refund accounting before activation; no new chain action in this source loop.

## Cancellation artifact build

- [x] Canonical offline Docker builder, independent output path, ABI/hash/immutable checks and four integrity tests.
- [x] Candidate build/check passed: bundle 24975c180fac14383df1; source hashes and ABI/bytecode verified, sanitized manifest recorded.
- [x] New private Factory/Controller deployed in blocks 105/106; implementation/runtime/roles and derived clone hash verified. Types 0.13.0 installed in Settlement with 74 targeted regressions passing.
- [ ] Finish test Policy migration, actual private cancellation/refund/restart accounting and consumer integration before closure activation/public release.


## Vault cancellation safety gate

- [x] Source zero-balance guard and ordering/prefund/fuzz tests; explicit fenced Authority cancel adapter with 20 isolated JavaScript cases passed.
- [x] Operator offline Docker Solidity compilation and 39 tests passed, including 256 positive-balance fuzz inputs.
- [ ] Persist/review updated bytecode artifacts and verify runtime hashes before enabling cancellation.
- [ ] Integrate durable closing/refund/funding reconciliation and approved new-Factory/Policy migration; preserve older unpaid Order and chain history.


## Fixed waiting deadlines — source gate

- [x] Freeze five-minute payment/response snapshots; use mined funding timestamp and expose waiting projection; negative/idempotency tests.
- [x] Add independent waiting-v1 schema/type/validator in the 0.13.0 source candidate, preserving frozen wire objects.
- [ ] Complete cancellation intent/race semantics and safe Vault/funding cancellation before implementing/activating automatic closure.
- [ ] Pack/update consumers and verify real MySQL/private chain behavior as part of the complete cancellation/refund flow; source-only checks are not deployment evidence.


## Business-neutrality deployment gate

- [x] Source correction and targeted verification recorded in
  [the local implementation record](../records/business-neutrality-source-2026-10-21.md).
- [ ] Review existing requests and deploy matching dependencies/official package;
  retain all older history and stop on incompatible requests without replacement payment.
- [ ] Perform the official private paid connectivity acceptance after deployment.


## Provider ingress prefixes

- [x] Canonical prefix derivation, stable root vectors and negative tests; types 0.11.1.
- [x] Shared archive pins prepared for five consumers; no live dependency install.
- [ ] Coordinated consumer deployment and private participant acceptance.

## Three-stage execution map — 2026-10-19

The following is the current stage assignment; detailed earlier tasks retain their
original verification scope. Source tests and HTTP checks never close participant,
live-network or crash/recovery acceptance.

### Stage 1 — Private end-to-end acceptance — current

- [ ] Maintain current ABI/hash/timestamp conformance for private role journeys and failure cases. Existing owner-only Registry remains the target; the withdrawn Registrar exploration is not scheduled for deployment.

### Stage 2 — Real-network integration

- [ ] Finalize selected contract/artifact versions, security/audit and public-release hygiene; verify real-network deployment and upgrade/Policy migration behavior. Specify Provider compatibility before multiple generations are enabled.

### Stage 3 — Limited invitation test

- [ ] Publish reviewed versioned artifacts/support limits and verify invited consumers use matching contracts; retain security incident/release response. Private/fork tests are not live-network or audit acceptance.

## Retained task detail and historical checkpoints

Old unchecked tasks remain traceable; reconcile them against later evidence before
execution. They are not additional automatic release requirements or permission to
repeat completed work.

Updated 2026-10-17. [Progress](../../progress.md) states evidence; this file schedules work.

## Current onboarding contribution

- [x] Existing Registry ABI retained; private owner transfer, automatic Settlement
  `setSkill`, receipt/event/live tuple and completed-task restart verified by
  Deploy/Settlement on 2026-10-15–16. No contract change was deployed.

- [ ] Check published types/ABIs/artifacts when onboarding consumers expose a concrete mismatch; no contract rewrite is assumed for UI work.
- [ ] Keep exact timestamp units and frozen signature/hash rules explicit in reference documentation.

## Deferred / release work

- [ ] Specify contract version identification and Provider requirements before multi-generation support.
- [ ] Complete release artifacts/version notes, audit status, public repository hygiene and full-history secret review before publication.
- [ ] Review retained legacy reference artifacts and live-network canary gates with exact consumer evidence.

## Documentation maintenance

- [x] Separate human/AI entry points, current planning and historical evidence; retain previous documents.
- [ ] Reconcile retained long-term items before scheduling the affected feature; archiving does not silently cancel them.

[Backlog disposition](../reference/documentation-backlog.md) · [Historical task snapshot](before-doc-organization-2026-10-09-todo.md). Repeated closed-loop entries and historical migration schedules are not a new execution queue.
