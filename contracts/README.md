# Contracts

## Repeatable deployment artifact build

From the `protocol` repository root, with a compatible Node.js and the
compiler version declared in `contracts/foundry.toml`, Docker access and the
existing offline `ghcr.io/foundry-rs/foundry:latest` image, run:

```bash
node contracts/scripts/build-deployment-artifacts.mjs build
node contracts/scripts/build-deployment-artifacts.mjs check
```
The script reads the current `foundry.toml`, all `contracts/src/*.sol` sources
and the matching local solc version from the user's SVM directory (or
`AGENTPAY_SOLC_BIN`). Compilation uses the pinned local compiler inside the existing Docker image with
no network, no image pull and a 1 GiB memory limit. Build the small public types
package before this command so ABI conformance can be checked.
It writes a content-addressed bundle under the ignored
`contracts/artifacts/deployments/` directory by default; set
`AGENTPAY_CONTRACT_ARTIFACT_DIR` to choose an operator output directory. The bundle contains fresh
Vault, Factory and Controller ABI/bytecode, source hashes, compiler hash and
artifact hashes and creation/runtime-template Keccak hashes. Runtime templates
with immutable references are explicitly labeled; their final deployed code hash
requires the deployment addresses. The eventual Vault clone code hash also
depends on its implementation address. Repeating the command verifies and reuses the same bundle;
changing sources or compiler creates a new bundle. `check` verifies that
`latest.json` and all artifacts still match the current source. Deployment
must use this bundle, not the older `contracts/out/` tree. This build is local
and does not connect to Anvil. Contract deployment and Settlement switching
require a separate reviewed operator procedure.

Solidity contracts for AgentPay protocol.

Current authorization and escrow contracts:

- `AgentPayEscrowFactory.sol`
- `OrderEscrowVault.sol`
- `SkillRegistry.sol`
- `AgentPaySpendingModule.sol`
- `SettlementAuthorityController.sol`

These contracts provide deterministic per-order custody, activation, delivery,
release, authority refund, and permissionless timeout refund. The Base smoke
used x402 `exact` only to prove a contract Vault can receive USDC; it is not the
target user authorization flow.

The Registry deliberately stores only Skill ID, profile hash, seller payment
address, and active status. Qualification proves developer identity/control;
it is not a Skill-quality endorsement. The narrow
`SettlementAuthorityController` pins an administrator Safe and Factory,
supports executor rotation and pause, validates Vault provenance, and exposes
only delivery/release/refund/cancel forwarding. Activation and timeout refund
remain permissionless on the Vault; there is no generic Controller call.

## Local verification

From the repository root, after `pnpm test:packages`, run `pnpm test:chain`
with compatible Foundry. The current native lifecycle runner uses a maintained
Safe-interface fixture and verifies bounded payment, replay, release and refund.
See [testing](../doc/reference/testing.md) for precise scope.

## Separate Safe integration evidence

`AgentPayAuthorizationFlow.t.sol` covers the production-candidate Module and
Registry rules in a focused local EVM suite. The Wallet repository additionally
contains `scripts/anvil-authorization-flow.mjs`, which deploys official Safe
v1.4.1 contracts and these AgentPay contracts to Anvil. It proves one atomic
Safe creation/setup followed by two Wallet-signed payments with no owner
transaction per order, two Vault activations, one release, and one refund.

This is technical-validation evidence, not a deployment or audit claim. The
original script uses mock USDC and a separate local authority EOA. The Wallet
repository's `scripts/anvil-settlement-authority-controller.mjs` separately
uses official Safe v1.4.1 to prove rotation and pause across two existing
Controller-bound Vaults with zero per-order Safe transactions. Production
packaging, capacity, signer provisioning, audit, and Base deployment remain
open.

The public consumer surface is exported from `packages/types`: typed Registry
and Module ABIs, minimal spending-policy and Registry-qualification types,
JSON Schema definitions, and a cross-language qualification-hash fixture. The
Solidity and Wallet suites both assert the same fixture value.

`DealManager.sol` remains legacy Safe-allowance regression code retained for historical regression. Do not add features, integrations, or new deployment guidance for it.

The historical Base smoke tested direct `exact` funding through CDP. It does
not establish the current native Module payment path or its release readiness.
See the [Base mainnet smoke record](../doc/records/x402-base-mainnet-smoke.md)
for the exact historical scope and remaining boundaries.

This folder uses standard Foundry layout:

- `src/`
- `test/`
- `script/`
