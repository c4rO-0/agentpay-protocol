# Error Dictionary

This dictionary defines stable error categories for AgentPay x402 escrow
integrations. Production Settlement may add codes, but must not reuse these
codes with different meanings.

## Envelope

```json
{
  "ok": false,
  "error": {
    "code": "FUNDING_NOT_VERIFIED",
    "message": "funding evidence is incomplete",
    "details": {},
    "traceId": "public-correlation-id"
  }
}
```

- `code` is stable and machine-readable.
- `message` is human-readable and may change.
- `details` contains non-secret structured context only.
- `traceId` correlates support logs without exposing internal state.

## Input And Lookup

### `INVALID_INPUT`

The request is missing a field or contains an invalid address, amount, hash,
timestamp, network, asset, or mode. Correct the request before retrying.

### `NOT_FOUND`

The order, Vault association, payment attempt, or receipt does not exist in the
queried Settlement. Refresh the identifier; blind retries will not repair it.

### `UNSUPPORTED_PROFILE`

The requested protocol version, authorization profile, network, asset, x402
scheme, or extension is not supported. The current target profile is Base,
official Base USDC, bounded Safe policy authorization, and AgentPay
`batch-settlement` commitments.

## Order And Payment

### `ORDER_CONFLICT`

The `orderId`, `termsHash`, Vault, or immutable terms conflict with an existing
order. Do not create a replacement order until the conflict is investigated.

### `PAYMENT_REQUIREMENT_MISMATCH`

The submitted payment requirement or Wallet commitment differs from the
persisted order or policy, including `payTo`, buyer Safe, asset, amount,
network, extension, policy, scope, or commitment identifier. Obtain a fresh
requirement from Settlement and ask Wallet to evaluate it against the existing
policy.

### `PAYMENT_REJECTED`

The facilitator rejected verification or settlement. `details` may contain a
sanitized provider category, but never credentials or an unredacted upstream
response. Retry only when the category is explicitly retryable.

### `PAYMENT_EXPIRED`

The payment requirement, commitment, policy, or order terms expired before
settlement. Create a new order or commitment as appropriate; do not mutate
signed canonical terms.

### `FUNDING_NOT_VERIFIED`

Settlement cannot prove all required funding evidence: successful receipt,
expected USDC `Transfer`, sufficient Vault balance, and matching immutable Vault
terms. Do not issue a Service Authorization.

### `FUNDING_REPLAY`

The commitment identifier, order identifier, or funding transaction is already
associated with a different logical order. This is terminal until an operator
resolves the data conflict.

## Lifecycle

### `INVALID_STATE`

The requested action is not valid for the current Vault state. Refresh the
order and do not automatically replay terminal actions.

### `TICKET_NOT_AUTHORIZED`

Legacy only. The Execution Ticket is absent, expired, already claimed, has an invalid
signature, or does not bind the expected order, service, or request hash.
Obtain a valid ticket before invoking the Skill.

### `SERVICE_AUTHORIZATION_INVALID`

The native Service Authorization is absent, expired, already claimed, revoked,
or does not bind the expected Order, Skill/profile, Provider, request hash, or
maximum usage. Wallet must refresh Order readiness; callers must not substitute
a legacy Execution Ticket or request a per-order owner signature.

### `DELIVERY_REJECTED`

Delivery metadata is unauthorized, malformed, or conflicts with an existing
receipt. Preserve the original output and inspect the order before retrying.

### `FINALIZATION_REJECTED`

Release or refund violates Vault authorization, amount caps, timing, or current
state. Refresh on-chain state and require an explicit recovery decision.

## Infrastructure

### `CHAIN_UNAVAILABLE`

Settlement cannot obtain reliable RPC evidence or submit a transaction. Retry
with bounded backoff only when the operation is idempotent.

### `TRANSACTION_REVERTED`

The expected on-chain transaction was mined with a failed status. The response
should identify the public transaction hash when one exists; never report the
operation as successful.

### `INTERNAL_ERROR`

An unexpected implementation failure occurred. Return a `traceId`, omit private
diagnostics, and do not imply whether a financial operation is safe to retry.

## HTTP Mapping

| Code | Typical status |
| --- | --- |
| `INVALID_INPUT`, `UNSUPPORTED_PROFILE` | `400` |
| `NOT_FOUND` | `404` |
| `TICKET_NOT_AUTHORIZED` | `401` or `403` |
| `ORDER_CONFLICT`, `FUNDING_REPLAY`, `INVALID_STATE` | `409` |
| `PAYMENT_REJECTED`, `PAYMENT_EXPIRED`, `FUNDING_NOT_VERIFIED` | `402` or `422` |
| `CHAIN_UNAVAILABLE` | `503` |
| `TRANSACTION_REVERTED`, `INTERNAL_ERROR` | `500` |

HTTP status supports transport behavior; `error.code` remains the application
contract.
