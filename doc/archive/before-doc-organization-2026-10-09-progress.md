> Historical snapshot, captured 2026-10-09 before documentation organization.
> Statements of "current", pending tasks and commands describe earlier checkpoints.
> Use the repository README, progress and TODO for current scope. This is not an execution runbook.

# Protocol Progress

## 时间迁移当前安排 — 2026-10-07

基础转换和财务时间 v2 接口有源码证据；身份/状态等剩余协议面尚未关闭。公共 types 当前源码为 0.11.0，不等于已发布或全部部署。
当前整体顺序是 Settlement 财务链、身份认证与 Market、参与者恢复/展示、
整体迁移验收；不再按单字段或单 worker 交接。

本仓库后续：随服务端阶段补齐剩余时间 API/schema/fixtures 与消费者；保持冻结签名/哈希及链上秒字段，最终核对制品版本。
[本仓库待办](../TODO.md)。下方日期检查点中的 Next/下一步是当时安排，
不覆盖本节；源码/fixtures 通过不证明实际部署、恢复或真人演练通过。
本次仅整理计划，未修改程序、存储或运行服务。

## T2f Notice and delivery timestamps — source verified 2026-10-07

Versioned notice/confirmation/receipt timestamps and consumer adapters are
complete; 426 tests pass across three timezones, including real Wallet IPC.
No SQL migration, service restart or financial write.
[Evidence](../records/notice-delivery-timestamp-wire-2026-10-07.md). Next: financial clock validation/storage.

## T2e Service Authorization timestamps — source verified 2026-10-07

Issue/claim/decision have explicit versioned millisecond clocks, preserving
one-time authorization and bounded request identity. Three timezone matrix:
399 checks. No service deployment or financial database writes.
[Evidence](../records/service-authorization-timestamp-wire-2026-10-07.md). Next: notice/mutation timestamps, then financial SQL.

## T2d Order deadline timestamps — source verified 2026-10-07

Deadline disclosure v2 and its consumers are complete; existing per-Order policy
snapshots and chain seconds are preserved. Three-zone regression: 384 checks;
25 additional Order read/deadline/finalization checks. No deployment or financial
state writes. [Evidence](../records/order-deadline-timestamp-wire-2026-10-07.md). Authorization/notice time interfaces remain next.

## T2b finalization timestamps — source verified 2026-10-07

Public finalization v2 uses explicit epoch milliseconds with strict legacy
adaptation. Three timezone focused checks passed; no service deployment,
financial SQL migration or funded Order.
[Evidence](../records/finalization-timestamp-v2-2026-10-07.md). Other time loops remain open.

## Timestamp v2 source review — 2026-10-07

Protocol 0.7.0 timestamp source and affected consumers are verified within the
[recorded boundary](../records/participant-order-time-v2-2026-10-07.md). No running service restart, schema migration
or paid Order. Other timestamp surfaces remain open.


## Timestamp foundation — 2026-10-06

Epoch validation, explicit seconds/milliseconds conversion and strict legacy ISO
compatibility are additive source utilities. Existing frozen wire fields and
on-chain seconds remain unchanged; replacement ISO-to-integer wire shapes need
an identifiable v2 plus consumer updates. Types-only compilation and focused
negative tests passed under UTC, Asia/Shanghai and America/Los_Angeles. See
[the source record](../records/timestamp-foundation-2026-10-06.md).
Vendor/deployment migration is a separate loop.

## Current closeout — 2026-09-28

The User ended additional guided private-Anvil scenarios. Provider admission,
complete random Skill distribution, User Policy setup/migration, successful
purchases and refund/recovery cases were completed within the private
rehearsal scope.
Source archiving/push and static review are complete; the last Order released
with exact chain/token balance reconciliation. Review found a Wallet error
fallback defect and a minor random-script validation mismatch; program fixes
await User approval. Older sections
below are dated development checkpoints, including historical zero-Order,
pre-admission and migration-pending states; they are not current host state.

## 2026-09-27 — Private deadline contract deployment verified

Current bundle `5fe86be37896284dc585` deployed Factory
`0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82`, with its new Vault
implementation, and Controller
`0x9A676e781A523b5d0C0e43731313A708CB607508` at blocks 19/20.
Receipts, runtime code and roles passed deployment and independent reads.
Old code/order remain intact. This is private Anvil, not live Base or a paid
Order under the revised deadline behavior.

## 2026-09-27 — Reusable contract artifact builder preparation checkpoint

The current Vault deadline revision was compiled from current Protocol source
with pinned solc 0.8.24, optimizer 200, viaIR and Cancun using
`contracts/scripts/build-deployment-artifacts.mjs`. The bundle
`5fe86be37896284dc585` passed a second build/reuse and independent `check`.
At this build checkpoint it was an ignored artifact, not yet a deployed contract.
The existing 34 focused Solidity tests passed before preparation. Subsequent
private deployment and direct contract-state verification are recorded above.

## Past

Factory/Vault escrow, minimal Registry, production-candidate Spending Module,
native x402 binding, narrow Authority Controller, typed artifacts, and local
and Base-fork suites are implemented and verified.

## Historical C6 current-state snapshot (superseded by closeout above)

2026-09-26: the approved off-chain `agentpay.service-profile.v1` canonical
hash, Schema and fixture are implemented in Protocol source. Targeted TypeScript build and 18 Protocol fixture/schema tests passed. No package has been repacked
or deployed; Provider registration and Settlement consumption remain open.
[Format](../reference/agentpay-service-profile-v1.md).

Pre-reset review (2026-09-25–26): Protocol TypeScript checks pass; no new
contract/Commitment change is required by the identified A1/A2 runtime issues.
Foundry/Base-fork results below remain historical, not rerun in this review.
See the cross-project review.

The contract and Commitment surfaces remain frozen for rehearsal preparation.
`@agentpay/types 0.4.0` now adds the off-chain
`agentpay.private-request.v1` canonical hash and role-qualified
`agentpay.participant-order.v1` projections, with shared fixtures consumed by
Settlement, Wallet, and Agent. It is not independently audited or canonically
deployed on live Base.

`@agentpay/types 0.5.0` now defines the strict pre-Order
`agentpay.service-payment-required.v1` type, JSON Schema, and fixture. The
Provider-response-to-Quote MySQL smoke passes without changing Commitment or
contract ABI and without introducing Provider Profile into the native path.

## Earlier next-loop plan (superseded by closeout above)

Settlement authenticated Order prepare/read and the persistent M7 runtime now
consume only fresh active Quotes built from this response. Keep the protocol
surface frozen during M8 unless rehearsal finds a blocking defect. After M8
passes, prepare a reviewed, reproducible live-Base canary deployment and verify
source/bytecode/artifact identity before funds are provisioned.

## Vault deadline guards — 2026-09-27, verification pending

User approved chain enforcement. Candidate adds exclusive delivery deadline,
strict positive settlement gap and exclusive release-before-refund boundary.
Five added tests cover zero gap, late activation refund recovery, direct seller/
Authority late delivery, last-timely delivery and release/refund boundary payout.
Existing payout/auth/replay tests remain. Native Forge 1.7.1 cannot run on host
GLIBC; operator Docker-based offline tests prepared with existing Foundry image.
No contract deployed, artifact package published, Policy changed or chain state
written. Settlement time reservation/disclosure integration remains next.

Local solc 0.8.24 compilation of the Vault/Factory test source passed with
optimizer and via-IR; execution assertions still await the operator Forge run.

### Deadline candidate verification passed

Operator offline Forge run: 34 passed, 0 failed, 0 skipped (Factory/Vault 19,
Controller 7, authorization flow 8), Solc 0.8.24. Contract boundary loop closed
within isolated-test scope. Not deployed; Settlement integration and explicit
versioned Factory/Policy migration remain pending.
