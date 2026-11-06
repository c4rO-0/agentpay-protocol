# Business-neutrality source correction — 2026-10-21

Unpublished types 0.12.0 accepts only the common JSON transport; no random adapter. Output retains existing SHA-256 JSON.stringify serialization and application shape. Thirty-nine types checks passed, including business-variant rejection. No Solidity, ABI, EIP-712 or established request/profile hash was changed.

Official user setup acceptance uses only the maintained official connectivity suite.
Other business payloads use maintained development fixtures, never user-required
third-party execution. Source checks do not establish deployed or real-funds acceptance.
