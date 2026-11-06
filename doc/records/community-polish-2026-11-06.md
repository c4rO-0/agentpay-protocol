# Community readability pass — 2026-11-06

## Scope

Prepare Protocol source for community readers. No contract, financial-rule, API,
schema, fixture, version or dependency changes. Historical tools remain labelled
and retained; no histories or data were deleted. Source visibility remains the
owner's decision.

Current documentation now explains independent installation, maintained command
entry points, native versus historical verification, Provider/User Runtime roles,
network configuration and release limits. Root CONTRIBUTING.md and SECURITY.md
provide discoverable links. Public validator and escrow source, artifact tooling
and functional CI scripts use readable multiline formatting. New comments explain
trust boundaries rather than repeating assignments.

## Verification

- Compared TypeScript-parser syntax trees for 28 source files against pre-polish
  snapshots, excluding comments/positions and redundant expression parentheses:
  no structural changes.
- `pnpm test:packages`: workspace builds, 51 types tests, 10 escrow tests, 3 demo
  tests and independent packed consumer passed. Consumer checks two business
  payloads and exported types/schema/ABI/escrow helpers.
- Initial sandbox run failed on tsx's local IPC pipe permission; retry outside
  the sandbox passed, including temporary consumer dependency installation.
- Changed-document relative links and Git whitespace checks passed.
- No Solidity source changed; the earlier chain evidence was not rerun or enlarged
  by this readability pass. No services, chain or database were modified.

## Remaining gates

Owner review, anonymous checkout after opening the source, public distribution,
compatibility policy and independent audit remain separate. This pass does not
remove legacy tooling or declare every historical command production-ready.
