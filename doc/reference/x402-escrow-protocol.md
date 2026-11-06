# x402 Escrow Protocol v1

Status: normative interface specification. The Base mainnet funding boundary is
verified; production settlement integration is pending.

This v1 document is normative for escrow custody, canonical terms, funding
evidence, activation, ticket gating, release, and refund. Its x402 `exact`
transport is the verified funding baseline, not the final AgentPay user
authorization model. Production additionally requires the P4A native AgentPay
scheme, Wallet/Safe Module, Registry qualification, and Authority Controller extension.

## 1. Scope and Trust Boundary

This specification defines the public escrow-custody interface originally
serialized as the `x402_exact_escrow` compatibility rail:

```text
verified funding source -> OrderEscrowVault -> activation
-> settlement-issued ticket -> Skill execution -> release/refund
```

The production AgentPay composition is specified by P4A and uses:

```text
bounded Safe policy -> Wallet commitment -> AgentPay x402 binding
-> Spending Module redemption -> OrderEscrowVault
-> Service Authorization -> Skill/Provider -> Authority Controller release/refund
```

The native scheme and binding use their versioned AgentPay identities. They do
not overload a standard `exact` EOA signature or imply that it is the
autonomous Wallet authorization model.

The Vault contract constrains custody, recipients, amount caps, state changes,
and timeout refund. The Provider's real service response supplies native price
terms. A Settlement implementation remains responsible for observing and
admitting those terms into an immutable Quote, fee policy, service admission,
Service Authorization, receipt/finalization policy, fraud controls, and retry
operations. Business request and output payloads are not protocol data.

The production Spending Module does not trust a Settlement-approved scope
verifier. A policy authorizes the independently governed public Registry, and
Wallet and Module each validate the same Skill qualification.

Legacy DealManager and Safe allowance code remains temporarily for regression
comparison and is not part of this v1 protocol. Do not add new dependencies on
it; P5 tracks its removal.

## 2. Identifiers and Encoding

All addresses are checksummed EVM addresses. Amounts are decimal strings of
atomic token units. Hashes and transaction hashes are `0x`-prefixed hex.

| Field | Format | Rule |
| --- | --- | --- |
| `paymentRail` | string | `x402_exact_escrow` for this escrow v1 compatibility serialization; P4A defines the target native AgentPay profile separately. |
| `orderId` | `bytes32` | Unique per Factory. Settlement generates it once and persists it before payment. |
| `termsHash` | `bytes32` | `keccak256` of a versioned, canonical UTF-8 terms document. The exact bytes must be retained off-chain. |
| `vaultAddress` | address | Factory prediction or created Vault for this `orderId`. |
| `x402PaymentIdentifier` | string | Compatibility-adapter replay identity; P4A uses distinct payment-attempt and commitment identities. |
| `amount` | decimal string | Exact Base USDC atomic amount for v1. |
| `fundingTxHash` | transaction hash | Facilitator-reported transaction after independently verified on-chain evidence. |

### Canonical Terms Document

`termsHash` is the Ethereum `keccak256` of the UTF-8 bytes of one compact JSON
object. Implementations must emit exactly this field order:

```text
protocol, paymentRail, chainId, factoryAddress, orderId, buyer, seller, token,
settlementAuthority, feeRecipient, amount, maxFeeAmount, expiresAt,
refundAvailableAt
```

Rules:

- `protocol` is `agentpay.x402.escrow.v1`;
- `paymentRail` is `x402_exact_escrow`;
- all addresses are EIP-55 checksummed strings;
- chain ID, amounts, and timestamps are base-10 strings without leading zeroes;
- `orderId` is lowercase `0x`-prefixed bytes32 hex;
- JSON uses double quotes, no insignificant whitespace, and no trailing newline;
- no Unicode normalization or locale-dependent number formatting is applied.

The canonical object intentionally includes Factory, chain, order, all fixed
Vault participants, amounts, and times. It does not include `termsHash` or the
predicted Vault address. The public implementation and fixture are in
`packages/types`; consumers must reproduce the fixture bytes and hash before
claiming conformance.

The current Factory salt is:

```text
keccak256(abi.encode("agentpay.x402.escrow.v1", orderId))
```

Changing this encoding is a breaking protocol version change.

## 3. Vault Terms and States

`OrderEscrowVault.OrderInit` fixes the following values for the life of an
order: buyer, seller, token, settlement authority, fee recipient, amount,
maximum fee, expiry, and refund availability time.

State values:

| Value | State | Meaning |
| --- | --- | --- |
| 0 | `Uninitialized` | Clone has not received terms. |
| 1 | `Created` | Terms fixed; awaiting proven token balance. |
| 2 | `Funded` | Required token balance observed on-chain. |
| 3 | `Delivered` | Seller or settlement authority submitted receipt metadata. |
| 4 | `Released` | Seller/fee paid and remaining balance refunded. |
| 5 | `Refunded` | Balance returned to buyer. |
| 6 | `Cancelled` | Unfunded Vault cancelled by settlement authority. |

Terminal states are `Released`, `Refunded`, and `Cancelled`. They must reject
subsequent release or refund calls.

## 4. x402 Payment Requirements

The v1 Payment Required acceptance must contain:

```json
{
  "scheme": "exact",
  "network": "eip155:8453",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount": "<atomic-usdc-amount>",
  "payTo": "<vault-address>",
  "maxTimeoutSeconds": 300,
  "extra": { "name": "USD Coin", "version": "2" }
}
```

AgentPay extension metadata is additive and must not alter x402 payment
semantics:

```json
{
  "agentpay-order": {
    "version": "1",
    "rail": "x402_exact_escrow",
    "orderId": "<bytes32>",
    "vault": "<address>",
    "buyer": "<address>",
    "seller": "<address>",
    "termsHash": "<bytes32>"
  },
  "payment-identifier": { "id": "<stable-id>" }
}
```

## 5. Funding Verification

AgentPay uses a provider-neutral `X402Facilitator` interface. CDP is the
verified `exact` interoperability adapter, while local tests use a mock
adapter. CDP credentials, SDK types, and provider-specific errors must not
cross the adapter boundary. The native AgentPay mechanism is handled by
Settlement using Protocol's public verifier and fixtures; it does not require
CDP credentials and is not the currently published EVM payment-channel
binding.

A successful binding acceptance or compatibility-provider response alone is
insufficient. Internal AgentPay acceptance returns `commitmentId` before a
funding transaction, which matches the generic batch model but does not by
itself prove wire-format or binding conformance. The relayer's later Module
redemption produces the chain evidence. Before calling `activate()`, a
settlement implementation must verify
all of the following:

1. The accepted commitment and redemption job are durably associated with the
   same order, policy, Vault, amount, and `commitmentId`.
2. The transaction receipt succeeded on Base.
3. A Base USDC `Transfer` event has `from = buyer`, `to = vaultAddress`, and
   `value = amount`.
4. `USDC.balanceOf(vaultAddress) >= amount` after bounded retry.
5. Vault immutable terms match the persisted order.

For the optional CDP `exact` adapter, its normalized success and transaction
hash are additional correlation data, not funding truth. Public RPCs may
briefly return a stale token balance immediately after a receipt. The Transfer
event plus retried balance observation is required.

## 6. Execution and Finalization

After `activate()` succeeds, native Settlement may issue a one-time Service
Authorization to Wallet. The local Skill forwards it with the private request;
the authenticated Provider server claims it online and submits only Receipt
Metadata:

```text
outputHash
usageUnits
```

For finalization:

- `submitDelivery(outputHash, usageUnits)` is called by the fixed Seller or
  Settlement Authority.
- Only the fixed Settlement Authority may call
  `release(sellerAmount, feeAmount)`.

The minimal reference's Execution Ticket is legacy demonstration behavior and
is not the native AgentPay authorization boundary.
- `sellerAmount + feeAmount <= amount` and `feeAmount <= maxFeeAmount`.
- Release pays only the fixed seller and fee recipient; any remaining Vault
  balance returns to buyer.
- Settlement authority may call `refund(amount)` while Funded or Delivered.
- Anyone may call `refundAfterTimeout()` after `refundAvailableAt`; this is
  permissionless, not automatic, and requires a chain transaction.

## 7. Supported Profile and Restrictions

The verified v1 profile is:

```text
Network: Base mainnet (eip155:8453)
Asset: Base USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Scheme: x402 exact
```

Do not treat arbitrary ERC-20 tokens as compatible. Fee-on-transfer, rebasing,
or otherwise non-standard token behavior is outside v1. A new network, asset,
Factory salt, state machine, or terms encoding requires a versioned protocol
change and conformance coverage.

## 8. Required Public Evidence

Public settlement status for this rail must expose the fields defined in
[Settlement Transparency API](./api/settlement-transparency-api.md), without
business payloads, private keys, facilitator credentials, or internal risk
decisions.

## 9. Versioning and Governance

Use `agentpay.x402.escrow.v1` for all v1 versioned data. Changes that alter
ABI, state transitions, hash encoding, or verification requirements are
breaking and require a new protocol version, migration notes, and updated
conformance tests.

Public package types and Schema use semantic versioning. Changing canonical
field order or encoding is breaking even when the Solidity ABI is unchanged.
Repository licensing, contribution, and security-reporting policies are in
this repository's `LICENSE`, `doc/reference/CONTRIBUTING.md`, and
`doc/security/SECURITY.md` files.
