> Historical snapshot, captured 2026-10-09 before documentation organization.
> Statements of "current", pending tasks and commands describe earlier checkpoints.
> Use the repository README, progress and TODO for current scope. This is not an execution runbook.

# AgentPay Protocol TODO

## 时间迁移当前待办 — 2026-10-07

基础转换和财务时间 v2 接口有源码证据；身份/状态等剩余协议面尚未关闭。公共 types 当前源码为 0.11.0，不等于已发布或全部部署。

- [ ] 随服务端阶段补齐剩余时间 API/schema/fixtures 与消费者；保持冻结签名/哈希及链上秒字段，最终核对制品版本。
- [ ] 本仓库范围完成后统一关联验证，明确源码、真实存储、进程/链和参与者
  证据差异；最终部署前核对兼容和旧 writer，不能局部上线。

下方已勾选时间记录是历史源码证据；未勾选的非时间产品任务仍有效。

- [x] T2f notice/delivery timestamp interfaces and consumers; 426 three-zone checks.

- [x] T2e service authorization epoch interfaces and consumers; three-zone 399 checks.

- [x] T2d versioned deadline timestamps; three-zone 384 checks plus 25 rule regressions.

- [x] T2b finalization timestamp source loop; three-zone regression, types 0.8.0.


## Timestamp migration — 2026-10-06

- [x] Types-only compilation and negative tests under UTC, Asia/Shanghai and America/Los_Angeles for additive validators/converters (2026-10-06); no downstream deployment claim.
- [ ] Versioned timestamp API/schema/fixtures and consumer rollout; retain frozen v1 compatibility without implicit units or timezone text.
- [ ] Downstream vendor snapshots and conformance; no on-chain time unit/signature/hash changes.

## Provider contract compatibility — recorded 2026-09-28

- [ ] Before supporting multiple contract generations, let Provider verify that
  each Order's actual contract generation meets the service's supported/required
  versions before accepting execution. Resolve the deployed Factory/Vault and
  relevant ABI/semantics from authenticated Settlement and verifiable chain
  facts; a User-declared version or the globally newest deployment is not proof.
- [ ] Define trusted version identification, service compatibility requirements,
  mismatch errors and retry/recovery behavior in a separately reviewed design.
  Include old-Policy User/new Settlement combinations and existing in-flight
  Orders. No new wire field, on-chain version mechanism or runtime check is
  specified or implemented by this note.


## Current scope — 2026-09-28

The current private scenario run has ended at the User's request. Historical
setup/repetition tasks below do not require restarting this completed run.
Public release and remaining component work are tracked here and in
[this repository's progress](../../progress.md).

## Contract generation for deadline upgrade — 2026-09-27

- [x] Add reusable source/compiler-bound deployment artifact build and check
  entry, independent of stale Foundry `out/` artifacts.
- [x] Build current Vault/Factory/Controller bundle and verify repeatability.
- [x] Record private deployed addresses, receipts, runtime bytes and Controller
  roles after guarded deployment; keep live Base evidence separate.

Last updated: 2026-09-26

## Purpose of This File

This is the implementation backlog for the open-source `protocol` repository.
Tasks here must produce protocol-owned code, schemas, tests, documentation, or
release artifacts with explicit acceptance criteria.

Cross-repository sequencing and product/deployment status belong in the root
`progress.md`; do not duplicate settlement, market, agent, or operator task
details here.

## Approved Service Profile Work — 2026-09-26

- [x] Define the versioned public service identity hash, Schema and fixture
  without changing existing contract ABIs, commitments or wire fields.
- [ ] Pin a new `@agentpay/types` artifact in Provider/Settlement after the
  registration implementation is reviewed; verify shared fixture end to end.
- [ ] Preserve historical rehearsal hashes as legacy test data; no silent
  reinterpretation or upgrade of persisted profile identities.

[Format and consumer scope](../reference/agentpay-service-profile-v1.md).

## Current Focus

The production-candidate surface and Base-fork gate are complete. During human
rehearsal preparation, keep contracts and wire formats frozen unless a blocking
finding demonstrates a required change. The next Protocol-owned release loop is
reproducible live-Base canary artifacts after rehearsal; audit remains a
separate production gate.

The pre-reset backend review
keeps contract/Commitment changes out of C6. A1/A2 recovery fixes belong to the
runtime consumers; R8 handoff/backup remains open. Type checks are current;
the recorded Foundry/Base-fork results were not rerun by that static review.

The shared native boundary is complete in `@agentpay/types 0.4.0`:
`agentpay.private-request.v1` fixes canonical JSON + Keccak-256 and
`agentpay.participant-order.v1` fixes safe buyer/provider projections. All
three runtime consumers pass the same fixture. This is an off-chain
type/conformance addition; no Commitment or contract ABI changed.

The implemented conformance design is
[`agentpay.service-payment-required.v1`](../reference/agentpay-service-payment-required-v1.md):
the Provider-owned, pre-Order class-x402 response from the real service route.
Its `@agentpay/types 0.5.0` Schema/type/fixture and Settlement protected-MySQL
observation/Quote smoke and participant-facing Order routes now pass through
the persistent M7 runtime.

- P0 open-source hygiene is complete.
- P1 public types and schemas is complete.
- P2 provider-neutral verification is complete.
- P3 conformance suite and CI is complete in the repository.
- P4 minimal open reference is complete.
- P4A delegated authorization has closed its local Module/Registry/Wallet gate.
  Authority Controller implementation/proof, public ABI, threat model, and
  packaged artifacts are complete. Live deployment and audit remain later gates;
  production runtime ownership remains in `settlement`.
- The minimal `agentpay.safe-module.v1` transport types, JSON Schema, EIP-712
  commitment fixture, verifier, acceptance record, and settle response are
  implemented in source together with bounded policy/Registry qualification,
  a production-candidate Module/Registry, typed ABIs, and a shared hash fixture.
  The Controller is implemented, locally proven, and included in reviewed
  production-candidate artifacts.
- P5 deployment and release artifacts continues after those public contracts,
  types, and conformance rules stabilize.
- The fixed pre-Base order has reached rehearsal preparation: artifact review,
  consumer package checks, and the production-candidate Base-fork suite passed.
  Neither fork nor future rehearsal evidence is a live deployment claim.
- P6 Git-history and identity review remains deferred until immediately before
  the repository is made public.

## Current Scope

The protocol repository owns:

- `AgentPayEscrowFactory` and `OrderEscrowVault` for
  `x402_exact_escrow`;
- public field definitions, schemas, state semantics, and transparency APIs;
- facilitator-neutral verification behavior;
- local reference implementations and conformance tests;
- deployment manifest and release artifact formats.
- production Safe Spending Module, delegated commitment/Registry qualification formats, and
  stable Settlement Authority Controller behavior once P4A implements and
  versions them (now implemented; live release remains pending).

The old open stack based on `PaymentVault`, user delegation, order preview,
and payment execution has been removed.

`DealManager` and Safe allowance remain temporarily as legacy regression code.
They are not part of the target public protocol and are scheduled for removal
in P5.

## Completed x402 Foundation

- [x] Add Factory and per-order Vault contracts.
- [x] Cover create/predict, funding activation, release, fee cap, authority
  refund, and timeout refund with Foundry tests.
- [x] Prove CDP `/verify` accepts a contract `payTo` on Base mainnet.
- [x] Prove CDP `/settle` transfers Base USDC into a real Vault.
- [x] Activate and refund the smoke Vault on-chain.
- [x] Record authenticated CDP `/supported` evidence for x402 v2 Base
  `batch-settlement` and prove an AgentPay-shaped custom payload is rejected at
  hosted request-schema validation without signing or settlement.
- [x] Prove against pinned `@x402/core 2.21.0` that facilitator dispatch ignores
  `extra.assetTransferMethod` and selects the first handler registered for a
  version, scheme, and network; prove scheme `agentpay` isolates
  verify and settle routing without network access.
- [x] Document the v1 protocol boundary, funding evidence, conformance target,
  deployment manifest, and public transparency fields.
- [x] Remove real smoke Factory/Vault/transaction identifiers from the current
  public-facing smoke document.

## P0: Open-Source Hygiene (Completed)

- [x] Replace host-specific absolute paths in scripts and docs with
  repository-relative discovery and portable examples.
- [x] Add `deployments/*.json` and `deployments/*.html` to `.dockerignore` so
  local wallet metadata cannot enter a broad Docker build context.
- [x] Ensure generated deployment records, private keys, facilitator
  credentials, RPC credentials, and local HTML are excluded from releases.
- [x] Add an MIT `LICENSE`, matching the existing Solidity source headers.
- [x] Add `SECURITY.md` using GitHub private vulnerability reporting, without
  publishing a personal security address.
- [x] Add `CONTRIBUTING.md` with required tests, compatibility notes, and
  documentation rules.

Acceptance: a clean checkout contains no private operational artifacts, uses
portable commands, and has explicit legal, contribution, and private security
reporting rules. Git-history publication checks are deferred to P6.

## P1: Public Types and Schemas (Completed)

- [x] Add `PaymentRail` with `safe_allowance_deal_manager` and
  `x402_exact_escrow` values.
- [x] Add public types for `EscrowOrderTerms`, `EscrowVaultState`,
  `X402PaymentRequired`, `X402SettlementEvidence`, `EscrowFundingRecord`,
  `EscrowReceipt`, `EscrowReleaseRecord`, and `EscrowRefundRecord`.
- [x] Publish equivalent JSON Schemas for non-TypeScript implementations.
- [x] Define canonical terms-document bytes and `termsHash` fixtures.
- [x] Export typed contract ABIs without committing environment-specific
  deployment output.
- [x] Add schema/package versioning and a changelog policy for breaking changes.

Acceptance: TypeScript and one non-TypeScript consumer can validate the same
fixture and derive identical identifiers and hashes.

## P2: Provider-Neutral Verification Library (Completed)

- [x] Define a provider-neutral `X402Facilitator` interface with normalized
  verify and settlement results.
- [x] Provide CDP as the first verified `exact` compatibility adapter and a
  mock adapter for local tests; keep CDP credentials and response types inside
  the adapter. Do not make the provider-neutral interface or target
  native AgentPay binding depend on CDP.
- [x] Implement `buildPaymentRequired(order)`.
- [x] Implement `validatePaymentRequired(requirements, order)`.
- [x] Implement receipt/network/asset validation for settlement evidence.
- [x] Implement Base USDC `Transfer` verification for buyer, Vault, and amount.
- [x] Implement bounded Vault balance retry for RPC consistency lag.
- [x] Implement immutable Vault-term verification before activation.
- [x] Keep core verification independent from CDP credentials and
  response-only trust so another facilitator can replace the CDP adapter.
- [x] Define idempotency behavior for repeated payment identifiers and repeated
  settlement evidence.

Acceptance: the library accepts valid normalized evidence and rejects wrong
network, token, amount, payer, recipient, failed receipt, and missing Transfer
evidence without contacting a proprietary facilitator.

## P3: Conformance Suite and CI (Completed)

- [x] Add a local mock facilitator and standard six-decimal mock USDC fixture.
- [x] Add positive create/fund/activate/ticket/deliver/release/refund flows.
- [x] Add all negative cases listed in `doc/x402-escrow-conformance.md`.
- [x] Add terminal-state and payment-identifier replay tests.
- [x] Add stale-RPC-balance retry tests.
- [x] Add a GitHub Actions Foundry job alongside Node conformance tests.
- [x] Publish stable `x402-conformance (required)` and
  `foundry-contracts (required)` job names for branch protection.

Acceptance: contributors can run all conformance tests locally without Base,
CDP credentials, buyer funds, or private keys, and CI enforces the same suite.

## P4: Minimal Open Reference (Completed)

- [x] Add a local x402 escrow reference route that creates/predicts a Vault and
  returns Payment Required.
- [x] Accept normalized mock settlement evidence and verify funding.
- [x] Issue an example Execution Ticket only after Vault state is `Funded` in
  the historical minimal reference; native AgentPay replaces it with Service
  Authorization.
- [x] Demonstrate receipt submission and release/refund through public protocol
  interfaces.
- [x] Keep pricing, fraud controls, disputes, retries, private business payloads,
  and production operations out of the reference.
- [x] Document how closed settlement implementations replace the mock adapter.

Acceptance: a clean checkout can execute the entire x402 escrow lifecycle on a
local chain using only documented commands.

## P4A: Production Delegated Authorization And Authority (Local Gate Complete; Hardening Active)

- [x] Define the provider-side AgentPay class-x402 payment-requirement
  discovery schema and fixtures. This is the pre-Order response from the real
  Provider service and owns `skillId`, `profileHash`, seller, asset, base price,
  unit price, maximum usage, provider version/nonce, and validity. It must not
  contain buyer Safe, `policyId`, Order, Vault, or Settlement fee fields.
- [x] Define how Settlement authenticates, periodically observes, compares,
  and snapshots that response as a Quote before constructing the existing
  buyer-specific `AgentPayPaymentRequirements`. Do not reuse legacy Provider
  Profile pricing as native protocol truth.
- [x] Define the minimal native x402 v2 scheme `agentpay`, binding
  `agentpay.safe-module.v1`, `paymentFlow = escrow`, Payment Required/payload,
  EIP-712 commitment, `policyId`, `commitmentId`, verify result, acceptance,
  and confirmed-funding settle result.
- [ ] Replace the old public `x402_exact_escrow`-only `PaymentRail`, order,
  funding, and receipt types with an additive native AgentPay profile while
  retaining standard `exact` only as compatibility. Keep Settlement-owned
  `paymentAttemptId` and optional upstream correlations out of the signed
  commitment.

- [x] Replace the spike Module with a non-upgradeable production-candidate
  `AgentPaySpendingModule` using immutable policy IDs, per-device/Agent and
  policy delegates, total/per-payment limits, validity, revocation, and
  an independent public Registry binding. Do not bind the Module to a
  Settlement-approved verifier.
- [x] Use unordered `bytes32` commitment nonces/digests and reject both replayed
  commitments and second funding for the same `(safe, factory, orderId)`.
- [x] Validate policy-pinned Factory, deterministic Vault, buyer, token, amount,
  `termsHash`, state, Registry qualification, and strict ERC-20 return
  data before accounting funding.
- [x] Define the minimal versioned Registry qualification types and fixtures
  binding Registry, Skill, developer/control identity, order, and validity.
  Wallet and Module must independently verify the same qualification, and a
  provider cannot self-attest it. Do not add category, trust-tier, price, or
  deny-rule policy predicates in v1.
- [x] Add the minimal native binding commitment, verification, acceptance, and
  confirmed-funding settle types, JSON Schema, EIP-712 fixture, and verifier
  tests without Base funds or CDP fields.
- [x] Extend the public source artifacts with the frozen policy, Registry
  qualification, on-chain redemption ABI, and negative fixtures for the
  Module/Registry local-integration boundary.
- [x] Add the existing funding-evidence fixture plus reviewed Controller typed
  ABI, surface fixture, deployment-manifest Schema, threat model, and compiled
  ABI parity test.
- [x] Propagate the frozen x402 v2 scheme `agentpay` and binding
  `agentpay.safe-module.v1` across types, schemas, Wallet, Settlement, Module,
  fixtures, and conformance. Do not register it under standard EVM
  `batch-settlement`.
- [x] Specify native AgentPay x402 `paymentFlow = escrow` and both settle
  stages. The Vault is funded before Skill execution and released/refunded
  afterward; publish conforming Verify/Settle
  responses and do not treat internal `accept -> commitmentId` as settlement.
- [x] Publish a minimal reference binding and conformance fixture proving
  `verify -> accept -> commitmentId` without Base funds, CDP fields, runtime
  credentials, or Settlement-owned persistence.
- [x] Fix the interoperable Gateway contract around public base `/x402`, public
  capability discovery, authenticated verify/settle calls, unchanged standard
  `exact` forwarding, and native bounded `settlement_pending` retries. Gateway
  credential storage and runtime orchestration remain Settlement-owned.
- [x] Before production traffic, add a non-upgradeable, narrow
  `SettlementAuthorityController` that only
  forwards approved AgentPay Vault delivery/release/refund/cancel operations,
  verifies Factory/Vault provenance, supports administrator-Safe pause and
  executor rotation, and exposes no arbitrary call surface.
- [x] Controller v1 design is fixed to one immutable administrator Safe, one
  immutable approved Factory, and one rotatable operational executor. The
  administrator can only rotate the executor and pause/unpause; it does not
  inherit order-operation authority. `activate()` remains permissionless on
  the Vault and is deliberately not forwarded by the Controller.
- [x] Prove Controller executor rotation leaves existing Vault authority
  unchanged; prove removed executors, unapproved Vaults, arbitrary calldata,
  paused actions, and role escalation fail.
- [x] Run an official Safe v1.4.1 Anvil integration with two pre-rotation
  Vaults. Prove exactly three Safe administration transactions for executor
  rotation and pause/unpause, zero per-order Safe transactions, old-executor
  rejection, pause enforcement, recovery, release/refund, and unchanged Vault
  addresses/authority.
- [x] Repeat focused Foundry policy/negative tests and a real Anvil Wallet
  commitment -> Module redemption -> Vault activation -> EOA-authority
  release/refund flow using official Safe v1.4.1 contracts.
- [x] Repeat the production-candidate contract flow on a Base fork with
  canonical Safe v1.4.1, official Base USDC, Controller release/refund,
  permissionless timeout refund, pause, and executor rotation. Settlement
  runtime crash recovery on the fork remains a separate operational gate.
- [x] Publish the production-candidate ABI, typed ABI, Schema, threat model,
  deployment-manifest format, honest `not-audited` status, and local
  conformance vectors for Module and Controller. A canonical Base deployment
  record and external audit remain later gates.

The next Protocol closure is limited to reviewed artifacts and consumer
verification. It must not add Controller authority, generic calls, upgrade
surfaces, or new policy scope. Base-fork execution starts only after the source,
ABI/types, fixtures, manifest format, package version, commit, and hashes agree.

Acceptance: one user-confirmed policy supports two concurrent eligible orders
without owner interaction; dynamic matching Skills do not require policy
replacement; neither Session Key nor Settlement executor can exceed its
on-chain authority; and Authority executor keys rotate without changing
existing Vaults.

## P5: Deployment and Release Artifacts

- [x] Build versioned local `.tgz` artifacts for `@agentpay/types` and
  `@agentpay/x402-escrow` with `pnpm pack`; record package version, source
  commit, and SHA-256 for Settlement consumption. Keep `private: true` and do
  not publish either package to a registry without a separate explicit
  decision. These existing artifacts cover the earlier exact-escrow baseline,
  not the new native binding.
- [x] After P4A interfaces and fixtures are reviewed and committed, rebuild the
  native-capable packages, record the new source commit and SHA-256 values, and
  prove Settlement and Wallet consume the packaged verifier/types/ABIs rather
  than source copies. Local `0.3.0` artifacts are pinned to commit
  `ad12024429e15657ee5242236560115646e00745`; they remain private local
  artifacts, not a registry publication.
- [ ] Remove the legacy DealManager/Safe allowance reference rail, scripts,
  dependencies, and documentation from the public release after confirming no
  remaining x402 package or fixture depends on them.
- [ ] Publish ABI and typed ABI artifacts for Factory and Vault.
- [x] Validate deployment manifests against the documented v1 schema and pin
  the canonical Base Factory/implementation record.
- [x] Provide source commit/compiler/optimizer/bytecode verification commands.
- [ ] Document Base mainnet + official Base USDC as the only verified v1
  profile; reject unsupported token behavior by default.
- [ ] Add protocol/schema/package versions and release notes.
- [ ] Mark audit status explicitly; do not imply an audit that has not occurred.

Acceptance: a third party can verify a deployment against a source release and
determine the exact supported network, asset, ABI, and protocol version.

## P6: Final Public Publication

- [ ] After the GitHub repository is public, enable branch protection and make
  `x402-conformance (required)` and `foundry-contracts (required)` required
  status checks for the default branch.
- [ ] Run a full-history secret scanner such as `gitleaks` and record only the
  result and remediation status, never detected values.
- [ ] Review historical author email addresses and smoke-chain wallet,
  contract, and transaction identifiers.
- [ ] If historical metadata is not acceptable, publish from a clean squashed
  repository or sanitize history immediately before making the repository
  public.
- [ ] Run a final current-tree secret and generated-artifact check against the
  exact release commit.

Acceptance: the exact repository and history being published contain no
unapproved secrets, personal identifiers, operational wallet metadata, or
generated local deployment records.

## Out of Scope

- implementing ERC-7710 before a mainstream x402 client and facilitator expose
  a proven end-to-end verify and settle path;

Do not move these production responsibilities into this repository:

- pricing, fee policy, provider admission, fraud and risk models;
- customer disputes, dynamic billing, or business-output judgment;
- production worker credentials, facilitator credentials, or private keys;
- user business requests or agent output payloads;
- settlement, market, or operator deployment configuration.

- [ ] Run focused Vault deadline/Controller/authorization tests and record results.
- [ ] Integrate revision-2 time reservation and both participant disclosures in
  Settlement before new Factory/Policy migration. Do not deploy guards alone as
  an end-to-end timing fix; old Vaults are immutable.

## Timestamp source review — 2026-10-07

- [x] Timestamp changes and affected caller checks in [this record](../records/participant-order-time-v2-2026-10-07.md).
- [ ] Remaining time interfaces/storage and real deployment/recovery evidence.
