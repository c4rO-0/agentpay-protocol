> Historical snapshot retained on 2026-10-27. Use current progress/TODO for
> status and sequencing; unchecked items here are not automatically cancelled.

# AgentPay Protocol TODO

- [x] Apply this component's approved simplified dispute-review corrections and
  targeted checks; see the 2026-10-25 correction entry in progress.
- [x] Reviewed private rollout, current scratch MySQL check and exact cleanup
  passed on 2026-10-25. Original 25-Order terms remain unchanged.
- [ ] Actual model/browser/role/financial acceptance remains open.

## Duration and disputes — 2026-10-25 source checkpoint

- [x] Implement this component's approved duration/dispute integration and targeted
  source checks; see current progress and Settlement's dated source-review record.
- [x] Preserve existing Order terms and original request identity; no contract rewrite,
  generic signing or mandatory per-Order owner approval.
- [x] Operator: isolated real MySQL transactions/cleanup passed on 2026-10-25.
- [x] Private coordinated deployment/configuration, Web key exclusion, route
  restrictions and actual service/worker health passed on 2026-10-25.
- [ ] Participant/operator: verify quote acceptance, original-result retrieval,
  withdrawal/reopen, evidence and human decisions; reconcile real private funds.
  Injected-clock tests do not prove day-scale live scheduling or crash recovery.

Updated 2026-10-23. [Progress](../../progress.md) records accepted evidence.
No public-release, real-funds or destructive-operation authorization is implied.

## Closed private loops

- [x] Implement/verify Vault zero-balance cancellation guard: 39 offline Docker Solidity
  tests and 256 positive-balance fuzz inputs; reviewed artifact bundle built.
- [x] Verify new private Factory/Controller deployment and derived clone hash; old Vaults preserved.
- [x] Pack types 0.13.0 and update Settlement/User/Wallet; private Policy migration,
  actual closure/refund/race schedules and refund interruption accounting passed.
- [x] Preserve business-neutral common service references and canonical prefix rules;
  private common-runtime deployment/official test completed, not external harness acceptance.
- [x] Retain owner-only Registry; withdrawn Registrar exploration is not a deployment task.

## Stage 1 — remaining integration

- [ ] Support Settlement's direct-chain funding investigation with exact Module/Vault
  invariants and late-payment/cancel ordering; no unapproved authority restriction.
- [ ] Verify any concrete new consumer mismatch against frozen hashes/ABIs/timestamp
  units. No blanket contract rewrite or forced matching version across all consumers.
- [ ] Complete new endpoint identity/settings and supported harness acceptance with
  the owning components; prefix fixture tests alone do not close those role journeys.

## Stage 2 — release and chosen-network gates

- [ ] Publish reviewed versioned artifacts/types and version notes for current consumers;
  private dependency archives are not public package or User/Wallet release completion.
- [ ] Complete independent security/audit work, full-history secret review and public
  repository hygiene before release. Private Anvil/fork tests do not prove live Base.
- [ ] Verify approved real-network deployment, upgrade/Policy migration and recovery.
- [ ] Specify contract version identification and Provider compatibility before enabling
  multiple generations; review retained legacy artifacts and canary scope explicitly.

## Stage 3 — invitation

- [ ] Verify invited consumers use matching supported artifacts and maintain release/
  incident response procedures. Wider public release needs a separate decision.

## Historical task disposition

[Full prior TODO](before-planning-review-2026-10-23-todo.md) preserves every
original task and link; [prior progress](before-planning-review-2026-10-23-progress.md)
preserves the chronology. Closed deployment/build/rehearsal items are superseded
by current evidence. Combined tasks are split above into completed implementation
and missing acceptance. Any older unchecked detail without explicit closing
evidence remains retained for reconciliation before work is scheduled; archiving
is not cancellation. Earlier documentation-backlog links remain in that snapshot.
