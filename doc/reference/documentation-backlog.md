# Retained backlog disposition

Captured 2026-10-09. Audience: maintainers reviewing scope, not users running setup.

The current [TODO](../TODO.md) is the execution queue. This ledger preserves every previously unchecked item with its original section. It is not an additional schedule or a claim that those items remain unimplemented.

| Earlier topic | Current disposition |
| --- | --- |
| Disposable database timestamp migration and compatibility | Superseded by the approved database-only reset; do not schedule historical business-data conversion. Source/SQL evidence does not prove every recovery or browser case. |
| Fresh account, registration, qualification, package and terminal purchase | The private mainline has evidence; independent installations, all negative cases and the complete guided journey still need their own acceptance. |
| Terminal / Provider / Market onboarding | Carried into the current four-stage contribution in TODO. |
| Legacy paths and tables | Record the actual retirement scope; do not restore compatibility. Remaining runtime/operational references require specific review. |
| Security, live network, maintenance, scale and optional product features | Retained as deferred/release work; not cancelled and not implicitly authorized by private success. |
| Anything not resolved by the above | Review against current source and evidence before scheduling or closing; do not silently discard it. |

Full original wording and completed items remain in the [task snapshot](../archive/before-doc-organization-2026-10-09-todo.md). The quotations below are historical task text, not current instructions.

## Retained item 1 — 时间迁移当前待办 — 2026-10-07

> 随服务端阶段补齐剩余时间 API/schema/fixtures 与消费者；保持冻结签名/哈希及链上秒字段，最终核对制品版本。

## Retained item 2 — 时间迁移当前待办 — 2026-10-07

> 本仓库范围完成后统一关联验证，明确源码、真实存储、进程/链和参与者
>   证据差异；最终部署前核对兼容和旧 writer，不能局部上线。

## Retained item 3 — Timestamp migration — 2026-10-06

> Versioned timestamp API/schema/fixtures and consumer rollout; retain frozen v1 compatibility without implicit units or timezone text.

## Retained item 4 — Timestamp migration — 2026-10-06

> Downstream vendor snapshots and conformance; no on-chain time unit/signature/hash changes.

## Retained item 5 — Provider contract compatibility — recorded 2026-09-28

> Before supporting multiple contract generations, let Provider verify that
>   each Order's actual contract generation meets the service's supported/required
>   versions before accepting execution. Resolve the deployed Factory/Vault and
>   relevant ABI/semantics from authenticated Settlement and verifiable chain
>   facts; a User-declared version or the globally newest deployment is not proof.

## Retained item 6 — Provider contract compatibility — recorded 2026-09-28

> Define trusted version identification, service compatibility requirements,
>   mismatch errors and retry/recovery behavior in a separately reviewed design.
>   Include old-Policy User/new Settlement combinations and existing in-flight
>   Orders. No new wire field, on-chain version mechanism or runtime check is
>   specified or implemented by this note.

## Retained item 7 — Approved Service Profile Work — 2026-09-26

> Pin a new `@agentpay/types` artifact in Provider/Settlement after the
>   registration implementation is reviewed; verify shared fixture end to end.

## Retained item 8 — Approved Service Profile Work — 2026-09-26

> Preserve historical rehearsal hashes as legacy test data; no silent
>   reinterpretation or upgrade of persisted profile identities.

## Retained item 9 — P4A: Production Delegated Authorization And Authority (Local Gate Complete; Hardening Active)

> Replace the old public `x402_exact_escrow`-only `PaymentRail`, order,
>   funding, and receipt types with an additive native AgentPay profile while
>   retaining standard `exact` only as compatibility. Keep Settlement-owned
>   `paymentAttemptId` and optional upstream correlations out of the signed
>   commitment.

## Retained item 10 — P5: Deployment and Release Artifacts

> Remove the legacy DealManager/Safe allowance reference rail, scripts,
>   dependencies, and documentation from the public release after confirming no
>   remaining x402 package or fixture depends on them.

## Retained item 11 — P5: Deployment and Release Artifacts

> Publish ABI and typed ABI artifacts for Factory and Vault.

## Retained item 12 — P5: Deployment and Release Artifacts

> Document Base mainnet + official Base USDC as the only verified v1
>   profile; reject unsupported token behavior by default.

## Retained item 13 — P5: Deployment and Release Artifacts

> Add protocol/schema/package versions and release notes.

## Retained item 14 — P5: Deployment and Release Artifacts

> Mark audit status explicitly; do not imply an audit that has not occurred.

## Retained item 15 — P6: Final Public Publication

> After the GitHub repository is public, enable branch protection and make
>   `x402-conformance (required)` and `foundry-contracts (required)` required
>   status checks for the default branch.

## Retained item 16 — P6: Final Public Publication

> Run a full-history secret scanner such as `gitleaks` and record only the
>   result and remediation status, never detected values.

## Retained item 17 — P6: Final Public Publication

> Review historical author email addresses and smoke-chain wallet,
>   contract, and transaction identifiers.

## Retained item 18 — P6: Final Public Publication

> If historical metadata is not acceptable, publish from a clean squashed
>   repository or sanitize history immediately before making the repository
>   public.

## Retained item 19 — P6: Final Public Publication

> Run a final current-tree secret and generated-artifact check against the
>   exact release commit.

## Retained item 20 — Out of Scope

> Run focused Vault deadline/Controller/authorization tests and record results.

## Retained item 21 — Out of Scope

> Integrate revision-2 time reservation and both participant disclosures in
>   Settlement before new Factory/Policy migration. Do not deploy guards alone as
>   an end-to-end timing fix; old Vaults are immutable.

## Retained item 22 — Timestamp source review — 2026-10-07

> Remaining time interfaces/storage and real deployment/recovery evidence.
