# @agentpay/server (Legacy)

Status: legacy DealManager regression package scheduled for P5 removal. It is
not the current protocol direction and must not receive new features,
integrations, or deployment guidance.

This package contains historical deal-based reference backends:

- Deal Demo Settlement: `src/deal-demo-index.ts`
- Random MCP Demo: `src/deal-random-mcp-demo.ts`

## Reference-Only Boundary

This package was an open reference implementation for legacy behavior:
- API shape and state machine semantics
- conformance baseline target
- local/on-chain development verification

This package is NOT the production risk engine:
- no production-grade anti-abuse strategy
- no production SLA/ops guarantees
- no production incident/monitoring playbooks

The maintained escrow reference is `packages/x402-reference`. Production
authorization targets AgentPay Wallet, Safe Spending Module, Registry qualification,
batch settlement, and the Authority Controller.

## Functional Modules

- `src/deal-demo-index.ts`: minimal deal-based demo settlement HTTP server.
- `src/deal-random-mcp-demo.ts`: minimal random-number MCP demo used by the new deal flow.
- `src/adapters/`: adapter notes and extension points.

## Commands

- Start the open deal demo settlement:
```bash
pnpm --filter @agentpay/server deal-demo:settlement:dev
```

- Start the open random MCP demo:
```bash
pnpm --filter @agentpay/server deal-demo:mcp:dev
```

## Historical Deal-Based Demo

The historical direction was `DealManager + demo settlement + demo random MCP`.
These two local processes provide the minimal open-source reference flow:

- `src/deal-demo-index.ts`
  - create deals
  - collect per-deal user/MCP signatures
  - mark funded
  - open disputes, refund, release, charge back
- `src/deal-random-mcp-demo.ts`
  - return a simple random-number delivery payload

Minimal local sequence:

This demo is a legacy DealManager regression surface. Its `mcpSafe` and amount
fields are not Provider Profile or pricing inputs for native AgentPay.

```bash
curl -X POST http://127.0.0.1:7788/demo/deals \
  -H 'content-type: application/json' \
  -d '{
    "userSafe":"0x1111111111111111111111111111111111111111",
    "mcpSafe":"0x2222222222222222222222222222222222222222",
    "settlement":"0x3333333333333333333333333333333333333333",
    "token":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount":"1000000",
    "fee":"100000",
    "maxRefund":"1000000",
    "maxLiability":"1000000",
    "gracePeriodEnd":"2026-03-21T12:00:00Z",
    "deadline":"2026-03-21T18:00:00Z"
  }'
```

Then:

1. `POST /demo/deals/:dealId/bind-user`
2. `POST /demo/deals/:dealId/bind-mcp`
3. `POST /demo/deals/:dealId/fund`
4. `POST /demo/deals/:dealId/run-random-demo`

The last step records a random-number delivery and, by default, releases the funded amount minus fee.

Automated quick verify from the repo root:

```bash
pnpm deal-demo:settlement:dev
pnpm deal-demo:mcp:dev
pnpm deal-demo:verify
```

The verify script checks:
- final status is `Released`
- funded amount equals the requested amount
- released amount and fee match the demo pricing split
- MCP result and settlement delivery hash agree

## Developer Ownership

- Protocol Maintainers own this package.
- Agent Developers consume this package through MCP API and should not modify internal settlement logic by default.
