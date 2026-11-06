# AgentPay Protocol Progress

## Pre-publication follow-up — 2026-11-06

Removed private parent-workspace/debug instructions from Protocol's AGENTS.md;
standalone contributors now use repository-local verification guides. Updated the
package catalog to distinguish implemented Controller artifacts, historical evidence
and pending distribution/audit gates. Ignore rules now cover `.env.*` and logs,
while retaining `.env.example`. Local links, ignore behavior and whitespace checked.
No application code or repository visibility changed.

## Community readability pass — 2026-11-06

Current README, installation/development/contribution guides and module map now
separate native bounded payments from historical direct-funding/DealManager tools.
Corrected stale Node guidance, phase labels, Provider/Runtime ownership, network
assumptions and package-reference links. Added root contribution/security entries.
Maintained TypeScript/JavaScript validators, escrow helpers, artifact tooling and
CI runners are formatted; comments explain hash ordering, timestamp units,
projection versus authority, durable replay storage and immutable runtime hashes.
No Solidity, wire fields, schemas, fixtures, package versions or financial behavior
changed. Syntax-tree comparison passed for all 28 reviewed source files, ignoring
comments/formatting and redundant expression parentheses. Full package verification
passed: builds, 51 types tests, 10 escrow tests, 3 demo tests and an independent
packed consumer using two payloads. Initial sandbox run could not open the tsx
pipe; unrestricted retry passed. No new chain/deployment acceptance is claimed.
Owner reports hosted Actions deprecation warnings are gone; branch protection and
public anonymous checkout remain separate gates. See
[polish record](doc/records/community-polish-2026-11-06.md).

## Clean-source package CI correction — 2026-11-06

Participant reports hosted chain job passed and package job failed. Independent
source review found the types suite reading ignored contracts/out artifacts that
exist locally but are not built by the package job. Moved the Controller ABI check
to the chain job after Forge compilation; it remains mandatory. A temporary fresh
source tree with no contracts/out passed CI=true package checks, reusing installed
dependencies/offline cache; relocated ABI check also passed. Hosted failure logs
were not available anonymously, so correlation with that exact failure and the
next hosted run remain pending. No contract or financial logic changed.


## Functional CI and test consolidation — 2026-11-06

Default CI now separates independent packed-consumer checks from local contract/
Anvil transaction behavior; external Base forks are explicit manual checks.
Duplicated Node CI jobs merged; reference syntax-only test removed (build still
checks syntax). Retain precise public API/financial-boundary coverage. The synthetic
LifecycleHarness test was removed after the real-chain replacement passed.
Workspace build and public API/boundary tests passed (52 types, 12 escrow including
that retained harness, 3 demo tests). Independent tarball consumer install/import
and two-payload checks passed. Initial offline consumer run lacked a cached public
dependency; network-enabled isolated retry passed. Operator execution passed all 61 non-fork contract tests and the real Anvil
transaction flow. A launcher shutdown hang was fixed; the second run reached the
final success line and its temporary directory was removed. No production contract
logic changes or existing-service actions. See doc/reference/testing.md and
[verification record](doc/records/functional-ci-2026-11-06.md).


## Public source preparation — 2026-11-06

Owner approved publishing Protocol first and replacing main history with one initial
snapshot. MIT retained; current tracked files reviewed for credentials and private
configuration. Node probe wrappers now use PATH or explicit NODE_BIN instead of a
parent checkout. Source visibility, package distribution and deployment are separate.
See [public source review](doc/security/public-source-review-2026-11-06.md).
No public package, contract deployment or production acceptance is implied.


## Protocol distribution — temporary integration, 2026-11-02

Protocol is intended for future public release. The current `@agentpay/types`
package arrangement and repository-local `vendor/protocol/*.tgz` dependencies are
an interim integration mechanism, not the approved final public distribution design.
Do not assume the current package name, package boundaries, registry or delivery
channel is settled. No publication is authorized by this note.

Before release, agree the public artifact/package layout, distribution channel,
version/compatibility policy, reproducible builds and integrity verification, and
consumer upgrade procedure. External developers must be able to integrate without
this parent workspace or manually copying archives between our repositories.
Changing distribution must preserve frozen schemas, hashes and historical Order/
Policy identities; package versions and deployed contract generations are distinct.

## Provider transport alignment — source verified, 2026-11-02

HTTP/HTTPS Provider profiles and retrieval are separated from platform login and
credential transport. Types 0.14.1 keep existing profile hashes and canonical paths;
User/Wallet/Agent/Settlement artifacts and locks match. Platform credentials and
local control boundaries remain. Literal loopback registration still needs the
operator option; no general HTTP rehearsal exception. No contract/DB/Policy writes.

Controlled verification: Protocol 10, Agent 17, Settlement 33, User 22 tests passed;
Wallet no-emit typecheck and installed-consumer hash parity passed. No service
restart, actual new registration or paid purchase. Coordinated rollout is pending.
Customer platform/path assumptions and remaining review findings stay open.

Updated 2026-10-27.

Stage 1 — private end-to-end acceptance remains open. Private evidence does not
approve real funds, a real-network deployment or general public invitation.
Recorded deployment state is dated evidence, not a fresh live health check.

## Current state

Public contracts/types remain business-neutral. Cancellation Factory/Controller
and bounded transaction schemas have compilation/conformance and selected private
financial evidence. Duration/dispute types and consumers were integrated; existing
Order hashes and snapshots are not reinterpreted.

Direct-chain boundaries were characterized and selected Settlement recovery cases
were verified; this is not arbitrary unknown-Vault or deep-reorg acceptance.
Existing Vault contracts do not independently enforce the full off-chain dispute
schedule. That limitation requires explicit launch review, not an assumption that
the application review changed contract guarantees.

No contract build/deployment is required by this documentation cleanup. On this
host use the established offline Foundry Docker/pinned-solc procedure for any later
contract checks; do not use the incompatible local Forge binary.

## Next closed loop

Support concrete consumer/transaction-rule acceptance and launch schedule-guarantee
review. Publish reviewed matching artifacts only after the agreed release check.

## Evidence and history



[Evidence index](doc/records/README.md) · [Actionable TODO](doc/TODO.md) ·
[Prior progress](doc/archive/before-doc-consolidation-2026-10-27-progress.md).
Source tests, operator deployment and participant outcomes are separate claims.
Older pending labels do not override this summary; unresolved limits remain in TODO.
