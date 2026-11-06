# Install and verify Protocol

Protocol supplies contracts and libraries for integrators. It does not install a
Wallet, start a production Settlement, or authorize spending. Run the following
commands from the Protocol repository root; no parent checkout is required.

## Prerequisites

Use Node.js 22.22.3 and pnpm 10, the versions used by CI. Chain checks additionally
need Foundry (`forge` and `anvil`) and the compiler pinned in
`contracts/foundry.toml`. Package checks do not need a chain or private credentials.
The package engine ranges are compatibility declarations, not evidence that every
older Node release has passed this verification.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm test:packages
```

This builds the workspace, checks public boundaries, and installs packed public
packages in a separate temporary consumer. It exercises two business payloads
through the same library interfaces. Dependency downloads may require network
access. `pnpm test` and `pnpm conformance:test` are aliases for this suite.

## Verify contract behavior locally

After package builds, on a host with compatible Foundry:

```bash
pnpm test:chain
```

This runs non-fork contract tests, compares the public Controller ABI with the
compiled contract, and starts its own Anvil on an ephemeral loopback port. The
native lifecycle runner deploys Module, Registry, Factory, test token and a
maintained Safe-interface fixture. It grants a Policy, signs two bounded payments,
rejects replay, and verifies release/refund with exact balances and empty Vaults.
It does not accept an external RPC or operate existing deployments.

This is Protocol integration evidence. The Safe-interface fixture does not prove
production Safe compatibility, Wallet/Settlement process recovery, or live-network
readiness. See [testing](reference/testing.md) for coverage and CI scope.

On hosts where native Foundry cannot run, use a compatible container toolchain.
The deployment artifact builder has an offline Docker path described in the
[contract guide](../contracts/README.md); it builds artifacts, not the lifecycle
suite. Hosted CI supplies a separate supported Foundry environment. Do not replace
local verification with transactions on a live network.

## Optional checks and historical examples

Base fork checks are an explicit `protocol-ci` manual dispatch with `base_fork=true`
and a configured `BASE_RPC_URL` repository secret. Default pull requests need no
RPC credentials. Fork evidence is distinct from a live deployment.

The older `pnpm x402:reference` exercise uses direct test funding and a mock
facilitator. Its [reference guide](../packages/x402-reference/README.md) documents
that narrower scope. It is not the bounded Module payment acceptance test above.
Other [scripts](../scripts/README.md) include retained historical experiments;
read their scope before running them, especially scripts that can move real funds.

## Build deployment artifacts

Follow the [contract guide](../contracts/README.md) to build and verify immutable
artifact bundles. Compilation is separate from deployment. Network, addresses,
finality settings and signer selection must be explicit; changing them must not
rewrite existing Orders or Policies.

Never commit private keys, runtime configuration or signed payment payloads. Use
only disposable test accounts in local verification. Independent security review,
consumer compatibility and network acceptance remain separate release gates.

## Next reading

- [Architecture](architecture.md): module ownership and transaction flow.
- [Development](develope.md): where to change code and how to verify it.
- [Protocol reference](reference/x402-escrow-protocol.md): canonical fields and hashes.
- [Progress](../progress.md) and [TODO](TODO.md): current evidence and remaining work.
