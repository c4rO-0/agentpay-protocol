# Functional CI consolidation — 2026-11-06

## Change

Merged duplicated Node workflow jobs into one build/boundary/package-consumer job.
Removed the reference syntax-only test alias; syntax remains a build check.
Removed two LifecycleHarness tests after their real-chain replacement passed:
that harness maintained its own state rather than executing the actual Vault.
Retained public signature/hash/schema/time/permission checks and contract financial
negative tests because they cover distinct failure boundaries.

Added independent tarball install/import verification and a disposable Anvil
JSON-RPC lifecycle. Default CI needs no external RPC; Base fork checks require an
explicit manual dispatch and configured secret. The workflow does not publish or
use live funds. Actual hosted GitHub run and branch protection remain pending.

## Evidence

- Workspace build passed. Types 52, escrow 12 (before removing the two synthetic
  lifecycle cases), demo server 3 tests passed.
- Independent temporary consumer installed packed types and escrow with lifecycle
  scripts disabled, imported public code/schema/ABI, and exercised two distinct
  business payloads. Passed. An initial offline attempt lacked cached transitive
  dependencies; the network-enabled temporary install passed.
- Operator-run offline Foundry Docker: 61 non-fork contract tests passed, no failures.
- Disposable Anvil: one bounded Policy, two delegate-signed payments with no extra
  owner actions, replay rejection, delivery, release/refund and terminal replay
  rejection. Initial token balance 5,000,000; final buyer 4,050,000, seller 900,000,
  fee 50,000; both Vaults empty; Policy spent 2,000,000. Passed.
- First run passed functional assertions but hung on Docker-launcher pipe cleanup.
  Launcher signal forwarding and runner pipe closure were repaired. Second operator
  run reached the outer final success line; temporary test directories were absent
  afterward. Docker removal is performed by the operator wrapper, not independently
  inspected by the unprivileged assistant.
- After removal, remaining escrow core tests rerun: 10 passed, zero failures.
- JavaScript/shell syntax and diff whitespace checks passed.

This uses the maintained FlowSafe interface fixture, not production Safe. It does
not establish Wallet/Settlement process recovery, public-testnet acceptance,
multisig behavior or production security. Existing rehearsal services and chain
were not test targets. No production Solidity logic was changed.
