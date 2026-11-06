# Production-Candidate Base-Fork Record

Date: 2026-09-16

This test forks Base state locally. It does not broadcast a Base transaction or
use live funds.

`AgentPayProductionBaseForkTest` uses the canonical Safe v1.4.1 singleton and
ProxyFactory already deployed on Base, the official Base USDC proxy and token
logic, and the current production-candidate SkillRegistry, SpendingModule,
EscrowFactory, Vault, and SettlementAuthorityController sources.

Command:

```bash
BASE_RPC_URL=https://mainnet.base.org forge test \
  --match-contract AgentPayProductionBaseForkTest -vv
```

Observed result: 2 passed, 0 failed. The suite proves automatic funding without
per-order Safe owner transactions, activation, release, Authority refund,
permissionless timeout refund, exact USDC balance reconciliation, Controller
pause, administrator-Safe executor rotation, removed-executor rejection, and
unchanged existing Vault authority.

The matching Settlement formal-runtime run then used a loopback Anvil Base
fork, canonical Safe contracts, official Base USDC, protected MySQL, and the
credential-file entrypoint. Gateway, Wallet/provider service authorization,
Controller release, and the `665000 / 35000 / 300000` terminal balance split
passed on chain ID 8453. Subsequent runtime-fork runs closed both refund exits:
provider rejection recovered one Controller refund across crashes after
prepared persistence and after broadcast, while provider silence recovered one
permissionless Relayer timeout refund across the same boundaries. Each path
used one job, three attempts, one prepared transaction, and returned `1000000`
official Base USDC to the buyer with zero seller or fee increase.
