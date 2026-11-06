# Contributing to AgentPay Protocol

Changes are welcome within this repository's boundary: contracts, public schemas,
hashes, verification libraries, maintained examples and release tooling.
Application business logic and production account/storage policy belong elsewhere.

## Before changing a public interface

Explain the problem and affected consumers. A new wire field, enum, ABI, hash or
state transition can affect already signed requests and existing Orders. Agree the
compatibility strategy before implementation; never reinterpret historical data.

Keep provider-specific SDK code behind adapters. Native AgentPay payments must not
require CDP, per-order owner signatures or generic signing authority.

## Development and checks

Follow [the developer guide](../develope.md) and [installation](../usage.md).
Use Node 22.22.3 and pnpm 10 to match CI. Run the relevant public behavior tests;
`pnpm test:packages` covers package consumers, while `pnpm test:chain` covers local
contract behavior after package builds. Fork tests are separately configured.

Tests should prove a feature or a failure boundary through real interfaces. Avoid
repeating the implementation in the test. Preserve precise security/financial
regressions unless equivalent coverage has passed. Describe mocked dependencies
and remaining acceptance limits honestly.

## Code and documentation

Use readable multiline code and explain units, trust boundaries and non-obvious
ordering decisions. Keep formatting-only work separate from behavior changes.
Update public schemas, examples, fixtures, version notes and normative docs when
an interface changes. Do not invent new product terms for an existing identifier.

Commit no credentials, real private keys, private signed payloads, runtime data
or build outputs. Reviewed non-secret deployment records are distinct from local
runtime configuration. Inspect the staged diff before committing.

## Pull requests and security

Lead with the problem and resulting behavior. Include compatibility impact, tests
run and any unverified environments. Keep unrelated changes separate.

Report vulnerabilities using [the security policy](../security/SECURITY.md), not
public issues. Contributions use the repository's [MIT license](../../LICENSE).
