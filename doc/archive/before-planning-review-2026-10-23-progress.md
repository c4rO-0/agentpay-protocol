> Historical snapshot before the 2026-10-23 planning review. Dates, pending labels
> and “next” instructions describe their original checkpoint. Use current progress
> and TODO for scheduling. Unresolved tasks remain retained, not cancelled.

# AgentPay Protocol Progress

## Private contract/runtime rollout — 2026-10-22

Reviewed cancellation bundle deployed a new Factory/Controller in private Anvil
blocks 105/106. Implementation runtime, canonical deployment receipts and roles
passed; the clone hash is derived from its actual implementation address.
Types 0.13.0 was packed and installed in Settlement; its runtime switch and 74
related regressions passed. Closure remains off and admission closed. Test Safe
Policy migration, actual cancellation/refund/restart accounting and other consumer
integration remain open. This does not update old Vault bytecode or establish a
public release. Earlier source/build checkpoints below retain their dated scope.


## Order closure v1 — source candidate

Types 0.13.0 adds a separate closure-v1 type, validator and schema alongside
waiting-v1. Two closure cases and TypeScript compilation passed; frozen participant
objects, canonical hashes and signing authority are unchanged. This is not a
consumer dependency rollout or activation. The coordinated new-Factory/clone-hash,
Policy and actual cancellation/refund gates remain open.

## Cancellation artifacts — build and check passed

Canonical builder uses pinned solc in offline Docker, with a 1 GiB cap and only
three bytecode targets. It verifies required ABI entries, source/compiler/file
hashes and creation/runtime-template hashes; immutable templates and deployed
clone hashes are distinguished. Four integrity tests passed. Candidate output is
separate from existing deployment artifacts. Operator build/check passed for bundle 24975c180fac14383df1; current source
hashes independently match the manifest. No contract, configuration switch or
financial action occurred.


## Vault cancellation safety — isolated tests passed

Source adds an atomic zero-payment-token-balance guard to cancelUnfunded and
both funding/cancellation ordering tests. Settlement adds an explicit cancel action
requiring a reviewed Vault code hash and matching successful cancellation receipt.
Twenty JavaScript cases passed. Operator offline Docker compilation and all 39
Solidity tests passed, including 256 positive-balance fuzz inputs and both funding/
cancellation orderings. No new contract or live cancellation is claimed.
Old Vaults/Factory are unchanged; automatic cancellation remains disabled.


## Five-minute waiting deadlines — source verified, not deployed

[Implementation and gates](../records/order-waiting-v1-2026-10-22.md). New native Orders freeze payment due
from preparation and response due from mined funding time. Issuance/claim/retries
cannot renew the clock; older Orders retain original terms. No new tables.
Types 0.13.0 waiting-v1 candidate and targeted regressions passed. Cancellation,
automatic refunds, safe Vault closure and consumer release/deployment remain open.
Do not deploy this source loop ahead of the closure workers.


## Business-neutrality correction — source verified, 2026-10-21

Current source separates common service invocation from application behavior.
See [implementation and validation](../records/business-neutrality-source-2026-10-21.md).
Deployment, existing-request review and actual official paid acceptance remain
pending. Prior candidate/selected-random entries below are earlier checkpoints,
not the current interface. No live service, database or chain state changed.


## Provider path prefixes: types 0.11.1 — 2026-10-20

Canonical controlled URLs may have safe prefixes; payment endpoints retain them.
Old root-path vectors and profile v1 serialization/hash remain unchanged. Package
patch 0.11.1 has fixed prefixed vectors and negative tests; all nine types test
files pass. No contracts/ABI change or deployment. See
[version decision](../records/provider-prefix-types-0.11.1-2026-10-20.md).

## Three-stage release responsibilities — 2026-10-19

Current stage: **1 — Private end-to-end acceptance**. Stage 2 (real-network
integration) and Stage 3 (limited invitation test) remain open. A stage label does
not authorize live funds, chain deployment, public ingress or deletion/reset.

### Stage 1 — Private end-to-end acceptance

Maintain current ABI/hash/timestamp conformance for private role journeys and failure cases. Existing owner-only Registry remains the target; the withdrawn Registrar exploration is not scheduled for deployment.

### Stage 2 — Real-network integration

Finalize selected contract/artifact versions, security/audit and public-release hygiene; verify real-network deployment and upgrade/Policy migration behavior. Specify Provider compatibility before multiple generations are enabled.

### Stage 3 — Limited invitation test

Publish reviewed versioned artifacts/support limits and verify invited consumers use matching contracts; retain security incident/release response. Private/fork tests are not live-network or audit acceptance.

These stage responsibilities determine current sequencing. Earlier dated work
below retains its evidence and unresolved backlog; it is not an instruction to
repeat superseded deployments or old registration flows.

## Earlier component checkpoints


Updated 2026-10-09. Audience: maintainers and AI assistants planning work.

## Completed baseline

Epoch timestamp contracts/fixtures and consumer artifacts were committed. Chain time units and signed boundaries remain explicit. Private contract and Base-fork evidence does not establish a live Base deployment or audit.

[Component evidence](../records/README.md). Source checks, private execution and human usability are distinct evidence levels.

## Current work

The proposed Registrar contract and ABI change was withdrawn after the
2026-10-15 product decision. The existing owner-only Registry and published
ABI remain the target. The earlier offline Registrar test is historical
exploration, not a deployment instruction. No new contract or Policy migration
is required solely for automatic registration; the Registry owner must instead
be transferred to Settlement's dedicated signer before enabling its worker.
That private transfer and automatic first-write/restart verification subsequently
passed on 2026-10-15–16; no contract or ABI change was deployed.

The agreed sequence is User terminal operations → Provider guided onboarding → Market guidance/package distribution → full private human walkthrough. This repository owns the following part:

- Check published types/ABIs/artifacts when onboarding consumers expose a concrete mismatch; no contract rewrite is assumed for UI work.
- Keep exact timestamp units and frozen signature/hash rules explicit in reference documentation.

## Later / release gates

- Specify contract version identification and Provider requirements before multi-generation support.
- Complete release artifacts/version notes, audit status, public repository hygiene and full-history secret review before publication.
- Review retained legacy reference artifacts and live-network canary gates with exact consumer evidence.

## Documentation checkpoint

Role/function navigation and current status were reorganized on 2026-10-09. No application behavior or service state changed. Concrete implementation and state writes follow the agreed scope.

## History

[Earlier progress](before-doc-organization-2026-10-09-progress.md) · [Evidence index](../records/README.md) · [Current TODO](../TODO.md). Old “next step” entries are historical, not instructions to repeat completed work.
