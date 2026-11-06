# Unfunded cancellation safety — 2026-10-22

Status: source candidate; operator offline Solidity compilation/tests passed.
No new contract, Factory, Policy or financial job is deployed/created.

## Contract and race boundary

Vault cancelUnfunded now requires both Created and zero payment-token balance.
Module funding and Vault activation remain separate transactions. Serialized EVM
ordering yields: cancellation first blocks Module funding before budget/nonce/
balance mutations; funding first leaves a positive Created balance, so cancellation
reverts and activation/refund remain available. Partial deposits and prefunding
the predicted address also block unsafe cancellation. Arbitrary token donations
after cancellation and partial deposits need explicit recovery handling, not an
automatic claim that all assets were refunded.

Added contract cases cover both orderings through actual SpendingModule, refund
balance versus cumulative Policy budget, fuzzed positive Created balances,
predicted-address prefunding and the narrow Controller forwarding path. Existing
escrow, Controller and authorization-flow suites are selected for offline tests.

## Settlement adapter

Authority action dispatch explicitly allows delivery/release/refund/cancel_unfunded.
Cancellation uses cancelUnfunded(vault), with terminal state Cancelled (6), never
Refunded (5), and no invented refund amount. Unknown/prototype action names and
foreign controllers are refused before signing.

Cancellation additionally requires a configured safeCancellationVaultCodeHash:
exact reviewed deployed clone runtime hash, not a new user-supplied request field.
No hash means cancellation unavailable. It verifies exact Vault Order identity and
zero payment-token balance before preparation. The on-chain balance check remains
the race authority; these preliminary RPC reads alone would not make old Vaults
safe. Completion requires a successful receipt with VaultCancelled for the same
Vault/Order. A state read alone is insufficient transaction evidence.

The parameter is not yet wired into runtime/environment or a new financial job
scheduler; automatic cancellation stays disabled until deployment/artifact review
and closure-worker integration. This does not introduce multi-generation support.

## Validation

JavaScript tests: cancellation adapter 4, Authority worker regression 6, Authority
job timestamp regression 10; all passed with isolated mocks. Syntax/diff checks
passed. Operator executed the prepared script successfully using
existing offline Foundry image, pinned solc, disabled networking, read-only source
and 1 GiB Docker memory cap. Do not report compile/conformance success yet.

## Deployment impact and next gate

Factory implementation is immutable and created in its constructor. New Vault
behavior requires a newly deployed Factory, new authoritative artifacts and the
existing Policy migration flow for users moving to it. Old Vault code is unchanged;
the retained unpaid rehearsal Order must not use new automatic cancellation on
its old Vault. No existing Factory/Policy or chain address is edited here.
After tests, regenerate/verify reviewed bytecode artifacts and integrate durable
cancel/refund jobs and racing funding reconciliation before private migration.

## Operator Solidity result

Solc 0.8.24 compiled ten files successfully in 30.70 seconds under the offline
1 GiB Docker cap. All 39 tests passed: AuthorizationFlow 10, AuthorityController 8,
EscrowFactory 21. The positive Created-balance fuzz case ran 256 inputs. Both
cancel-before-funding and funding-before-cancel cases passed, including Safe budget/
nonce/balance preservation and funded refund recovery. No RPC/deployment/database
operation was performed. This is isolated EVM evidence, not a live race rehearsal.

Next: reproduce/persist reviewed artifacts and verify runtime hashes, then wire
closure/refund jobs. Existing deployments and the retained unpaid Order still use
old Vault code. No new generation is enabled by the successful tests alone.
