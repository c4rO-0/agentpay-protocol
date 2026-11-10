# Changelog

## 0.4.1 — 2026-11-09

- Repack the private verifier with an exact public Protocol 0.14.3 dependency.
- Preserve verification behavior and wire formats; this is not an npm publication.

## 0.4.0 - 2026-09-17

- Rebuild against `@agentpay/types` 0.4.0. Payment verification and wire
  behavior are unchanged; the types package adds off-chain private-request and
  participant Order definitions.

## 0.3.0 - 2026-09-16

- Rebuild the native AgentPay verifier package against `@agentpay/types` 0.3.0,
  which freezes the public Settlement Authority Controller ABI and release
  manifest boundary.

## 0.2.0 - 2026-09-14

- Add the native x402 v2 `agentpay` scheme and
  `agentpay.safe-module.v1` commitment builder, digest, verifier, and
  idempotent reference acceptance boundary.

## 0.1.0 - 2026-08-16

- Add provider-neutral exact-escrow construction and verification helpers.
