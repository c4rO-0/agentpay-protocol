# AgentPay Service Payment Required v1

Status: implemented and locally conformant in `@agentpay/types 0.5.0`; not yet
exposed through participant-facing Order routes or audited for production.
This document does not change the frozen Safe Module Commitment or any contract
ABI.

## Purpose

`agentpay.service-payment-required.v1` is the Provider-owned, pre-Order half of
AgentPay's class-x402 flow. A client calls the Provider's real Skill service
without a valid Service Authorization; that same service endpoint responds
with the current service price requirement. Settlement observes the same
endpoint, authenticates its Skill/Registry binding, applies deterministic price
risk controls, and snapshots an accepted response as an immutable Quote.

This object is not:

- the legacy Provider Profile or Price Profile;
- an Order, Vault, or payment authorization;
- the final buyer-specific `AgentPayPaymentRequirements`;
- a separate Provider pricing route; or
- a place for Settlement fees or private request content.

## HTTP Exchange

The Provider uses its real service route. When the request has no valid
AgentPay Service Authorization, it returns HTTP `402` with JSON:

```json
{
  "version": "agentpay.service-payment-required.v1",
  "resource": {
    "url": "https://provider.example/skills/random/invoke",
    "method": "POST"
  },
  "requirement": {
    "scheme": "agentpay",
    "network": "eip155:8453",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "skillId": "0x1111111111111111111111111111111111111111111111111111111111111111",
    "profileHash": "0x2222222222222222222222222222222222222222222222222222222222222222",
    "seller": "0x3333333333333333333333333333333333333333",
    "baseAmount": "100000",
    "unitPrice": "1000",
    "maxUsageUnits": "100",
    "offerId": "0x4444444444444444444444444444444444444444444444444444444444444444",
    "validUntil": "1800000000"
  }
}
```

The client later retries the same route with the one-time Service
Authorization after Settlement reports the Order ready. Private request data
travels only between the local Skill and this Provider route.

## Normative Fields

The top-level object has exactly `version`, `resource`, and `requirement`.

`resource`:

| Field | Rule |
| --- | --- |
| `url` | Absolute HTTPS URL in production; must equal the endpoint selected from the versioned Skill Profile after normalization |
| `method` | Uppercase HTTP method used for the paid service request |

`requirement`:

| Field | Rule |
| --- | --- |
| `scheme` | Exactly `agentpay` |
| `network` | CAIP-2 EVM network; V1 production profile is `eip155:8453` |
| `asset` | Token address; V1 production profile is official Base USDC |
| `skillId` | Registry Skill identity, lowercase bytes32 |
| `profileHash` | Exact versioned Skill Profile hash, lowercase bytes32 |
| `seller` | Registry-qualified payout address |
| `baseAmount` | Non-negative atomic-token integer |
| `unitPrice` | Non-negative atomic-token amount per usage unit |
| `maxUsageUnits` | Positive integer; requests above it are rejected, not truncated |
| `offerId` | Provider-generated lowercase bytes32 identity for this exact requirement version |
| `validUntil` | Unix seconds after which no new Quote or Order may use it |
| `serviceWindowSeconds` | Optional canonical positive integer-seconds string: maximum delivery duration from Order creation, including payment/acceptance waits. Omission selects Settlement default; invalid values reject. |

At least one of `baseAmount` and `unitPrice` must be positive. Fixed price is
represented by `unitPrice = 0`. The maximum Provider service charge is:

```text
baseAmount + unitPrice * maxUsageUnits
```

## Deliberately Excluded Fields

The Provider cannot know or control these pre-Order facts, so the object must
not contain them:

- buyer or Safe;
- `policyId` or Session Key;
- `orderId`, Factory, Vault, or `termsHash`;
- `scopeProofHash`;
- Settlement fee rate, minimum fee, fee recipient, or `maxFeeAmount`;
- Service Authorization;
- private request or output content.

Settlement supplies those facts only after it admits a Quote and creates the
buyer-specific Order. The existing `AgentPayPaymentRequirements` remains the
final payment object accepted by Wallet and Gateway.

## Authenticity And Identity

V1 does not add a Provider Profile and does not require a separate signed-price
key. Settlement obtains the response by directly calling the real endpoint
published in the exact versioned Skill Profile. It then requires:

1. normalized response `resource.url` and method match that Skill version;
2. `skillId`, `profileHash`, and `seller` match the Registry qualification;
3. network and asset match the enabled Settlement profile;
4. the response is fresh and not expired; and
5. a second observation of the same `offerId` has identical content.

Production requires HTTPS. Local/private-Anvil tests may use loopback HTTP.
If a future product permits request-specific prices that Settlement cannot
reproduce without private input, it will require an additive signed-offer
profile; that is outside V1.

## Periodic Observation And Quote Admission

Settlement periodically invokes the real service endpoint without a Service
Authorization using a public, non-executing conformance request defined by the
Skill interface. The normal endpoint returns this same `402` response. There is
no `/pricing` route.

For every observation Settlement stores the response hash, endpoint, HTTP
status, observation time, Registry result, risk result, and resulting Quote
identity. An active Quote is an immutable Settlement snapshot of one admitted
response plus Settlement-owned fee/timing configuration.

Before `order.prepare`, Settlement requires an unexpired active Quote whose
latest successful observation is within a configurable freshness window. A
stale or unavailable requirement fails closed for new Orders; existing Orders
are unaffected.

## Price Change Risk Rules

The rules are deterministic configuration, never model judgment:

- identity, endpoint, network, or asset mismatch: reject;
- malformed, expired, reused-with-different-content, or above absolute payment
  caps: reject;
- compare `baseAmount`, `unitPrice`, `maxUsageUnits`, and maximum Provider
  service charge with the last admitted Quote;
- changes within configured relative and absolute bounds may be admitted;
- changes outside a bound enter `pending_review` and suspend new Orders for
  that Skill version;
- observation of a changed requirement prevents silent continued sale under
  the old Quote; existing Orders retain their frozen terms;
- approval creates a new immutable Quote; it never edits the old Quote.

Exact thresholds are Settlement operational policy and are intentionally not
part of the public protocol or smart contracts.

## Quote To Order

`order.prepare` accepts an active Quote identity plus buyer policy context and
the requested `maxUsageUnits`, which must not exceed the Quote maximum.
Settlement locks its fee rate/minimum, computes the fee cap and maximum prepaid
amount, creates the Order/Vault/canonical terms, and returns the existing final
buyer-specific `AgentPayPaymentRequirements`.

The Quote is never consulted again for final billing. Release uses only the
immutable Order terms and accepted Receipt Metadata.

## V1 Non-Goals

- request-specific or model-generated price judgment;
- discounts, auctions, regional pricing, or negotiated pricing;
- Provider Profile/Price Profile migration into the native path;
- automatic approval of unbounded price changes;
- changing existing Order terms when a Provider changes price.

## Duration extension — types 0.14.0

Duration participates in requirement content/hash and offer identity. Changed
duration cannot reuse an offer ID with old content. Existing profiles and funded
Order hashes are unchanged. Deploy strict consumers together; old validators may
reject the optional field. Permitted bounds are Settlement policy (365-day maximum
in the current implementation). Duration cannot extend Quote expiry or an existing
Order. Settlement validates accepted price/duration and freezes effective deadlines.
