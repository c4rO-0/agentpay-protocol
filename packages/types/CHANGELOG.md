# Publication naming

The first npm release is `@c4roa0/agentpay-protocol@0.14.1`.
It replaces the temporary `@agentpay/types` package name without changing public
wire formats, hashes or ABI behavior. Entries below retain their historical names.

## 0.14.2 — Documentation refresh, 2026-11-06

- Rewrite the package README with installation, a runnable example and integration links.
- No runtime code, dependencies, schemas, fixtures or ABI changes from 0.14.1.

## 0.14.1 — Provider transport validation, 2026-11-02

- Accept canonical HTTP and HTTPS public Provider profiles. Preserve all existing
  field/path rules, profile-v1 serialization and hashes of already-valid profiles.
- This does not change platform login/credential transport, loopback admission,
  contract ABIs, signed Order data or authorization. Consumers must update their
  own URL validation as well as the types artifact in a coordinated rollout.

## 0.14.0 — source candidate, 2026-10-24

- Add optional Provider `serviceWindowSeconds` to pre-Order price requirements.
  It is a canonical integer-seconds string, distinct from Quote expiry. Omission
  selects the Settlement default; strict consumers must be deployed together.
- Add bounded participant case projections with nested verdict, evidence and
  review validation; timestamps remain Unix milliseconds. No business-specific
  evidence format or contract timing rule is introduced.
- No contract ABI, canonical Order terms hash or prior-Order reinterpretation.

# 0.13.0 (source candidate)

- Add independent waiting-v1 and closure-v1 types, strict validators and JSON
  schemas with Unix millisecond clocks. Keep frozen participant objects, signed
  Order hashes and application payloads unchanged.
- Closure separates requested/processing state from confirmed cancellation/refund;
  internal transactions, credentials and logs are not part of its public shape.
- Consumers must explicitly pack/update dependencies during coordinated rollout.
  Source verification does not activate waiting deadlines or automatic refunds.

# 0.12.0

- Add registered service references, versioned generic JSON invocation/result
  schemas and strict normalizers. Profile hashes bind controlled endpoint,
  Provider identity, seller, network and asset; no prices enter author references.
- Retain existing JSON delivery SHA-256 serialization without reordering application
  output; add bounded input/output size and
  depth, and input-hash/result-hash checks. Existing profile, request and contract
  hash bytes remain unchanged; business output shape remains application-owned.
- No contract, ABI, on-chain role or generic signing change. Consumers using these
  new helpers must explicitly update their dependency; old schemas are unchanged.

# 0.11.1

- Accept canonical service URL prefixes while preserving the controlled service
  suffix and exact payment endpoint derivation. Root-path profile bytes/hashes
  remain unchanged. Prefixed endpoints have distinct profile identities.
- No contract, schema field, profile version or hash algorithm change.

# 0.11.0

- Add integer Wallet notice and delivery/confirmation result schemas/adapters.
- Preserve reminder actions, billing, idempotency and existing scheduling rules.

# 0.10.0

- Add service-authorization.v2 with explicit millisecond expiry/response times.
- Preserve one-time authorization and claim/receipt identities; no hash or authority changes.

# 0.9.0

- Add versioned integer order-deadline disclosure and strict legacy adapter.
- Preserve persisted policy versions and canonical chain seconds/hash semantics.

# Changelog

## 0.8.0 - 2026-10-07

- Add strict finalization disclosure v2 with integer millisecond instants,
  explicit legacy ingress and media type negotiation. No financial rule,
  on-chain unit, signature or hash change.


## 0.7.0 - 2026-10-07

- Add strict epoch validators and explicit legacy ISO adapters.
- Add participant Order v2 millisecond projections, role-specific schema and
  cross-language fixtures. Preserve chain seconds, signatures and frozen v1.


## 0.6.0 - 2026-09-26

- Add the canonical `agentpay.service-profile.v1` service identity, hash,
  JSON Schema, and language-neutral fixture. Package authors and mutable
  offers remain outside this identity.

## 0.5.0 - 2026-09-17

- Add the strict pre-Order `agentpay.service-payment-required.v1` Provider
  response type, JSON Schema, and language-neutral fixture.
- Keep buyer, Safe policy, Order, Vault, Settlement fee, authorization, and
  private request fields outside the Provider-owned response.

## 0.4.0 - 2026-09-17

- Add `agentpay.private-request.v1` canonical hashing and role-qualified
  `agentpay.participant-order.v1` projections with shared fixtures.

## 0.3.0 - 2026-09-16

- Export the frozen `SettlementAuthorityController` typed ABI.
- Add a language-neutral Controller surface fixture and a deployment-manifest
  Schema that keeps administrator Safe, Factory, executor, bytecode, compiler,
  source, version, and audit status explicit.
- Document that the Controller has no generic call or upgrade surface and does
  not forward permissionless Vault activation.

## 0.2.0 - 2026-09-14

- Add the minimal Registry qualification and bounded Spending Policy types,
  JSON Schema definitions, canonical qualification hash fixture, and typed
  `SkillRegistry`/`AgentPaySpendingModule` ABIs.

This package follows semantic versioning. Changes to public TypeScript types,
JSON Schema, canonical bytes, identifiers, ABI, state values, or validation
requirements are compatibility changes and must be recorded here.

- Add the fixed x402 v2 `agentpay` scheme and
  `agentpay.safe-module.v1` binding types.
- Add the `paymentFlow = escrow` requirements, commitment, verification,
  acceptance, and transaction-backed settlement response Schema.
- Add an unsigned language-neutral commitment/digest fixture.

## 0.1.0 - 2026-08-16

- Add AgentPay x402 escrow v1 types and JSON Schema.
- Define canonical escrow terms bytes and hashing helpers.
- Export typed AgentPayEscrowFactory and OrderEscrowVault ABIs.
- Add language-neutral conformance fixtures.
# 0.4.0

- Add the versioned `agentpay.private-request.v1` canonical JSON and
  Keccak-256 helper with language-neutral fixture.
- Add role-qualified buyer/provider Order projection types and JSON Schema.
- No contract ABI or AgentPay Commitment EIP-712 field changed.
