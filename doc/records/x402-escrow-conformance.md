# x402 Escrow Conformance

Status: required behavior for implementations claiming support for
`agentpay.x402.escrow.v1`.

This suite currently covers the custody/funding-evidence profile proven by the
local reference and x402 `exact` smoke. Full AgentPay production conformance
also requires the P4A delegated-authorization and Authority Controller suite;
passing this file alone must not be presented as autonomous-purchase readiness.

## Authorization Coverage And Remaining Production Categories

The 2026-09-13 local checkpoint proves the first six categories below across
the focused Module, public artifact, Wallet, and real-Safe Anvil tests. The
later Controller suite proves the final local category. They remain mandatory
regression coverage. The frozen Controller surface, deployment record, and
threat assumptions are specified in
[`settlement-authority-controller-v1.md`](../reference/settlement-authority-controller-v1.md);
Base-fork, canonical deployment, and audit remain production gates.

- one owner-confirmed immutable Safe policy and two automatic eligible orders;
- per-device/Agent and policy delegate isolation;
- independent Wallet and Module Registry qualification checks, including
  automatic eligibility for a newly qualified Skill;
- unordered commitment replay and one funding per order;
- strict Module Vault/terms/token/amount/ERC-20 validation;
- Wallet generic-sign rejection and local-lock/on-chain-revocation behavior;
- stable Authority Controller, administrator-Safe pause, executor rotation,
  unapproved-target rejection, and relayer separation.

## Test Categories

| Category | Required assertion |
| --- | --- |
| Address prediction | Factory prediction equals created Vault address for one unique `orderId`. |
| Terms immutability | Buyer, seller, token, amount, caps, authority, and hashes cannot change after initialization. |
| Funding | `activate()` rejects insufficient balance and succeeds only after required token balance exists. |
| x402 requirements | Payment Required uses `exact`, Base network, Base USDC, exact amount, and the recorded Vault as `payTo`. |
| Settle evidence | Successful receipt contains the expected USDC Transfer; an immediate stale balance read is retried. |
| Ticket gate | No execution ticket is issued before Vault reaches `Funded`. |
| Release | Only settlement authority may release; recipient and fee cap cannot be bypassed. |
| Refund | Authority refund and permissionless timeout refund return funds only to buyer. |
| Replay | Terminal states reject repeat finalization; a repeated payment identifier does not create a second logical order. |

## Minimum Fixture

Conformance must run without a real facilitator or private keys. It uses:

- a local EVM chain;
- a standard six-decimal mock USDC;
- a mock facilitator response and transaction evidence fixture;
- independent buyer, seller, settlement authority, and fee recipient addresses.

Live CDP/Base smoke is additional interoperability evidence, not the only test
or a requirement for contributors.

## Required Negative Cases

At minimum, include tests for wrong network, token, amount, payer, recipient,
failed receipt, missing Transfer event, duplicate order ID, expired terms,
unauthorized release, fee above cap, release above amount, early timeout
refund, and every final-state replay.

## Evidence Fixture Format

An implementation may use any test framework, but its funding verifier must
accept an equivalent normalized fixture:

```json
{
  "network": "eip155:8453",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "transactionHash": "0x...",
  "receiptStatus": "success",
  "transfer": {
    "from": "0x...",
    "to": "0x...",
    "value": "1000"
  },
  "observedVaultBalance": "1000"
}
```

## Current Repository Coverage

`contracts/test/AgentPayEscrowFactory.t.sol` covers Factory prediction,
activation, complete release/refund behavior, authorization and amount caps,
expired terms, cancellation, early timeout, and terminal-state replay.

`packages/x402-escrow/test` covers Payment Required, normalized settlement
evidence, CDP/mock adapter behavior, stale balance retry, funding idempotency,
ticket gating, and complete release/refund lifecycle harnesses. Run all local
Node conformance checks with:

```bash
pnpm conformance:test
```

GitHub Actions publishes `x402-conformance (required)` and
`foundry-contracts (required)`. Repository branch protection must require both
jobs. Live Base/CDP smoke remains optional interoperability evidence.

Latest local verification on 2026-08-16:

- `AgentPayEscrowFactoryTest`: 14 passed, 0 failed;
- `DealManagerTest`: 9 passed, 0 failed;
- total Foundry result: 23 passed, 0 failed, 0 skipped;
- Node `pnpm conformance:test`: 18 passed, 0 failed.
