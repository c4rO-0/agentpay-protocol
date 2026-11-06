# Public package API notes

Public, facilitator-neutral types for AgentPay protocol integrations.

Current exports cover escrow custody v1, the fixed
`agentpay.safe-module.v1` x402 wire binding, bounded immutable-policy and
Registry qualification types, their shared hash helper, typed
SkillRegistry/SpendingModule ABIs, and the reviewed narrow Authority Controller
ABI and deployment-manifest Schema.

## Generic JSON services (0.12.0)

`normalizeServiceReference` verifies a public service profile against profileHash.
`normalizeServiceInvocation` binds JSON input to the existing requestHash.
`normalizeServiceResult` checks bounded JSON output, usage and the agreed outputHash.
`hashServiceOutput` retains SHA-256 of UTF-8 JSON.stringify(output), preserving
application property order, with at most 32 levels. Business result shape is free. Input is limited to 256 KiB and output to 1 MiB. This supports provider-neutral
JSON transport; it does not authorize an Order or prove service quality. Registry,
Wallet and Settlement checks remain independent.

## Finalization timestamp v2

`normalizeFinalizationDisclosure()` preserves Settlement's persisted delivery,
confirmation and planned-release instants as explicit millisecond fields. A
blocked, refunded or finalized schedule has no upcoming release. Legacy ISO
requires a known timezone; missing or invalid dates fail closed. Readiness for
release is not guaranteed payment arrival. Use `./finalization-disclosure-v2-schema`
and its fixtures. This does not recompute timing or change dispute/refund rules.

## Participant Order timestamp v2

`normalizeParticipantOrder()` validates v2 and explicitly adapts legacy v1 ISO
with a known timezone. V2 has `createdAtMs`, `updatedAtMs` and
`providerResponseDueAtMs` as epoch milliseconds. Existing `expiresAt` and
`refundAvailableAt` remain canonical Unix-seconds strings. Unknown fields,
versions, invalid/ambiguous time, and unexpected participant fields are rejected.
Use `./participant-order-v2-schema` and the v2 fixtures for conformance.
`participantOrderToLegacy()` is an explicit compatibility egress, not internal
storage. These projections do not change signatures, terms hashes or payment
requirements. Durable storage and deployment must be migrated separately.

## Native private request and participant Order v1

`canonicalizePrivateRequest()` and `hashPrivateRequest()` define the one
`agentpay.private-request.v1` binding used by Wallet, a local Skill, and the
Provider server. The canonical document is UTF-8 JSON containing `request` and
`version`; every object key is sorted lexicographically and the hash is
Keccak-256. Values must be plain JSON. Settlement receives only the resulting
`requestHash`, never the private request.

`BuyerOrderProjection` and `ProviderOrderProjection` are explicit participant
views. They contain commercial terms, lifecycle state, public identifiers, and
the request binding, but exclude private request/output bodies, authorization
tokens, credentials, encrypted transactions, leases, and worker internals.
Non-TypeScript consumers use `./native-service-schema`; shared conformance
records are under `fixtures/agentpay-native-service-v1/`.

`AgentPayServicePaymentRequired` is the strict Provider-owned HTTP `402`
response observed before Settlement creates a Quote or Order. The matching
`./service-payment-required-schema` and fixture contain service identity and
price terms, but no buyer, Safe policy, Vault, Settlement fee, or private
request fields.

## x402 Escrow v1

The package exports:

- `PaymentRail`, escrow terms, state, payment, evidence, and lifecycle records;
- `canonicalizeEscrowOrderTerms()` and `hashEscrowOrderTerms()`;
- typed `agentPayEscrowFactoryAbi` and `orderEscrowVaultAbi` constants;
- `./schema`, the bundled JSON Schema for non-TypeScript consumers;
- language-neutral fixtures under `fixtures/x402-escrow-v1/`.

All chain integers use decimal strings. Addresses used in canonical terms must
be EIP-55 checksummed. The canonical JSON field order is normative; callers
must use the exported helper or reproduce the exact algorithm documented in
[Protocol reference](https://github.com/c4rO-0/agentpay-protocol/blob/main/doc/reference/x402-escrow-protocol.md).

```ts
import {
  canonicalizeEscrowOrderTerms,
  hashEscrowOrderTerms,
  type EscrowOrderTerms,
} from "@c4roa0/agentpay-protocol";

const canonicalBytes = canonicalizeEscrowOrderTerms(terms);
const termsHash = hashEscrowOrderTerms(terms);
```

The package version follows semantic versioning. See [the changelog](../../packages/types/CHANGELOG.md) for the
compatibility policy and release history.

## AgentPay Safe Module binding v1

The package exports the fixed x402 v2 `agentpay` requirements, commitment,
verification, internal acceptance, and transaction-backed settlement response
types. Non-TypeScript consumers use `./agentpay-safe-module-schema`; the
language-neutral unsigned fixture is under `fixtures/agentpay-safe-module-v1/`.
It also fixes the minimal Registry qualification, bounded spending-policy
shape, and `keccak256(abi.encode(registry, skillId, profileHash, seller))`
qualification hash consumed independently by Wallet and Module.
Its all-zero signature is a non-paying placeholder; conformance tests create a
known disposable test signature only in process memory.

The binding fixes `paymentFlow = escrow`. An acceptance record containing a
`commitmentId` is deliberately distinct from an x402 settle success.

## Settlement Authority Controller v1

The package exports `settlementAuthorityControllerAbi`. Its only operational
Vault actions are delivery, release, Authority refund, and unfunded
cancellation. The administrator Safe may rotate the one executor and
pause/unpause, but cannot perform order actions through the Controller.
Permissionless Vault activation remains outside this contract, and there is no
generic call, delegatecall, batch, or upgrade surface.

Non-TypeScript release tooling can consume
`./authority-controller-deployment-schema`; the corresponding
`fixtures/settlement-authority-controller-v1/records.json` file freezes the
expected public function/event names and example role/provenance bindings. The
fixture addresses and transaction hashes are non-deployment test values.

## Order deadline disclosure v2

`normalizeOrderDeadlines` returns explicit Unix millisecond fields and adapts
legacy ISO only with a timezone. Disclosure version and persisted
`deadlinePolicyVersion` are independent: old Orders retain null policy/cutoff
fields. Unit/range/margin checks never extend deadlines or modify canonical
chain seconds or signed terms. `AGENTPAY_DEADLINES_V2_MEDIA_TYPE` negotiates this
metadata independently of participant Order and finalization projection versions.

## Service Authorization v2

`normalizeServiceAuthorization` preserves identity, one-time token and optional
claim/decision metadata, with expiresAtMs/responseDueAtMs/respondedAtMs in Unix
milliseconds. Legacy ISO requires a timezone. These fields are independent of
Order chain expiry (seconds); response deadlines may exceed the short token
claim expiry after a valid claim. Nested deadline/finalization metadata is
validated independently by the consumer. This helper does not authorize execution.

## Wallet notices and delivery results v2

`normalizeWalletNotice` converts the persisted reminder deadline to
releaseScheduledAtMs and checks order binding. `normalizeDeliveryResult` versions
receipt/confirmation returned times; duplicate receipts without schedule fields
retain their absence. Nested disclosures are independently negotiated. Neither
helper recalculates time or changes whether confirmation is required for release.

### Canonical Provider path prefixes (0.11.1)

Service endpoints can use a safe path prefix before `/services/<serviceId>`.
For example `/provider/services/random/mcp/invoke` determines exactly
`/provider/services/random/agentpay/invoke`. Third-party services may choose
their own HTTP or HTTPS origin and safe prefix. URL credentials, query/fragment, encoded
segments, repeated separators and traversal are not canonical endpoints.
Root-path canonical bytes and hashes remain unchanged. A new endpoint prefix
changes the profile identity and requires its own endpoint verification and
service registration; do not rewrite existing profiles, Orders or published Skills.
No contract or schema field changes are part of this library patch.
