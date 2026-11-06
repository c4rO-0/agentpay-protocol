# Timestamp boundaries

Absolute time is an epoch integer; display timezone is not part of its authority.
Chain fields and existing `UnixSeconds` wire values retain seconds. New non-chain
interfaces/storage use integer epoch milliseconds with an explicit schema unit.
Civil dates and durations are different values and require separate conversion.

`packages/types/src/time.ts` supplies range/integer validators, explicit seconds
and milliseconds conversion, and a strict legacy ISO adapter. Millisecond values
are numbers; seconds may be canonical decimal strings or exact decoded integers.
The application range ends in year 9999. Invalid/null/NaN, fractional integers,
implicit rounding and timezone-less text are rejected. Conversion defaults to
exact precision; floor/ceil must be chosen by the caller's deadline semantics.

Legacy ISO compatibility requires a full date/time with Z or a numeric offset,
at most millisecond precision and a valid calendar date. It is an adapter for
existing versioned contracts, not the format for new integer timestamp fields.
No timestamp heuristic guesses a value's unit from its magnitude.

## Versioning decision

Existing frozen v1 signatures, hashes, contract units and ISO wire fields are
not reinterpreted in place. Integer response/input shapes that replace v1 ISO
require a separately identifiable v2 contract or endpoint and updated fixtures,
schemas and consumers. During migration explicit v1 adapters remain; v2 never
silently accepts ambiguous date text. Adding these utilities is source-only and
does not itself migrate downstream vendor packages or running databases.

Timestamp validity does not prove clock synchronization. Operators must verify
clock health; deadlines remain owned by Settlement and the chain as applicable.
UI converts verified instants into a chosen user timezone, labels that timezone,
and converts civil date filters using that timezone's actual day boundaries.

## Participant Order v2

`agentpay.participant-order.v2` replaces only projection metadata timestamps
with explicit millisecond fields. Chain deadlines remain original seconds.
`normalizeParticipantOrder()` validates both versions via explicit ingress;
`participantOrderToLegacy()` is compatibility egress. Package 0.7.0 contains
role schemas, range-aligned seconds/milliseconds and fixtures. Buyer HTTP source
integration has passed; other time responses/storage and rollout remain open.
