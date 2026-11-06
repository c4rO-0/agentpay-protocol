# Cancellation artifact generation — 2026-10-22

Status: operator offline build and source-bound artifact check passed.

The canonical contracts/scripts/build-deployment-artifacts.mjs now compiles the
three deployment targets using the pinned solc inside the existing offline
Foundry Docker image. It has no network/pull, a read-only container, an explicit
stdin stream, 1 GiB memory/swap cap and bounded CPU/process/time. Other source
files remain part of provenance, but only Vault/Factory/Controller are selected
for bytecode generation. No stale Foundry out artifacts are consumed.

Default output is now contracts/artifacts/deployments within this repository's
ignored tree. AGENTPAY_CONTRACT_ARTIFACT_DIR allows an explicit operator location;
the current parent-workspace diagnostic selects a separate cancellation candidate
directory. The previously deployed bundle and its latest pointer are preserved.
The standalone Protocol script no longer assumes a parent workspace/debug path.

Manifest retains source/standard-input/compiler/file SHA provenance and adds
creation and runtime-template Keccak hashes, immutable-reference classification,
and offline image identity. Verification compares the required public ABI entries
against actual compiler output, validates complete hex bytecode and immutable
ranges, and detects artifact or bytecode-summary tampering. Public types must be
built first; the caller's small TypeScript compilation handles that prerequisite.

Factory/Controller templates with immutable slots are not presented as deployed
runtime hashes. The exact Vault clone hash is computed only from a reviewed actual
implementation address using the canonical EIP-1167 runtime. That future value,
not the implementation bytecode hash or Factory template hash, configures the
Settlement cancellation adapter. No address or hash is activated in this loop.

Four isolated integrity tests passed (tamper, ABI mismatch, immutable/template,
clone address). Syntax/diff checks passed. Operator build/check will establish the
real bundle identity and ABI/bytecode conformance; it has not yet run. Generated
artifacts remain ignored, and no secrets/logs/binary artifacts are committed.

The earlier private deadline-upgrade record and its old bundle are historical.
Do not rerun that deployment command or replace its artifacts as part of this
build-only step. New Factory deployment, Policy migration and automatic closure
remain separate gates.

## Actual build/check

Both build and check returned ok:true for bundle 24975c180fac14383df1. Independent
current source hashing matched all seven source entries recorded by the operator.
Fresh candidate files are under the separately selected cancellation-safety output
directory. Build did not use old Foundry artifacts. Source/compiler/file/ABI and
bytecode checks passed under the recorded offline Docker image with 1 GiB cap.
Sanitized public hashes are in the adjacent JSON record; generated ABI/bytecode
files remain ignored. Existing deployment artifacts, chain and services were not
changed. This supersedes the pending build statements above.

No final deployed clone hash exists yet: it requires the future implementation
address. Automatic closure/refund integration and subsequent reviewed deployment
remain open.
