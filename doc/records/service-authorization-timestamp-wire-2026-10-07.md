# Service Authorization timestamp wire — 2026-10-07

T2e versions issue/claim/decision disclosure as agentpay.service-authorization.v2.
expiresAtMs is required; responseDueAtMs and respondedAtMs are optional integer
Unix milliseconds. Claim expiry and Provider response cutoff remain different
instants: a valid earlier claim may lead to a response window beyond token expiry.
The decoder does not invent an ordering constraint that would truncate that window.
Canonical Order expiresAt remains seconds and is decoded separately.

Wallet service.ready and Provider claim/decision opt in through
application/vnd.agentpay.service-authorization-v2+json. Legacy unversioned ISO
remains the default; q=0 does not opt in. Wallet, Runtime and Provider adapt old
and new responses with strict date/unit/version/identity checks. The opaque
one-time authorization, authorizationId, requestHash, Order identity, claim and
decision flags are preserved. Receipt replies are not misclassified as claim
views merely because they have authorizationId. Wallet binds returned orderId
and requestHash to the signed request; mismatch fails SETTLEMENT_RESPONSE_INVALID.
No per-order owner signature or broader signing authority is added.

Types-only and Wallet compilation passed. Three timezone matrix (UTC,
Asia/Shanghai, America/Los_Angeles): 133 checks each / 399 total (Protocol 31,
Settlement 75, Wallet 7, Runtime 10, Provider 10). Real temporary HTTP exercises
service.ready/claim/decision legacy and v2 negotiation, q=0, bad times, identity
binding and independent nested deadline/finalization adaptation. Existing nonce,
hash, schema, quote and invocation recovery checks remain in the matrix.
The unclaimed-expiry scenario script now reads and validates expiresAtMs;
syntax checked only, no private paid scenario was executed in this loop.

Four consumers use identical offline types 0.10.0, scripts disabled, SHA256
983f6be9ee83473e9b891e6efc42cf93d492db85c883ebeb7f0cd1c06079fd47.
Artifact sourceCommit is a historical baseline; digest identifies uncommitted
source. This is not npm publication, process recovery or participant evidence.
No permanent SQL migration, running service restart, Registry/Policy write or
funded Order occurred. SQL authorization/deadline authority still needs T3;
notifications and mutation-result timestamps remain T2 work. T4–T9 remain open.
