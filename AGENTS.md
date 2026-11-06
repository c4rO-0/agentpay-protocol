# Protocol Development Instructions

## Behavior-first verification — 2026-11-06

- Prefer end-to-end tests through real product entry points and public interfaces.
  Test observable behavior and user outcomes, not internal implementation shape.
  Use real processes, storage and Anvil where the claim depends on them; do not
  substitute direct database writes or internal-state injection for the workflow
  being accepted. Controlled fixtures may prepare prerequisites.
- Select meaningful complete journeys and failure boundaries: independent install/
  package consumption, authorization, payment, delivery, settlement/refund, denied
  access, duplicate requests and interrupted-operation recovery as applicable.
  A test should demonstrate a functional requirement or a concrete regression.
- Avoid tests that merely mirror implementation, assert source text/private helper
  structure, or repeat the same coverage without a distinct failure boundary.
  Syntax, type and build checks are useful checks, not functional acceptance.
- Keep focused tests for signatures, canonical hashes, amount/time boundaries,
  authorization and concurrency invariants when they give precise protection that
  end-to-end tests alone cannot efficiently provide. End-to-end preference does
  not remove negative security or financial-boundary coverage.
- Review existing tests by the same standard. Consolidate redundant tests only
  after equivalent meaningful coverage passes; do not delete a regression merely
  because it is a unit test. Do not inflate test counts as a measure of readiness.
- Label mocked external dependencies and evidence limits explicitly. Simulated
  success does not prove real process recovery, real payment or participant usability.
  Keep tests bounded to the change and use maintained fixtures; this principle does
  not authorize live funds, public-network operations, destructive resets or broad
  resource-heavy test runs.



## Network portability invariant — 2026-11-04

Develop and verify the same product flows on Anvil. Moving to a supported EVM
network must use configuration, deployment artifacts and explicit signer selection,
not a separate implementation of authorization, payment or recovery. External-owner
signing must be testable against Anvil as well. Keep test signer guards and private
reset/funding tools restricted; never remove them to make a product entry portable.
Chain ID is identity, not permission to select an unlocked test signer. Network
capabilities/finality and deployment addresses are explicit validated settings.
Changing networks never silently rewrites saved Policies, Orders or request identity.
Anvil results do not establish real-network compatibility or release approval.

Protocol is the public source of truth for
contracts, schemas, ABIs, hashes, fixtures, and conformance. Changes must remain
provider-neutral and preserve bounded automatic authorization. Do not add
Settlement commercial policy or arbitrary Controller calls on-chain.

Read `README.md`, `progress.md`, `doc/design.md`, and `doc/TODO.md`. Contract or
wire changes require negative tests, fixture updates, consumer impact review,
and an explicit versioning decision.

## Business-neutral public protocol

Public contracts, types, schemas, hashes and conformance describe common service
invocation and payment rules. Never embed a particular service business in them:
for example, do not add an `agentpay.random.v1` adapter enum, min/max input fields,
or random-result validation to a shared interface. Random-number behavior belongs
to the reference Skill and Provider; other businesses use the same public contract.

Examples and fixtures may demonstrate business payloads without making their
shape a protocol requirement. Generic identity, authorization, usage and hash
validation must remain enforced. A new business must not require a new protocol
variant merely because its input or output differs.

Review all consumers before introducing shared interfaces and verify at least two
different business payloads against the common contract. Do not retain a business
variant for convenience or legacy-example compatibility. Report existing coupling
and its impact before removing released interfaces; never reinterpret existing
orders or change frozen hashes silently. This rule also applies to unpublished
candidate schemas and types, not only deployed Solidity contracts.

## Local verification

Follow `doc/usage.md` and `doc/reference/testing.md` from this repository's root.
Package checks require Node and pnpm; chain checks additionally require compatible
Foundry and the compiler/settings in `contracts/foundry.toml`. Deployment artifact
build instructions live in `contracts/README.md`. Do not assume a parent workspace,
private scripts, pre-existing services or operator credentials are available.
Keep local tests on disposable chains; do not substitute a live deployment when
local tooling is unavailable. Report the missing prerequisite instead.

## Human-facing documentation review

README files and installation, usage and contributor guides are written for people,
not as inventories for an AI or as implementation logs. After every documentation
change, reread the result from its intended reader's perspective before reporting
completion. Check that:

- The opening explains what this is, who it serves and what the reader can do next.
- Instructions state prerequisites, copyable steps and expected outcomes without
  assuming private workspace knowledge or prior conversations.
- Necessary terminology is introduced where used; API catalogs, historical changes
  and detailed invariants belong in linked references, not the introduction.
- Commands, examples, links and version/status claims match the actual product.
- Repetition and unnecessary caveats do not bury the main action; material limits
  remain clear and proportionate.

Link and syntax checks do not replace this editorial review. Fix readability issues
found during the review; report unresolved gaps rather than claiming the guide is ready.

## Documentation navigation

Use `doc/README.md` to select documents by role and function. Keep current work in
`progress.md` and `doc/TODO.md`; put dated verification in `doc/records/` and superseded
chronology in `doc/archive/`. Archived pending tasks do not authorize repeating old
operations. Keep this repository independently readable; do not link parent workspace
documentation. Update local links and the catalog when reorganizing documents.

## Public distribution boundary

The approved public core package is `@c4roa0/agentpay-protocol`, maintained in
`packages/types`. Other workspace packages remain private. Follow
`doc/runbooks/npm-publication.md` before publishing; source changes alone do not
authorize registry upload. Existing consumers retain their vendored dependency
until separately upgraded after publication. Preserve frozen wire/hash identities.

## Public source preparation — 2026-11-06

Treat every commit, tag and release artifact as public disclosure. Keep credentials,
private RPC URLs, local runtime data and signed private payloads out of Git. Test
keys must be clearly scoped, disposable fixtures, never operational identities.
Source publication does not authorize npm publication, chain deployment or real funds.
Public history starts with a reviewed initial snapshot by owner request;
do not restore the old history by merging a stale clone. Preserve original hashes in
historical deployment records; they do not identify the new snapshot's deployed code.
