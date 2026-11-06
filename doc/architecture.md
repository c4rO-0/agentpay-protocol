# Architecture

This document describes the executable structure of AgentPay Protocol and the
runtime sequence an integrating Settlement must preserve.

## System Flow

```text
User confirms bounded Safe policy once
  -> AgentPay Wallet validates Registry qualification and signs commitment
  -> Settlement's native AgentPay handler verifies and accepts commitment
  -> durable commitmentId
  -> Relayer redeems through AgentPaySpendingModule
  -> Configured ERC-20 Transfer to deterministic OrderEscrowVault
  -> Settlement verifier checks transaction receipt, Transfer, balance, and terms
  | transaction receipt + Transfer + balance + immutable terms
  | activate()
  v
Caller receives Service Authorization
  -> Skill/Runtime -> Provider server online claim
  -> private output through Skill + Receipt Metadata to Settlement
                               |
                               v
Authority Controller -> Vault release() or refund()
```

Binding acceptance transports authorization but does not establish funding
truth. Settlement independently derives truth from the redemption transaction
receipt, token Transfer event, Vault balance, and immutable Vault terms.

## Runtime Sequence

1. The Provider's real service interface returns the provider-side AgentPay
   class-x402 payment requirement. Settlement authenticates it, applies
   deterministic change controls, and snapshots the accepted response as a
   Quote. This pre-Order object is not a Provider Profile price and is
   not the final buyer-specific `AgentPayPaymentRequirements`.
2. Settlement creates and persists canonical `EscrowOrderTerms` from the Quote
   plus buyer policy and Settlement fee/timing configuration.
3. Settlement derives `termsHash` and predicts the order Vault address.
4. The Factory creates a Vault whose immutable fields match the persisted order.
5. Settlement returns final AgentPay Payment Required with `payTo = vaultAddress`.
6. Wallet validates canonical order and public Registry qualification under an existing policy,
   then signs the versioned commitment without owner interaction.
7. Settlement's native AgentPay handler verifies and durably accepts the
   Commitment, returns `commitmentId`, and the Relayer redeems it through the
   Safe Module.
8. Settlement verifies chain evidence and replay constraints.
9. Settlement calls `activate()` only while the Vault is `Created` and funded.
10. Settlement returns a one-time Service Authorization to the caller only after
   state is `Funded`.
11. The caller (for example a Skill using User Runtime) forwards the authorization
    and private request to the Provider server. Wallet owns bounded payment signing,
    not execution of arbitrary Skill code.
12. The Provider server claims the authorization online, returns private output
    through the Skill, and submits Receipt Metadata to Settlement.
13. Delivery is recorded, then the Authority Controller releases or refunds
    through the Vault.

Skipping the redemption/evidence/activation gates breaks the security
boundary. Binding acceptance or a compatibility-provider response alone must
never authorize execution.

The older x402 reference uses mock direct funding. The current native lifecycle
runner instead signs and redeems through Module with a Safe-interface fixture.
Neither substitutes for full production Safe and application acceptance.

## Program Structure

```text
protocol/
├── contracts/
│   ├── src/AgentPaySpendingModule.sol
│   ├── src/SkillRegistry.sol
│   ├── src/SettlementAuthorityController.sol
│   ├── src/AgentPayEscrowFactory.sol
│   ├── src/OrderEscrowVault.sol
│   ├── src/MockERC20.sol
│   └── test/AgentPayEscrowFactory.t.sol
├── packages/
│   ├── types/
│   │   ├── src/x402-escrow.ts
│   │   ├── src/canonical-terms.ts
│   │   ├── src/abis.ts
│   │   ├── schemas/
│   │   └── fixtures/
│   ├── x402-escrow/
│   │   ├── src/index.ts
│   │   ├── src/cdp.ts
│   │   └── src/mock.ts
│   └── x402-reference/
│       ├── src/service.mjs
│       └── src/runner.mjs
├── scripts/
├── doc/
└── .github/workflows/ci.yml
```

## Module Responsibilities

`SkillRegistry` remains owner-only. Its owner can set or replace an entry and
change its active state. Settlement's automatic writer uses the
existing `setSkill` after off-chain checks; those checks do not restrict the
owner key's on-chain power. An ownership transfer changes no Registry address
or User Policy.

| Module | Owns | Does not own |
| --- | --- | --- |
| Spending Module | bounded Policy and commitment enforcement | generic signing or service quality |
| Registry | public service qualification entries | pricing or service execution |
| Authority Controller | constrained operator actions on its Factory Vaults | arbitrary calls or application dispute adjudication |
| Factory contract | deterministic Vault prediction and creation | pricing, payment verification, upgrades |
| Vault contract | custody, immutable terms, state, release/refund constraints | output quality, disputes, facilitator calls |
| `@c4roa0/agentpay-protocol` | public fields, Schema, canonical terms, private-request hash, participant projections, ABIs, fixtures | RPC calls, credentials, policy |
| `@agentpay/x402-escrow` core | Payment Required, normalized evidence checks, Vault checks, replay semantics | databases, HTTP routes, private keys |
| AgentPay binding reference | canonical verify/accept rules and conformance fixtures | production endpoints, persistence, queues, relayer credentials |
| Settlement x402 Gateway | standard facilitator routing and native AgentPay order orchestration | public Protocol rules or user key custody |
| CDP adapter | CDP SDK calls and response normalization | protocol truth or chain verification |
| Mock adapter | deterministic local facilitator behavior | production behavior claims |
| Local reference | executable composition and HTTP examples | durable storage, production security controls |
| Scripts | smoke and development orchestration | reusable protocol semantics |

## Dependency Direction

Dependencies point inward toward stable public contracts:

```text
@agentpay/x402-escrow -> @c4roa0/agentpay-protocol
local references    -> public libraries + contract artifacts
external consumers  -> public libraries + contract artifacts
```

Arrows mean “depends on”; external consumers do not depend on the executable
reference application. Solidity contracts have no dependency on TypeScript.

Rules:

- contracts do not depend on off-chain packages;
- public types do not import Settlement or provider business logic;
- core verification does not import CDP credentials or production storage;
- provider-specific SDKs stay behind adapters;
- the reference may compose lower modules but must not become a production app;
- production services consume protocol packages, never the reverse.

The production Gateway dispatches by the frozen x402 mechanism identity. The
native AgentPay handler continues through funding, activation, Service
Authorization, delivery, release/refund, reconciliation, and recovery. Its public identity is x402 v2
scheme `agentpay` with binding `agentpay.safe-module.v1`. The first standard
route forwards an unchanged `exact` payload to CDP. It must not
translate AgentPay commitments, advertise inactive `upto` or standard
`batch-settlement` routes, or let an upstream outage disable native handling.

## Sources Of Truth

| Fact | Source of truth |
| --- | --- |
| Order participants, amount, caps, times | persisted canonical terms plus Vault fields |
| Canonical terms bytes | `canonicalizeEscrowOrderTerms()` and published fixture |
| Funding | successful receipt, expected token Transfer, balance, matching Vault |
| Private request identity | `agentpay.private-request.v1` canonical JSON + Keccak-256 fixture |
| Participant Order view | role-qualified participant Order Schema (current timestamp projection v2) |
| Executable state | Vault `state() == Funded` plus valid Service Authorization |
| Delivery metadata | `outputHash`, `usageUnits`, and delivery transaction |
| Final money state | Vault terminal state and token Transfer events |
| Pricing, admission, accounting | production Settlement, outside protocol |
| Skill qualification | independent public Registry; checked separately by Wallet and Module |

## State Machine

```text
Uninitialized
  -> Created
      -> Cancelled
      -> Funded
          -> Refunded
          -> Delivered
              -> Released
              -> Refunded
```

`Released`, `Refunded`, and `Cancelled` are terminal. Repeated finalization must
fail. Timeout refund is permissionless after `refundAvailableAt`, but it still
requires a transaction.

## Production Substitution

The local reference deliberately uses Anvil, mock USDC, a mock facilitator,
in-process records, and public development keys. Production Settlement replaces
those with a supported configured network/token, an adapter where needed, durable
transactional storage, protected signers, and recovery workers. The public
types, canonical hash, verification rules, and contract state machine stay the
same.
