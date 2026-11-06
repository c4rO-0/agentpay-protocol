# Canonical Provider prefixes: types 0.11.1 — 2026-10-20

`paymentEndpointForService` now accepts an optional safe prefix before
`/services/<serviceId>/mcp/invoke` and preserves it when deriving the exact
`/agentpay/invoke` endpoint. This is provider-neutral; `/provider` is only one
platform example. Safe prefixes consist of slash-separated ASCII letters,
digits, hyphens and underscores. Existing HTTPS/loopback rules, canonical URL
serialization, service identity and exact payment-URL comparison still apply.

Versioning decision: package patch 0.11.1. The profile fields, profile v1 label,
canonical serialization and hash algorithm remain unchanged. The existing
root-path vectors still pass unchanged. A fixed prefixed vector is included;
its hash is distinct. No Solidity, ABI, contract compilation or chain deployment
is part of this change. The schema description points to canonical validation;
it does not claim JSON Schema alone validates URL/identity relations.

Negative tests cover mismatched payment paths, traversal, encoded prefixes,
repeated separators, credentials, query/fragment (including empty delimiters),
wrong service and extra fields. All nine types test files passed.

The generated archive SHA-256 is
`b6f03543d59b4ef733342c47249e18bfcaf7712b995bfab1c9fb47c7ff85b076`.
Agent, User, Wallet, Settlement and Market API source dependency pins/locks
select the same archive. Existing manifests were updated with its digest and
an explicit source-snapshot scope. Temporary frozen/offline lock-only checks
passed for Wallet and Market; NPM locks were checked against the archive/version
and integrity. No live consumer node_modules was reinstalled. Consumer source
verification used an unpacked candidate archive in disposable test processes.
A coordinated stopped-service dependency update remains a deployment step.
