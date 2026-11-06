# Protocol Design

Protocol defines the minimal public rules needed for independent verification:
bounded Safe policies, dynamic Registry qualification, immutable commitments,
deterministic per-order Vaults, evidence-backed activation, and constrained
release/refund authority.

Commercial admission, Provider-price observation/risk policy, fee policy,
provider response timing, reminders, quality disputes, and operator workflow
remain in Settlement. The Controller
has no generic call surface. Standard x402 payloads and AgentPay commitments
are not translated into one another.

Normative details live under [reference](./reference/), especially the
[native binding](./reference/agentpay-safe-module-binding-v1.md) and
[escrow protocol](./reference/x402-escrow-protocol.md).

## Provider service identity — approved off-chain v1

The [service profile v1](./reference/agentpay-service-profile-v1.md) fixes
canonical public bytes and hash for a paid Provider capability. It is distinct
from author packages and mutable offers. No contract ABI or existing payment
wire field changes. Historical consumer version pins are dated integration
evidence; current consumers must select matching reviewed public artifacts.

## Vault deadline behavior revision 2 (deployed and exercised on private Anvil)

This revision preserves OrderInit ABI, wire field names, canonical terms hashing
and the Factory salt encoding. Factory address pinned by Policy identifies the
new deployment; it must not be treated as an in-place upgrade of revision 1.
`expiresAt` becomes an enforced exclusive chain delivery boundary. Both seller
and Authority delivery calls require block.timestamp < expiresAt. Terms require
refundAvailableAt > expiresAt. Authority release requires block.timestamp <
refundAvailableAt; at/after the backstop timeout refund remains permissionless
for Funded and Delivered and returns funds only to buyer. No Delivered-state
permanent lock is introduced. Late activation remains possible for already
transferred funds so that timeout refund recovery remains reachable.

Settlement integration MUST reserve the full normal post-delivery wait and chain
processing margin in the gap, reject late first receipts using server time,
prevent confirmation from postponing release beyond the reserved window, and
expose absolute deadlines to both parties. These integration corrections, new
Factory/Controller deployment, owner Policy migration and subsequent paid
release/refund were verified in the private rehearsal. Existing Vaults retain
old code. This does not establish multi-generation routing or live deployment.
