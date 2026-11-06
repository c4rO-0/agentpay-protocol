# Participant Order time v2 — source evidence

`@agentpay/types 0.7.0` adds `agentpay.participant-order.v2` with createdAtMs,
updatedAtMs and providerResponseDueAtMs as integer milliseconds. Chain expiresAt
and refundAvailableAt remain canonical seconds strings. Strict normalization
accepts an explicit legacy v1 ISO adapter and rejects unknown fields/versions,
ambiguous dates, invalid units and out-of-range time. Buyer/provider role schemas
and fixtures preserve public identities and exclude private/operational material.
Schema and runtime share the maximum year-9999 second and millisecond boundaries.

Types-only compilation passes. The five types test files yield 24 passing tests
under each of UTC, Asia/Shanghai and America/Los_Angeles, including unchanged
ABI, service-profile, termsHash and private-request hash conformance. Four
consumers installed the same local artifact offline; no public package publish.

SHA256: `6b9b4c7121348f872a3add0d89acacf59f700bdc99b253096df285687b56fd22`.
This is an uncommitted source snapshot, not a deployed contract/service version.
Buyer HTTP integration is source-tested downstream. Provider Order wire and
other lifecycle responses, database migration and participant evidence remain
separate gates. See [time rules](../reference/time-semantics.md).
