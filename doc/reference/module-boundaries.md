# Module Boundaries

AgentPay Protocol is intentionally smaller than the complete AgentPay product.
This document defines what belongs in this repository, what belongs in
production services, and which cross-module dependencies are allowed.

## Protocol Repository

The protocol repository owns behavior that an independent implementation must
be able to inspect and reproduce:

- Factory and per-order Vault contracts;
- public order, payment, evidence, receipt, release, and refund fields;
- canonical terms encoding and hash fixtures;
- typed ABIs and JSON Schema;
- provider-neutral Payment Required and funding verification;
- the provider-neutral AgentPay binding interface, verifier, fixtures, and
  conformance behavior, plus an open CDP `exact` compatibility adapter;
- local reference behavior and conformance tests;
- deployment and bytecode verification formats.
- Spending Module, commitment/Registry-qualification formats, and narrow Authority
  Controller behavior.

It must not contain production credentials, private business requests, AI
outputs, customer records, internal risk decisions, or operator configuration.

## Production Settlement

Settlement consumes this protocol and owns the operational interpretation:

- pricing and fee policy;
- commercial provider admission and service identity;
- durable orders, jobs, idempotency, and transaction associations;
- the provider-neutral x402 Gateway, route policy, capability aggregation, and
  upstream failure isolation;
- the native AgentPay binding runtime, authenticated calls, durable commitment
  acceptance, complete order settlement lifecycle, and `commitmentId` ownership;
- optional upstream-provider credentials and unchanged standard-scheme calls;
- RPC evidence collection and chain retry policy;
- separated legacy Ticket Signer, native Authority Executor, and Relayer;
- native Service Authorization plus legacy Execution Ticket compatibility;
- Receipt Metadata acceptance, release/refund decisions, and accounting;
- queues, nonce handling, retries, reconciliation, and operator recovery.

Settlement must not redefine canonical terms, accept different Vault fields, or
treat a facilitator response as funding proof.

Settlement does not appoint the Registry authority trusted by the Spending
Module. Public Skill qualification remains an independent Protocol/Registry
boundary; Settlement may consume it for orchestration and commercial policy.

The first AgentPay binding runtime may share the Settlement process and deploy
surface. That is a runtime choice, not protocol ownership: it remains a narrow
logical module with separate service authentication and relayer credentials,
and may later move to its own process without changing public payloads.

## AgentPay Wallet

The open Wallet repository owns user-side Session
Keys, local/self-hosted key protection, canonical commitment validation,
independent Registry qualification validation, and narrow commitment signing. It never holds
the Safe owner key or exposes generic signing. Settlement, Marketplace, Skills,
and facilitators never receive Session Key material.

## Provider service

The Provider server owns:

- Service Authorization verification;
- service and request-hash binding;
- one-time authorization claim behavior;
- private request execution;
- direct output delivery to the caller;
- submission of `outputHash` and `usageUnits` receipt metadata.

It must not price orders, move escrow funds, choose fee recipients, or receive a
facilitator credential.

## User Runtime and Skills

The user-side Runtime and installed Skills bind private requests to their hashes,
coordinate bounded Wallet payments, invoke Providers and retain request/result
recovery records. They do not hold Safe owner keys or decide escrow finalization.
Provider business validation stays in the Provider and its Skill.

## Marketplace

Marketplace services own catalog and product experience:

- AI Skill listings and discovery;
- wallet connection and purchase UI;
- installation guidance and participant-scoped Order support;
- displaying Settlement and chain status;
- user and developer activity views.

They must not construct authoritative Vault terms independently, issue tickets,
or decide that a payment is funded.

## Settlement Authority

Controller-managed Vaults bind authority to a stable, narrow Controller. An administrator
Safe can pause it and rotate executors; online executors can call only approved
AgentPay Vault delivery/finalization methods. The Controller is not a generic
transaction proxy, and its executor is distinct from Ticket signer and relayer.

## Operator UI

Operator tooling may expose Settlement-owned state and controlled recovery
actions. It must not bypass Vault authorization or create an alternative money
state. Public protocol APIs must not expose operator credentials, private risk
reasons, business payloads, or address-level private accounting.

## Data Boundary

| Data | Protocol/public | Settlement private | Agent private |
| --- | --- | --- | --- |
| `orderId`, `termsHash`, Vault, amount | yes | persisted copy | ticket reference |
| funding/release/refund transaction hashes | yes | authoritative index | no |
| `outputHash`, `usageUnits` | receipt metadata | yes | generated |
| user request | no | no | yes |
| AI output | no | no | yes |
| binding/provider service credentials | no | yes | no |
| pricing/risk policy | no | yes | no |
| private keys | never | protected signer only | protected signer if required |

## Extension Rules

Add a protocol abstraction only when independent implementations need the same
behavior. Examples include a new public evidence field, canonical encoding, or
facilitator interface.

Keep an implementation detail outside protocol when deployments may choose it
independently. Examples include database technology, queue topology, RPC vendor,
retry schedule, fraud model, or operator approval workflow.

New compatibility providers implement `X402Facilitator`. The selected AgentPay
binding implements the same provider-neutral boundary inside Settlement. Neither
path adds provider fields to core orders unless those fields become
provider-independent protocol requirements.

New networks or assets require a versioned support profile, evidence, and
conformance coverage. Do not turn local profile injection into acceptance of
arbitrary production tokens.

## Change Classification

| Change | Compatibility level | Required work |
| --- | --- | --- |
| docs wording with no semantics | patch | link and format checks |
| additive optional public field | minor | types, Schema, fixtures, tests, changelog |
| canonical byte or hash change | major | new protocol version and migration |
| ABI or state-number change | major | contracts, ABI, conformance, deployment migration |
| new facilitator adapter | minor | adapter tests; core unchanged |
| new network/asset profile | minor or major by semantics | profile evidence and conformance |
| Settlement policy change | outside protocol | production service tests and docs |

## Legacy Code

DealManager and Safe allowance code remains temporarily as regression material.
It is not part of the target x402 public protocol and must not receive new
features. Any removal requires checking package, fixture and migration consumers;
this documentation cleanup does not remove it.
