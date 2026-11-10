# Developer guide

Start with the [README](../README.md) for installation and the
[architecture](architecture.md) for component boundaries. You can build and test
this repository without checking out Market, Settlement, User or Wallet.

## Choose the right location

| Change | Start in | Keep aligned |
| --- | --- | --- |
| Custody, payment limits, Registry or authority | `contracts/src/` | Public ABI, contract behavior tests and affected consumers |
| Public message or validation | `packages/types/src/` | Export, JSON schema, fixtures, documentation and version decision |
| Canonical hash/signature | `packages/types/src/`, escrow commitment helpers | Existing byte vectors, signer/verifier interoperability |
| Funding/commitment verification | `packages/x402-escrow/src/` | Public API negative cases and chain evidence rules |
| Packaging or CI | `scripts/`, `.github/workflows/` | Independent consumer and clean-checkout verification |

Examples may illustrate a particular business; public types and core verification
must not require a new adapter or branch for each service. Price policy, private
inputs/outputs, database ownership and production orchestration belong to consumers.

## Read the payment boundary first

1. `AgentPaySpendingModule.sol`: signed commitments, Policy limits and replay protection.
2. `SkillRegistry.sol`: qualified service identity, not quality or price approval.
3. `AgentPayEscrowFactory.sol` and `OrderEscrowVault.sol`: deterministic custody,
   funding/activation, delivery deadline, terminal settlement and timeout exit.
4. `SettlementAuthorityController.sol`: narrowly delegated operations and roles.
5. `packages/types/src/canonical-terms.ts` and `agentpay-safe-module.ts`: shared
   representations/hashes; `packages/x402-escrow/src/agentpay.ts`: signature verification.

The historical direct-funding reference and DealManager demo are useful evidence,
not the implementation to copy for new bounded authorization integrations.

## Make changes reviewable

Use descriptive names and ordinary multiline control flow. Explain *why* a guard
exists, which party supplies a value, its units and the boundary it protects. Avoid
comments that repeat an assignment. Keep comments accurate when behavior changes.

Preserve canonical serialization order, error codes, wire fields and ABI behavior
in a readability-only change. Do not replace explicit validation with coercion or
introduce defaults that silently select a network, service or signing identity.
A schema or hash change needs a compatibility decision and consumer impact review.

TypeScript/JavaScript formatting follows Prettier 3.6.2 defaults. To format only
files you edited, run `pnpm dlx prettier@3.6.2 --write PATH...`. Do not reformat
fixtures or generated release artifacts as a side effect; byte changes can matter.
Solidity follows the existing layout and NatSpec conventions.

## Verify the behavior you changed

- `pnpm test:packages`: workspace build, public boundary tests and independent
  tarball consumer. `pnpm test` and `pnpm conformance:test` are aliases; do not run
  all three expecting different coverage.
- `pnpm test:chain`: after package builds, non-fork Solidity tests, compiled ABI
  comparison and real Anvil payment lifecycle. Requires Forge and Anvil.
- Optional Base forks: explicitly requested workflow with `BASE_RPC_URL` configured.

Prefer complete feature outcomes over tests of private implementation structure.
Keep precise tests for hashes, signatures, units, permissions, financial limits and
concurrency. A mock is not evidence of actual process recovery or a live payment.
See [verification scope](reference/testing.md) before claiming acceptance.

On hosts that cannot run native Foundry, use the reviewed Docker/pinned-solc
procedure. No full chain rebuild is needed for prose-only changes. Never point
fixture signing keys at a public network.

## Submit a change

Describe the behavior/problem, compatibility impact and checks performed. For
protocol changes, update schemas, fixtures and normative documentation together.
Do not include credentials, private RPC endpoints, local wallet files or generated
runtime logs. Public non-secret deployment records need review and exact provenance.

Read [contribution guidance](reference/CONTRIBUTING.md) and use
[private security reporting](security/SECURITY.md) for vulnerabilities.

## Verifier dependency verification

`pnpm test:packages` runs the independent package-consumer check. It covers both
locally packed candidate types and a clean verifier installation using its declared
public npm Protocol version, without workspace overrides. Native escrow cases use
fixtures shipped by the installed Protocol package. Optional CDP adapter coverage
is a separate test in the workspace, where its SDK peer dependencies are installed;
passing native installation does not establish a standalone CDP installation.

Chain CI explicitly builds local types and the private verifier before ABI and
Anvil checks. The verifier's npm dependency does not build local types implicitly.
