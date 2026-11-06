# Deployment Records And Verification

This document defines the non-secret records required to identify and verify an
AgentPay x402 deployment. The existing versioned manifest under
`deployments/base-mainnet/` is the canonical Base v1 **escrow** deployment
record. It does not yet certify the target authorization or authority-control
contracts.

## Source history reset

The 2026-11-06 public source preparation replaces Git history with one reviewed
snapshot. Older source commit identifiers in deployment/evidence records are kept
unchanged for provenance, but are not promised to resolve in the public history.
Do not replace them with the new initial commit: that would falsely claim the new
source produced an older deployment. A future supported deployment needs its own
reviewed source revision, build artifacts and chain verification.

## Deployment Model

One `AgentPayEscrowFactory` deployment creates one immutable
`OrderEscrowVault` implementation in its constructor. The Factory creates an
ERC-1167 clone for each unique `orderId`.

A trusted escrow deployment record therefore identifies:

- network and settlement asset;
- Factory and implementation addresses;
- deployment transaction;
- exact source commit and compiler profile;
- protocol, ABI, and manifest versions.

Private keys, facilitator credentials, private RPC URLs, local HTML, and wallet
metadata never belong in a deployment record.

The target production profile additionally requires separately versioned and
verified records for:

- the non-upgradeable `AgentPaySpendingModule` enabled by buyer Safes;
- the independent public Registry used by policy qualification;
- the stable `SettlementAuthorityController` assigned to new Vaults;
- the admin Safe that may pause or rotate narrow Controller executors.

These contracts must not be implied by the escrow v1 manifest. Each needs its
own address, deployment transaction, source commit, compiler settings,
bytecode hashes, ABI version, and audit status before production use.

## Factory Manifest

```json
{
  "schema": "agentpay.x402-escrow-deployment.v1",
  "protocol": "agentpay.x402.escrow.v1",
  "status": "canonical",
  "chainId": "8453",
  "network": "eip155:8453",
  "factoryAddress": "0x...",
  "implementationAddress": "0x...",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "factorySourceCommit": "<40-hex-git-commit>",
  "deploymentTxHash": "0x...",
  "compiler": {
    "solc": "0.8.24",
    "optimizer": true,
    "optimizerRuns": 200,
    "viaIR": true,
    "evmVersion": "cancun"
  },
  "bytecode": {
    "factoryCreationKeccak256": "0x...",
    "factoryRuntimeKeccak256": "0x...",
    "implementationRuntimeKeccak256": "0x..."
  },
  "abiVersion": "1.0.0",
  "deployedAt": "<ISO-8601>",
  "auditStatus": "not-audited"
}
```

The machine-readable schema is
`deployments/schema/x402-escrow-deployment-v1.schema.json`. The canonical Base
manifest is `deployments/base-mainnet/x402-escrow-v1.json`.

## Canonical Base v1 Deployment

The approved v1 Factory is `0x0060FC1912872f4f65D33eE952FD88eB1C10F794`.
It creates clones of the immutable implementation at
`0x3E7532127da773D358e431eFE57aF56E35888A08` and is restricted by the v1
Settlement profile to official Base USDC. The contracts have not been audited;
the manifest records `auditStatus: not-audited` explicitly.

Verify the manifest against Base without spending funds:

```bash
pnpm x402:deployment:verify
```

For independent source verification, generate exact Solidity standard JSON,
compile with official `solc 0.8.24`, and pass the output to the verifier:

```bash
pnpm x402:deployment:solc-input > /tmp/agentpay-solc-input.json
solc-0.8.24 --standard-json \
  < /tmp/agentpay-solc-input.json \
  > /tmp/agentpay-solc-output.json
pnpm x402:deployment:verify -- \
  deployments/base-mainnet/x402-escrow-v1.json \
  /tmp/agentpay-solc-output.json
```

The verifier checks chain ID, implementation binding, creation transaction,
deployment block and timestamp, Factory runtime, implementation runtime, and,
when supplied, independently compiled creation/runtime bytecode.

## Order Record

An integrating Settlement persists a separate record for every order. At
minimum it contains:

```text
orderId
termsHash
canonical terms bytes or durable reference
vaultAddress
buyer
seller
settlementAuthority
feeRecipient
asset
amount
maxFeeAmount
expiresAt
refundAvailableAt
legacyX402PaymentIdentifier (exact compatibility only)
policyId
commitmentId
paymentAttemptId
fundingTxHash
activationTxHash
deliveryTxHash (when delivered)
releaseTxHash or refundTxHash (when terminal)
```

This is operational Settlement data. Do not commit live order records to the
protocol repository.

## Verification Procedure

Before treating a Factory as trusted:

1. verify RPC chain ID and manifest network;
2. verify `factoryAddress` contains bytecode;
3. read `implementation()` and compare it with the manifest;
4. verify the implementation contains bytecode;
5. compile the recorded source commit with the exact compiler profile;
6. compare runtime bytecode, accounting for immutable values where required;
7. compare published ABI artifacts with the source release;
8. verify the asset is official Base USDC for the v1 profile;
9. verify the deployment transaction and block timestamp;
10. record the verification result without credentials or private RPC data.

Do not accept deployment addresses supplied by an end-user purchase request. A
production Settlement pins the approved Factory, Spending Module, Registry
verifier, and Authority Controller through protected runtime configuration and
verifies all of them at startup. During migration, a Settlement that only pins
the escrow v1 Factory must advertise that it does not yet support the target
bounded-authorization profile.

## Local Deployments

The local reference deploys a new Factory, implementation, and mock token for
each isolated Anvil run:

```bash
pnpm x402:reference
```

Those addresses and order IDs are ephemeral. The verification evidence is the
observed state sequence and assertions recorded in the
[x402 Local Reference](../../packages/x402-reference/README.md), not a reusable
local address.

## Base Smoke Versus Canonical Deployment

The completed Base smoke proves that CDP accepts a contract Vault as `payTo`
and can transfer official Base USDC into it. That Factory was promoted only
after the source/compiler/creation/runtime verification recorded above passed;
other smoke addresses are not automatically canonical deployments.

See [Base Mainnet Funding Record](../records/x402-base-mainnet-smoke.md) for the exact
inputs and observed response fields retained in the public record.

## Release Gate

A deployment is suitable for the current escrow protocol release only when P5
provides:

- published Factory and Vault ABI artifacts;
- a machine-validated manifest;
- source/compiler/runtime-bytecode verification commands;
- explicit protocol, Schema, ABI, and package versions;
- Base official USDC support restrictions;
- an explicit audit status.

The canonical manifest closes the deployment-identity requirement for
Settlement development. The explicit `not-audited` status remains a production
risk gate and must not be described as an audit or security certification.

The complete AgentPay production profile remains gated on equivalent release
records and security review for the Spending Module, Registry integration, and
Authority Controller.
