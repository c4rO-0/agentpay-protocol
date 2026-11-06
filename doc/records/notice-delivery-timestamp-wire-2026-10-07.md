# Notices and delivery result timestamp wire — 2026-10-07

T2f adds wallet-notice.v2 and delivery-result.v2, negotiated independently on
participant APIs. Reminder releaseScheduledAtMs, confirmation confirmedAtMs /
releaseDueAtMs and receipt reminderDueAtMs / releaseDueAtMs are integer Unix
milliseconds. Legacy explicit-zone ISO is the default compatibility output.
Duplicate receipts that originally omitted schedule fields still omit them;
no fake schedule or local-clock recomputation is introduced. A late confirmation
can retain an earlier persisted release time. Existing confirmation/notice
labels and actions stay frozen; confirmation is still optional for automatic release.

Wallet validates piggyback notices, their Order binding and the confirmation's
requested Order. Runtime/Provider adapt delivery replies independently of Order
and Service Authorization projections. Private or invalid billing fields are
rejected; billing is not recalculated by the codec. Provider sends completedAtMs
in normal and negative-probe receipts. The route accepts integer or explicit-zone
legacy completion time and rejects mixed representations. Settlement still owns
acceptance time; provider completion cannot backdate it. Provider SQL completion
migration is separate, and the transitional Date adapter is not timezone evidence.

Types-only and Wallet compilation passed. Three-zone matrix (UTC, Shanghai,
Los Angeles): 142 tests each / 426 total (Protocol 34, Settlement 76, Wallet 9,
Runtime 11, Provider 12). Actual temporary HTTP and Wallet IPC cover negotiated
and legacy formats, q=0, notification piggyback, input timestamp rejection before
receipt storage, binding/nonce/signature and retry preservation. Existing opaque
Service Authorization IPC fixture lacked expiry/identities; it initially failed,
then was completed to match the real response and expanded with an invalid-date
IPC rejection. The actual locked/admin/Agent/generic-signing boundary still passes.
The temporary dependency-copy helper initially altered the test's escrow-version
assertion; correction restricts replacement to types only. Escrow stays 0.4.0;
ABI, hash and SDK pin checks pass. No contract artifact was changed.

Four consumers use identical offline types 0.11.0, scripts disabled, SHA256
a3453291def5cc9262664ac12be1aae06a90a5d84ea575b6dbee5a05de11b829. Artifact sourceCommit is historical; digest identifies uncommitted
source. No npm publication, real database migration, service restart, Registry /
Policy write or funded Order. Poll-notice script syntax checked, not executed
against the private deployment. Financial calendars remain a separate T3 gate.
Before rollout, old notice payloads must be verified/adapted explicitly; malformed
piggyback notices fail the client response rather than silently omitting time.
Other identity/status APIs and local/Market/UI clocks remain open; this is not
all-project completion or participant evidence.
