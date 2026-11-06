# Order deadline timestamp wire — 2026-10-07

T2d adds versioned order-deadlines.v2 disclosure with integer deliveryDueAtMs,
chainDeliveryDueAtMs, refundAvailableAtMs and providerResponseDueAtMs. Nullable
receipt/response deadlines retain their meaning. The public disclosure version
is independent of deadlinePolicyVersion: old per-Order policy snapshots remain
v1, and old Orders without a snapshot keep null policy/cutoff/margin fields.
No expiry, refund window, signed terms or contract enforcement is extended.

Both participant APIs negotiate this metadata independently using
application/vnd.agentpay.order-deadlines-v2+json. Legacy ISO is the default.
Wallet, Runtime and Provider normalize explicit-zone legacy and new integer
values. Ambiguous dates, unknown versions, incorrect types/ranges, invalid
chain margin and a refund not later than delivery are rejected. Clients never
calculate the deadline from their own clock. x402 envelopes are unchanged.

Types-only and Wallet TypeScript compilation passed. Three-zone regression in
UTC, Asia/Shanghai and America/Los_Angeles: 128 tests per zone / 384 total
(Protocol 29, Settlement 74, Wallet 7, Runtime 9, Provider 9). Additional 25
order-read/deadline/finalization rule tests passed, covering actual scoped SQL
query facades, old orders, owner and Provider roles, cutoff and confirmation.
Temporary loopback exercised Wallet read, Provider read and claim responses.
All four consumers installed identical offline types 0.9.0 with scripts disabled:
SHA256 69c631abb3f2bfece769b24115fbaf54ba412b753349e7b2bb2430419bc4bdb8.
Historical artifact sourceCommit remains a baseline; digest identifies the
uncommitted source snapshot. This is not npm publication or deployed evidence.

No permanent SQL migration, process restart, funded Order, Policy or Registry
write. Financial SQL, authorization/notice responses and remaining T3–T9 loops
are still open. Epoch disclosure does not repair ambiguous old SQL calendars.
