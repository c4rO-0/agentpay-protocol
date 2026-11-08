# AgentPay Protocol TODO

## Tag-triggered publication

- [x] Use matching `vX.Y.Z` tags for npm publication; retain verification gates.
- [x] Owner confirmed release tags allowed in the GitHub `npm-publish` environment.
- [ ] Verify the first tag-triggered OIDC publication and registry integrity.

## CI package rename follow-up

- [x] Fix chain-job dependency build and verify from a clean checkout without dist files.
- [ ] Confirm the complete GitHub chain job after pushing the workflow correction.


## Package documentation follow-up

- [x] Rewrite npm/GitHub homepages, retain API notes, verify links and runnable examples.
- [x] Prepare and verify documentation-only 0.14.2; owner approved publication.
- [x] Publish 0.14.2 and verify registry integrity, latest tag and new README.


## Community readiness polish — 2026-11-06

- [x] Align current entry guides, module ownership and historical-tool labels.
- [x] Format maintained library/tooling source and explain non-obvious invariants.
- [x] Verify unchanged syntax structure, package builds, public checks and tarball consumer.
- [x] Remove private-host instructions from public AGENTS.md and correct the package catalog.
- [x] Ignore environment-file variants and logs while retaining `.env.example`.
- [x] Owner reviewed and enabled public source visibility; package distribution and audit remain separate gates.

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
- [x] Verify anonymous remote refs after public visibility: main `1c6ffab`; no published tags at review.
- [ ] Verify a complete anonymous fresh clone and source ZIP installation.
- [x] Publish and verify the approved public core npm artifact; other workspace packages remain private.


## Protocol public distribution — before release

- [x] Select `@c4roa0/agentpay-protocol` on npm; prepare core metadata and internal imports.
- [x] Verify the prepared tarball and independent consumer before first npm upload.
- [x] Owner-approved first upload and independent registry install verification.
- [ ] Upgrade external consumers separately after their compatibility checks.
- [x] Implement manual GitHub OIDC publication workflow and operator guide.
- [x] Owner completed OIDC publication; public 0.14.3 and provenance confirmed.

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
