# AgentPay Protocol TODO

## Community readiness polish — 2026-11-06

- [x] Align current entry guides, module ownership and historical-tool labels.
- [x] Format maintained library/tooling source and explain non-obvious invariants.
- [x] Verify unchanged syntax structure, package builds, public checks and tarball consumer.
- [x] Remove private-host instructions from public AGENTS.md and correct the package catalog.
- [x] Ignore environment-file variants and logs while retaining `.env.example`.
- [ ] Owner review before changing source visibility; keep package distribution and audit gates separate.

## Functional test consolidation — 2026-11-06

- [x] Merge duplicate Node CI work; verify independent packed-package consumption.
- [x] Separate default non-fork checks from explicit credentialed fork checks.
- [x] Add real Anvil bounded-payment/release/refund and exact-balance runner.
- [x] Operator: 61 non-fork contract tests and real Anvil replacement passed; launcher cleanup hang fixed and retry completed.
- [x] After replacement passed, removed the synthetic LifecycleHarness test; retain
  core verification/idempotency and contract negative-boundary tests.
- [ ] Inspect actual GitHub CI run and configure branch protection after review.


## Public source preparation — 2026-11-06

- [x] Review current tracked files, retain MIT, clarify independent source build and security contact.
- [x] Replace main with the approved reviewed initial snapshot; remote verification is recorded by the release operator.
- [ ] Verify anonymous public checkout after repository visibility is changed.
- [ ] Publish supported consumer artifacts through the separately agreed distribution design.


## Protocol public distribution — before release

- [ ] Replace the interim `@agentpay/types`/vendored-archive integration with an agreed public distribution plan: package boundaries/name/channel, reproducible versioned artifacts, integrity, compatibility and consumer upgrades. Do not assume npm or the current package name is the final choice. External integration must not require this parent workspace.

- [x] Align Provider HTTP/HTTPS support with types 0.14.1; keep platform credential and local-control protection, original profile hashes and historical identity. Controlled source verification recorded in progress.
- [ ] Coordinate deployment of matching transport validators/artifacts; verify actual Provider onboarding without changing old identities.

Updated 2026-10-27. Tasks below separate remaining acceptance from completed source
work. See [current progress](../progress.md) for evidence and scope.

## Next closed loops

- [ ] Support actual new-rule consumer/financial acceptance without changing old
  Order snapshots. Review independent on-chain schedule guarantees before invitation;
  existing Vault fields do not enforce the full application dispute schedule.

## Stage 1 — remaining integration

- [ ] Support remaining Settlement direct-chain recovery limits with exact Module/Vault
  invariants and late-payment/cancel ordering; no unapproved authority restriction.
- [ ] Verify any concrete new consumer mismatch against frozen hashes/ABIs/timestamp
  units. No blanket contract rewrite or forced matching version across all consumers.
- [ ] Complete new endpoint identity/settings and supported harness acceptance with
  the owning components; prefix fixture tests alone do not close those role journeys.

## Stage 2 — release and chosen-network gates

- [ ] Publish reviewed versioned artifacts/types and version notes for current consumers;
  private dependency archives are not public package or User/Wallet release completion.
- [ ] Complete independent security/audit work, review of the history intended for publication and public
  repository hygiene before release. Private Anvil/fork tests do not prove live Base.
- [ ] Verify approved real-network deployment, upgrade/Policy migration and recovery.
- [ ] Specify contract version identification and Provider compatibility before enabling
  multiple generations; review retained legacy artifacts and canary scope explicitly.

## Stage 3 — invitation

- [ ] Verify invited consumers use matching supported artifacts and maintain release/
  incident response procedures. Wider public release needs a separate decision.

## Retained history

[Prior TODO](archive/before-doc-consolidation-2026-10-27-todo.md) preserves every
original task and link. Duplicate deployment/connection tasks are consolidated
above; full-Safe owner website proof is superseded by Wallet-only access. Completed
source tests do not close actual participant or financial acceptance. Other old
unchecked limits remain retained and must be reconciled before scheduling related work.
