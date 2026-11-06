# Finalization timestamp v2 — 2026-10-07

Types 0.8.0 adds finalization-disclosure.v2, a closed schema and explicit legacy
ISO adapter. deliveryAcceptedAtMs, confirmedAtMs and releaseScheduledAtMs are
Unix milliseconds. Null means no scheduled release, never an inferred time.
Invalid ranges, missing timezone, mixed versions and private fields fail.
Media negotiation handles multiple types and q=0. These are disclosure helpers,
not signed fields; hashes, ABIs and UnixSeconds contract semantics are unchanged.
Types-only compilation and 27 focused checks per timezone passed in UTC,
Shanghai and Los Angeles. Four consumers installed the identical local tarball:
SHA256 b737e349cf83823a41240b1210620907a3720ddfb07b0d0526c3a4d389903dcc.
This source snapshot is not committed, published or deployed. Other interfaces
and financial storage remain separate migration loops.
