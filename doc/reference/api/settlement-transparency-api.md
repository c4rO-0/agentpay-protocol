# Settlement Transparency API

This document defines a recommended public read surface for a production
Settlement integrating AgentPay x402 escrow. It is not the API implemented by
the local reference and it does not make private Settlement policy normative.

The purpose is to let users, Skills, marketplaces, and operators correlate a
logical order with its immutable Vault and independently inspect money state.

## Response Envelope

Success:

```json
{ "ok": true, "result": {} }
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "order not found",
    "traceId": "public-correlation-id"
  }
}
```

Clients branch on `error.code`, never on `message`. See the
[Error Dictionary](./error-dictionary.md).

## `GET /health`

Returns service and chain-readiness information:

| Field | Meaning |
| --- | --- |
| `ok` | service can answer requests |
| `version` | Settlement release version |
| `protocolVersion` | supported escrow and authorization profile versions |
| `chainId` | configured chain ID |
| `network` | x402 CAIP-2 network identifier |
| `factoryAddress` | pinned approved Factory |
| `spendingModuleAddress` | pinned approved AgentPay Spending Module |
| `registryAddress` | public Registry authorized by the user policy; not a Settlement-approved verifier |
| `authorityControllerAddress` | pinned stable Settlement Authority Controller |
| `asset` | pinned settlement token |
| `rpcReady` | latest chain probe succeeded |
| `timestamp` | ISO-8601 observation time |

Health output must not include RPC URLs, facilitator credentials, signer
addresses that are not already protocol-public, or internal topology.

## `GET /settlement/profile`

Returns non-secret policy needed before creating an order:

| Field | Meaning |
| --- | --- |
| `protocolVersion` | supported AgentPay escrow protocol version |
| `authorizationProfile` | supported bounded-authorization and commitment profile |
| `schemaVersion` | supported public record Schema version |
| `network` | supported x402 network |
| `asset` | supported token address |
| `assetDecimals` | token decimals; Base USDC uses `6` |
| `factoryAddress` | approved Factory |
| `spendingModuleAddress` | approved non-upgradeable Spending Module |
| `registryAddress` | public Registry independently checked by Wallet and Module |
| `authorityControllerAddress` | stable Vault authority for new orders |
| `maxTimeoutSeconds` | maximum advertised x402 payment timeout |
| `terms` | public fee/expiry constraints or a versioned policy reference |
| `updatedAt` | ISO-8601 update time |

Pricing and risk internals may remain private. Any value committed into
canonical order terms must be returned with the created order, not inferred
from this mutable profile.

## `GET /settlement/orders/{orderId}`

Returns the public state of one x402 escrow order. Required fields:

```text
protocol
paymentRail
orderId
termsHash
vaultAddress
buyer
seller
token
settlementAuthority
feeRecipient
amount
maxFeeAmount
expiresAt
refundAvailableAt
policyId
commitmentId
paymentAttemptId
vaultState
createdAt
updatedAt
```

Transaction fields are nullable until their stage occurs:

```text
vaultCreationTxHash
fundingTxHash
activationTxHash
deliveryTxHash
releaseTxHash
refundTxHash
```

When available, include protocol records without changing their field
semantics:

- `funding`: `EscrowFundingRecord`;
- `receipt`: `EscrowReceipt`;
- `release`: `EscrowReleaseRecord`;
- `refund`: `EscrowRefundRecord`.

`vaultState` is an observed cache. Clients requiring current money state should
read the Vault directly and use Settlement timestamps only as indexing hints.

## `GET /settlement/orders/{orderId}/events`

An implementation may expose an append-only public event view for easier
indexing. Every item should contain:

```text
type
orderId
vaultAddress
transactionHash
blockNumber
blockHash
logIndex (when event-backed)
observedAt
```

Supported event types should map directly to protocol stages, such as
`vault_created`, `funding_verified`, `activated`, `delivered`, `released`, and
`refunded`. Reorg handling must replace or invalidate stale observations rather
than silently preserving them as final.

## Privacy Boundary

The public API must not expose:

- user request bodies or AI output;
- unredacted provider errors or risk reasons;
- facilitator credentials, private RPC URLs, or signing material;
- internal queue, nonce, account, or recovery metadata;
- address-linked information unrelated to the public order.

`outputHash` and `usageUnits` are public receipt metadata. They do not justify
publishing the corresponding output or request.

## Consistency Rules

- Addresses, atomic amounts, hashes, and timestamps use the public protocol
  formats from `@agentpay/types`.
- A transaction hash is published only after it is associated with the expected
  chain, Vault, order, and operation.
- A facilitator `success` response is not a funding status.
- Terminal Settlement status must agree with the Vault terminal state.
- Retries update one logical order and payment attempt. They do not create a
  second order for the same `orderId` or redeem the same `commitmentId` twice.
