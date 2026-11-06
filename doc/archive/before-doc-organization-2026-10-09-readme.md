> Historical snapshot, captured 2026-10-09 before documentation organization.
> Statements of "current", pending tasks and commands describe earlier checkpoints.
> Use the repository README, progress and TODO for current scope. This is not an execution runbook.

# AgentPay Protocol

[Current timestamp source review](../records/participant-order-time-v2-2026-10-07.md) — verified source scope and
remaining storage/API/deployment gates.


Open contracts, schemas and conformance rules for AgentPay Orders and Safe authorization.

## Installation and first use

[Timestamp boundaries and compatibility](../reference/time-semantics.md)

[Install for local protocol verification](../usage.md) · [Developer guide](../develope.md) · [Protocol design](../design.md)

Current implementation supports a completed private Anvil rehearsal. The
role-specific guide states which steps are runnable today and which require
release work. [Progress](../../progress.md) records the current status.


Open x402 escrow and execution protocol for paid AI Skills on Base.

AgentPay combines bounded Safe authorization with x402 escrow. An open
user-controlled Wallet signs order commitments automatically within an
immutable policy; a Safe Module funds a deterministic per-order Escrow Vault.
Settlement independently verifies on-chain funding before allowing service.
After the provider server runs, the Vault enforces the allowed seller payment,
fee cap, and buyer refund.

```text
one user-confirmed Safe policy
  -> AgentPay Wallet commitment
  -> native AgentPay x402 binding redemption through Safe Module
  -> deterministic OrderEscrowVault
  -> verified USDC funding
  -> Wallet confirms ready_for_service
  -> local Skill forwards to authenticated provider server
  -> provider claims one online authorization
  -> receipt metadata
  -> on-chain release or refund
```

> **Status:** Private rehearsal completed; live Base deployment and independent audit remain release gates. See [this repository's progress](../../progress.md).

The existing Base smoke proves the narrower x402 v2 `exact` EIP-3009 funding
boundary and contract `payTo`. It does not represent the final per-order user
authorization UX. The production-candidate delegated Module, commitment
binding, and independent Registry qualification now pass focused local tests
and a real-Safe Anvil flow. The narrow Settlement Authority Controller now
passes focused tests and an official-Safe Anvil rotation/pause flow. Public
artifacts, deployment evidence, audit, and production integration remain gates.

[Service profile v1](../reference/agentpay-service-profile-v1.md) is the
approved off-chain public identity format for independent Provider admission.
The Protocol source and fixture are ready; runtime consumers and deployment
have not yet migrated.

## Why AgentPay

Paid AI execution needs more than a token transfer:

- the model runtime must not receive unrestricted wallet authority;
- payment must be tied to one immutable order and one expected service;
- a facilitator response must not be trusted without chain evidence;
- execution must start only after funding is verified;
- release and refund destinations must not be mutable off-chain decisions.

AgentPay separates these responsibilities. Wallet protects the user's Session
Key, the Module enforces spending policy, x402 carries the commitment and
settlement result, and a per-order Vault constrains custody and final movement.
Settlement handles commercial policy and online service authorization. User
Runtime sends the private request through the local Skill to the provider server, while
only receipt metadata returns to Settlement.

## Recorded Verification Milestones

Counts below describe historical test runs, not a fresh result for every
current commit. Current scope and limitations are in [progress](../../progress.md).

| Capability | Status |
| --- | --- |
| Deterministic Factory and per-order Vault | Escrow Foundry suite: 14 passed, 0 failed |
| x402 contract `payTo` through CDP Facilitator | Base `/verify`: `isValid=true` |
| Base USDC settlement into a Vault | Base `/settle`: `success=true`; `1000` atomic USDC transferred |
| Provider-neutral verification library | x402 package: 9 tests passed, 0 failed |
| TypeScript types and JSON Schema | Types package: 6 tests passed, 0 failed |
| Local release and refund lifecycle | Anvil result: `releaseState=Released`, `refundState=Refunded` |
| Full Node conformance command | 18 passed, 0 failed |
| Full Foundry contract command | 23 passed, 0 failed, 0 skipped |
| Bounded Safe delegated authorization spike | Foundry 11/11, Node 6/6, official Safe Base fork 2/2 |
| CDP hosted Base batch capability | Authenticated `/supported`: x402 v2 `batch-settlement` advertised |
| CDP custom AgentPay binding | Verify-only draft rejected at HTTP request-schema validation |
| Production-candidate Spending Module, Registry, and native binding | 42 non-fork Solidity tests; 9 shared Schema/ABI/fixture tests; real Safe v1.4.1 Anvil flow passed |
| Stable Settlement Authority Controller | 7 focused Foundry tests and official Safe v1.4.1 Anvil rotation/pause/release/refund passed |
| Native Settlement integration | Formal loopback runtime and protected-MySQL/Anvil recovery flows passed; Base-fork service flow passed |
| Live Base deployment | Not completed |
| Independent security audit | Not audited |

The verified v1 chain profile is x402 v2 `exact` on Base mainnet using the
official Base USDC contract. Other networks and token behaviors are not part of
the v1 support claim. Reproduction details are in the
[Base smoke record](../records/x402-base-mainnet-smoke.md),
[conformance record](../records/x402-escrow-conformance.md), and
[local reference record](../../packages/x402-reference/README.md).

## Quick Start

Prerequisites:

- Node.js 18 or newer;
- pnpm;
- Foundry (`forge` and `anvil`).

Install dependencies and run the complete local reference:

```bash
pnpm install --frozen-lockfile
pnpm x402:reference
```

The runner starts an isolated Anvil chain, compiles and deploys the real
Factory/Vault contracts and six-decimal mock USDC, then completes two orders:

```json
{
  "ok": true,
  "releaseState": "Released",
  "refundState": "Refunded"
}
```

No CDP credentials, public RPC, private production key, or real funds are
required. For Docker-only Foundry environments, see the
[x402 Local Reference](../../packages/x402-reference/README.md).

Run the framework-neutral and contract checks separately with:

```bash
pnpm conformance:test
cd contracts && forge test -vvv
```

## How It Works

### 1. Create an immutable order

Settlement persists canonical order terms, derives `termsHash`, predicts the
Vault address, and creates the Vault through `AgentPayEscrowFactory`.

The Vault fixes the buyer, seller, token, settlement authority, fee recipient,
amount, fee cap, expiry, refund time, `orderId`, and `termsHash`.

### 2. Authorize and request an x402 payment

The buyer-specific native Payment Required response uses:

```text
scheme: agentpay
extra.binding: agentpay.safe-module.v1
network: eip155:8453
asset: official Base USDC
amount: exact atomic amount
payTo: the order-specific Vault
```

The user previously confirms one bounded Safe policy authorizing AgentPay's
dynamically maintained Registry list. For each eligible order, AgentPay Wallet
validates the canonical order and Registry qualification, then signs a
versioned EIP-712 commitment without a routine wallet prompt. The
native AgentPay handler accepts that commitment and a worker redeems it
through the Safe Module into the Vault.

The optional standard compatibility route uses `scheme: exact` and its own
authorization format. CDP `exact` is the verified live interoperability adapter for direct
EOA funding and remains a replaceable compatibility adapter. Hosted CDP is not
assumed to execute AgentPay's custom Safe Module redemption. An authenticated
Phase 0 probe confirmed that CDP advertises its standard Base EVM
`batch-settlement` scheme, while an unsigned AgentPay-shaped draft was rejected
at request-schema validation before signature or chain-state checks. Selecting
the standard payment-channel model instead would be an explicit architecture
decision, not an interchangeable adapter change. AgentPay's payload is not the
currently published EVM payment-channel binding. Its fixed public identity is
x402 v2 scheme `agentpay` with binding `agentpay.safe-module.v1`; registration
under standard EVM `batch-settlement` is outside scope. This repository
specifies the public payload, canonical verification behavior, fixtures, and
conformance rules; it does not own production endpoints, credentials, queues,
workers, or recovery state.

The binding uses `paymentFlow = escrow`: verification is read-only, durable
internal acceptance returns `commitmentId` without claiming payment, and an
external settle succeeds only after transaction-backed Vault funding evidence.
See [AgentPay Safe Module x402 Binding v1](../reference/agentpay-safe-module-binding-v1.md).

Production Settlement also exposes a provider-neutral x402 Gateway. Its first
standard compatibility route passes an unchanged `exact` payload to CDP.
`upto` and standard `batch-settlement` remain unadvertised roadmap routes until
their complete verify/settle behavior is enabled and tested. The Gateway does
not translate an AgentPay commitment into `exact` and does not provide a
liquidity or credit bridge.

ERC-7710 is a future compatibility candidate only. Its delegation-manager
interface appears adaptable to the Safe Module boundary, but current official
x402 SDKs and hosted facilitator evidence do not provide the complete route
needed to reduce v1 implementation work. The Gateway and native `agentpay`
binding therefore remain required.

### 3. Verify funding independently

A facilitator `success` response is not sufficient. Before activation,
Settlement verifies:

1. the Base transaction receipt succeeded;
2. official Base USDC emitted the expected `Transfer`;
3. `from`, `to`, and `value` match buyer, Vault, and order amount;
4. `balanceOf(vault) >= amount` after bounded retry;
5. every immutable Vault field matches the persisted order;
6. the payment identifier and funding transaction are not replayed.

Only then does Settlement call `activate()` and report the order ready for
service.

### 4. Execute without exposing private payloads

Wallet receives a short-lived opaque authorization, then calls the user-side
Skill. The Skill forwards the authorization and private request to the provider
server. That server authenticates to Settlement, claims the authorization
online, executes the request, returns output through the Skill, and submits
only `outputHash` and `usageUnits` as receipt metadata.

### 5. Release or refund on-chain

After delivery, the fixed Settlement Authority may call `release()`.
Production-candidate Vaults bind this role to the stable, narrow Authority
Controller rather than directly to an online EOA. The Authority Administrator
Safe rotates the Authority Executor without changing existing Vault authority
addresses. The Vault
enforces the seller, fee recipient, fee cap, total amount, and buyer remainder.

Settlement may refund a funded order to the immutable buyer. After the fixed
timeout, anyone may submit the permissionless timeout-refund transaction.
Timeout refund is not automatic and still requires an on-chain transaction.

## Protocol Components

- `AgentPayEscrowFactory`: predicts and creates deterministic ERC-1167 Vaults.
- `OrderEscrowVault`: enforces order terms, states, release, and refund.
- [`@agentpay/types`](../../packages/types/README.md): public types, Schema,
  canonical terms hashing, fixtures, and typed ABIs.
- [`@agentpay/x402-escrow`](../../packages/x402-escrow/README.md): Payment Required,
  provider interface, CDP/mock adapters, evidence checks, and idempotency rules.
- [`@agentpay/x402-reference`](../../packages/x402-reference/README.md): executable
  Anvil HTTP reference covering release and refund.

## Trust Boundary

The Vault guarantees custody constraints and allowed fund destinations. It does
not judge AI output quality, pricing policy, fraud, or disputes.

Settlement remains responsible for pricing, provider admission, the hosted
AgentPay binding runtime and optional compatibility-provider calls, evidence
collection, durable idempotency, Service Authorization policy, Receipt Metadata
policy, retries,
accounting, release/refund decisions, and operator recovery.

AgentPay Wallet and the Spending Module are separate trust boundaries. Wallet
holds a per-device/Agent and policy Session Key and exposes no generic signing.
The Module must independently enforce immutable policy identity, Registry qualification,
limits, expiry, revocation, unordered commitment replay protection, and one
funding per order.

For v1, the User authorizes AgentPay's dynamically maintained qualified-Skill
list under published Registry rules. Wallet and Module validate the
same qualification independently; the Module does not trust a
Settlement-appointed verifier. Do not expand this into user-configured
category, trust-tier, price, or deny-rule predicates. Registry qualification
primarily verifies developer identity and endpoint/payout control and must not
be represented as a guarantee of Skill quality.

Settlement never holds the Session Key. Provider-server M2M credentials,
Authority executor, and gas relayer are separate principals. Native AgentPay
stores only hashes of opaque service authorizations. The Authority Controller must expose
only constrained AgentPay Vault operations; it cannot be an arbitrary call
proxy.

The provider server receives the request only after Wallet readiness and online
authorization claim. Business request and output payloads are intentionally
not protocol or Settlement data.

## Supported Profile

The verified live funding baseline currently claims support for:

```text
Protocol: agentpay.x402.escrow.v1
x402: v2 exact
Network: Base mainnet (eip155:8453)
Asset: USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Facilitator adapter: CDP (replaceable)
Solidity: 0.8.24, optimizer 200 runs, via IR
```

Fee-on-transfer, rebasing, callback-based, or otherwise non-standard token
behavior is outside v1. Local Anvil and mock USDC are conformance fixtures, not
additional production profiles.

The target authorization profile is the distinct native x402 v2 AgentPay
scheme backed by AgentPay Wallet, the Safe Spending Module, Registry qualification,
and unordered commitments. It must not be labeled production
supported until its public types, contracts, conformance, Base-fork tests, and
security review are complete.

## Repository Map

- `contracts/`: Solidity contracts and Foundry tests.
- `packages/types/`: public TypeScript types, JSON Schema, fixtures, and ABIs.
- `packages/x402-escrow/`: provider-neutral construction and verification.
- `packages/x402-reference/`: local-chain reference service and runner.
- `scripts/`: local reference, Base smoke, and verification helpers.
- `doc/`: normative protocol, conformance, deployment, and API documents.

## Documentation

- [Progress](../../progress.md)
- [Design](../design.md)
- [Implementation and release TODO](../TODO.md)
- [Usage And Installation](../usage.md)
- [Architecture](../architecture.md)
- [Module Boundaries](../reference/module-boundaries.md)
- [x402 Escrow Protocol v1](../reference/x402-escrow-protocol.md)
- [AgentPay Service Payment Required v1 candidate](../reference/agentpay-service-payment-required-v1.md)
- [x402 Escrow Conformance](../records/x402-escrow-conformance.md)
- [x402 Local Reference](../../packages/x402-reference/README.md)
- [Base Mainnet Funding Smoke](../records/x402-base-mainnet-smoke.md)
- [Deployment Reference](../reference/deployments.md)
- [Protocol Developer Guide](../develope.md)
- [Contributing](../reference/CONTRIBUTING.md)
- [Security Policy](../security/SECURITY.md)

## Security

This repository has extensive automated tests but has not completed an
independent security audit. Do not interpret test coverage, Base smoke results,
or local lifecycle completion as an audit. Report suspected vulnerabilities
privately according to [SECURITY.md](../security/SECURITY.md).

## License

[MIT](../../LICENSE)

- [Finalization timestamp source evidence](../records/finalization-timestamp-v2-2026-10-07.md).

- [Order deadline timestamp source evidence](../records/order-deadline-timestamp-wire-2026-10-07.md).

- [Service Authorization timestamp source evidence](../records/service-authorization-timestamp-wire-2026-10-07.md).

- [Notice and delivery timestamp source evidence](../records/notice-delivery-timestamp-wire-2026-10-07.md).
