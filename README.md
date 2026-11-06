# AgentPay Protocol

AgentPay lets AI agents purchase services within a budget approved by their user.
A Safe smart-contract wallet holds the funds and enforces spending limits; eligible purchases do not
require another owner signature for every order.

This repository defines the public contracts, message formats and verification
rules behind those payments. It includes a JavaScript/TypeScript package for
integrators and Solidity contracts for protocol developers.

## Use the npm package

For Wallet, Provider and platform integrations:

```bash
npm install @c4roa0/agentpay-protocol
```

Use the shared helpers to compute protocol hashes, validate messages and consume
contract ABIs. For example, save this as `example.mjs`:

```js
import { hashPrivateRequest } from '@c4roa0/agentpay-protocol';

const requestHash = hashPrivateRequest({
  text: 'Hello, world!',
  targetLanguage: 'fr',
});

console.log(requestHash);
```

Run `node example.mjs`. It prints a request hash: `0x` followed by 64 hexadecimal
characters. This example does not
create an order or make a payment. See the [package guide](packages/types/README.md)
for usage and the [API notes](doc/reference/public-package-api.md) for details.
You do not need to clone this repository to use the npm package.

If you want to install and use AgentPay rather than develop an integration, start
with [AgentPay User](https://github.com/c4rO-0/agentpay-user).

## How the pieces fit together

| Component | Responsibility |
| --- | --- |
| Safe and Spending Module | Hold funds and enforce bounded payment authorization |
| Registry | Record qualified service identities; qualification is not a quality guarantee |
| Factory and per-order Vault | Create escrow accounts and enforce the order's on-chain settlement rules |
| Authority Controller | Restrict the operations delegated to Settlement |
| Public package | Share types, hashes, validation helpers, ABIs, schemas and fixtures |

Wallet key storage, Provider service execution, Market accounts and Settlement
operations belong to separate projects. Read the [architecture](doc/architecture.md)
for their roles and trust boundaries.

## Develop the protocol

Clone the repository when changing contracts or libraries, or contributing tests
and documentation. Use Node **22.22.3** and pnpm **10** to match CI. If Corepack is
missing, install it with `npm install --global corepack` using your Node installation.

```bash
git clone https://github.com/c4rO-0/agentpay-protocol.git
cd agentpay-protocol
corepack enable
corepack prepare pnpm@10.0.0 --activate
pnpm install --frozen-lockfile
pnpm test:packages
```

The package checks build the workspace and exercise public interfaces, including
installation into an independent temporary project. No wallet, database or RPC
credentials are required.

With compatible Foundry installed, run `pnpm test:chain` for contract tests and
transactions on a disposable Anvil. The compiler settings are in
`contracts/foundry.toml`. These tests use a Safe-interface fixture; they are not
production Safe or full-platform acceptance. See [testing](doc/reference/testing.md)
and the [developer guide](doc/develope.md).

## Find your way around

| Location | Contents |
| --- | --- |
| `contracts/src/` | Public Solidity contracts |
| `packages/types/` | Source of the published `@c4roa0/agentpay-protocol` package |
| `packages/x402-escrow/` | Workspace library for payment verification and facilitator adapters |
| `contracts/scripts/` | Deployment artifact generation and integrity checks |
| `scripts/` | Verification and packaging tools, plus labeled historical tools |
| `doc/` | Specifications, developer guides and verification records |

`packages/x402-reference/`, `server/` and `spikes/` contain historical examples or
experiments. They are not the production Settlement implementation. Only the core
package is published to npm; the other workspace packages remain private.

## Documentation and contributing

- [Documentation catalog](doc/README.md) — choose a guide by role or task.
- [Contracts](contracts/README.md) and [protocol design](doc/design.md).
- [Contributing](doc/reference/CONTRIBUTING.md) and [security reporting](SECURITY.md).
- [Progress](progress.md) and [TODO](doc/TODO.md) — current development scope.
- [Publication guide](doc/runbooks/npm-publication.md) — for package maintainers.

## Project status

The protocol has not completed an independent security audit. Package availability
and local test results do not establish readiness for real funds or certify a live
deployment. Protocol changes must preserve signed meanings and existing order and
authorization identities unless an explicit migration is designed.

[MIT license](LICENSE).
