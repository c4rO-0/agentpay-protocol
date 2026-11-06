> Historical snapshot retained on 2026-10-27. Use current progress/TODO for
> status and sequencing; unchecked items here are not automatically cancelled.

# AgentPay protocol documentation

Primary audience: Contract/SDK integrators and reviewers. Start with the [repository introduction](../../README.md).

## Read by role

| Reader | Reading path |
| --- | --- |
| User / service or platform operator | [Installation and operation](../usage.md), then the relevant runbook below |
| Developer / integrator | [Development](../develope.md) → [architecture](../architecture.md) → [design](../design.md) → relevant reference/security documents |
| Maintainer planning work | [Current progress](../../progress.md) → [TODO](../TODO.md) → active plan |
| AI coding assistant | [AGENTS.md](../../AGENTS.md) → current progress/TODO → target documentation; AGENTS is instruction, not an end-user tutorial |
| Reviewer / experiment reader | [Evidence catalog](../records/README.md); use each record's date, tested revision and limits |

## Document responsibilities

| Document or directory | Purpose |
| --- | --- |
| README | What this repository does and where each reader starts |
| progress.md | Current state, completed evidence and next work; not a process-monitor output |
| TODO.md | Actionable current/deferred work and acceptance; not an experimental diary |
| usage.md / runbooks | Installation, operation and step-by-step recovery; distinguish user and administrator actions |
| develope.md | Development environment, code entry points and verification; the existing filename is retained |
| architecture.md / design.md | Implementation boundaries versus product requirements and rationale |
| plans | Future sequencing and acceptance; a plan is not implemented behavior |
| reference / security | Detailed contracts, interfaces and security requirements |
| records | Dated experiments, reviews and sanitized evidence; not current setup instructions |
| archive | Superseded descriptions, progress and task snapshots; never a current command queue |

Current status comes from progress/TODO, not the word “current” in an older record. Source tests, private integration, human usability and production qualification are separate claims.

## Reference

- [Generic JSON service transport](../reference/json-service-invocation.md) — types 0.12.0 contract and version decision.

- [Contributing to AgentPay Protocol](../reference/CONTRIBUTING.md)
- [AgentPay Safe Module x402 Binding v1](../reference/agentpay-safe-module-binding-v1.md)
- [AgentPay Service Payment Required v1](../reference/agentpay-service-payment-required-v1.md)
- [AgentPay Service Profile v1](../reference/agentpay-service-profile-v1.md)
- [Error Dictionary](../reference/api/error-dictionary.md)
- [Settlement Transparency API](../reference/api/settlement-transparency-api.md)
- [Deployment Records And Verification](../reference/deployments.md)
- [Retained backlog disposition](../reference/documentation-backlog.md)
- [Module Boundaries](../reference/module-boundaries.md)
- [Open Reference Boundary](../reference/open-reference-lite.md)
- [Settlement Authority Controller v1](../reference/settlement-authority-controller-v1.md)
- [Timestamp boundaries](../reference/time-semantics.md)
- [x402 Escrow Protocol v1](../reference/x402-escrow-protocol.md)

## Security

- [Security Policy](../security/SECURITY.md)

## Historical archive

- [Protocol Progress](before-doc-organization-2026-10-09-progress.md)
- [AgentPay Protocol](before-doc-organization-2026-10-09-readme.md)
- [AgentPay Protocol TODO](before-doc-organization-2026-10-09-todo.md)

## Experimental and review evidence

See the [dated evidence catalog](../records/README.md). Raw logs, private configuration, credentials and request/output payloads do not belong in documentation.

## Package and source-adjacent documents

These remain beside their code/package. Packaged SKILL.md is for the consuming Agent; spike findings are experimental evidence.

- [contracts](../../contracts/README.md)
- [Protocol Packages](../../packages/README.md)
- [0.11.0](../../packages/types/CHANGELOG.md)
- [@agentpay/types](../../packages/types/README.md)
- [Changelog](../../packages/x402-escrow/CHANGELOG.md)
- [@agentpay/x402-escrow](../../packages/x402-escrow/README.md)
- [AgentPay x402 Local Reference](../../packages/x402-reference/README.md)
- [Scripts](../../scripts/README.md)
- [@agentpay/server (Legacy)](../../server/README.md)
- [adapters (Legacy Server)](../../server/src/adapters/README.md)
- [Safe Delegated Authorization Findings](../../spikes/safe-delegated-x402/FINDINGS.md)
- [Safe Delegated x402 Spike](../../spikes/safe-delegated-x402/README.md)

Current release responsibilities are assigned to three stages in [progress](../../progress.md) and [TODO](../TODO.md): private end-to-end acceptance, real-network integration and limited invitation testing. Earlier component checklists preserve unresolved evidence and do not supersede that sequencing.

## Planning review — 2026-10-23

Current [progress](../../progress.md) and [TODO](../TODO.md) separate accepted evidence
from remaining release gates. [Prior progress](before-planning-review-2026-10-23-progress.md)
and [prior TODO](before-planning-review-2026-10-23-todo.md) preserve all earlier
checkpoints and unresolved details; historical pending labels are not new instructions.
