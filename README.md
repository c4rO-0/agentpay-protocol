# AgentPay Protocol

AgentPay lets an AI agent purchase services within a budget approved by its user.
This repository defines the contracts, message formats and verification rules that
make those payments independently checkable. A Safe holds the funds; its owner
creates a bounded Policy, and a delegated key authorizes eligible payments without
another owner signature for every order.

This is the protocol repository for developers and integrators. Wallet key storage,
service execution, marketplace accounts and production Settlement workers live in
separate projects.

## Start here

Use Node **22.22.3** and pnpm **10** to match CI. Solidity checks additionally need
Foundry; the compiler/settings are pinned in `contracts/foundry.toml`.

```bash
git clone https://github.com/c4rO-0/agentpay-protocol.git
cd agentpay-protocol
corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install --frozen-lockfile
pnpm test:packages
```

The package check builds the workspace, tests public API boundaries, then installs
packed libraries in a temporary consumer. It needs no wallet, database or RPC
credentials; dependency downloads may require network access.

With Foundry installed, continue with:

```bash
pnpm test:chain
```

This runs local contract tests and real transactions on a disposable Anvil. The
integration uses a Safe-interface fixture and checks bounded payments, replay
rejection, delivery, release/refund and balances. It is not a production Safe or
full-platform acceptance test. [Testing details](doc/reference/testing.md).

## Repository map

| Location | Purpose |
| --- | --- |
| `contracts/src/` | Spending Module, Registry, deterministic Factory, per-order Vault and restricted Authority Controller |
| `packages/types/` | Public types, canonical hashes, ABIs, JSON schemas and shared fixtures |
| `packages/x402-escrow/` | Payment requirements, commitment and funding-evidence verification; optional facilitator adapters |
| `packages/x402-reference/` | Historical direct-funding HTTP example; not the native authorization flow |
| `contracts/scripts/` | Source-bound deployment artifact generation and integrity checks |
| `scripts/` | Current verification/packaging entries and clearly scoped historical tools |
| `server/`, `spikes/` | Legacy demo and experimental reference code; not production Settlement |
| `doc/` | Architecture, integration rules, contribution guidance and dated evidence |

Read [architecture](doc/architecture.md) for the payment flow and trust boundaries.
For protocol changes, start with [contributing](doc/reference/CONTRIBUTING.md).

## Integrate and contribute

- [Install, test and produce local packages](doc/usage.md)
- [Developer guide](doc/develope.md) and [protocol design](doc/design.md)
- [Public package exports](packages/types/README.md) and [contract guide](contracts/README.md)
- [Documentation catalog](doc/README.md), [progress](progress.md) and [remaining work](doc/TODO.md)
- [Security reporting](doc/security/SECURITY.md)

Workspace packages remain `private: true` to prevent accidental registry publication.
Source is MIT licensed; public package naming/distribution and compatibility policy
are still being finalized. `pnpm artifacts:pack:settlement` creates local consumer
archives and prints their SHA-256 values; it does not publish or deploy anything.

## Status and limits

The repository has not completed an independent security audit. Local tests and
historical fork/deployment records do not authorize real-funds use or certify the
current source as deployed. Registry qualification verifies service identity/control,
not service quality. Dispute decisions and scheduling are Settlement responsibilities;
Vaults enforce their documented on-chain constraints.

Canonical bytes, signed field meanings and existing Order/Policy identities must
remain stable across maintenance changes. Historical records retain their original
scope and source identifiers; they are not current installation instructions.

[MIT license](LICENSE) · [Model-facing development instructions](AGENTS.md)
