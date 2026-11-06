# Safe Delegated x402 Spike

This spike tests AgentPay's product authorization invariant without changing
the stable Protocol packages or production contracts.

Verified results and production blockers are recorded in
[`FINDINGS.md`](./FINDINGS.md).

It models one bounded Safe policy, Agent-signed EIP-712 payment commitments,
x402 `batch-settlement` transport, commitment-only settlement, later on-chain
redemption into an order Vault, Vault activation, and ticket gating.

The Solidity half is:

```text
contracts/test/AgentPaySafeAuthorizationSpike.t.sol
contracts/test/AgentPayRealSafeForkSpike.t.sol
```

The Node half is:

```bash
node --test spikes/safe-delegated-x402/safe-delegated.test.mjs
```

The in-memory chain in this directory is not a replacement for the Foundry
tests. Foundry proves the Safe/module/Vault enforcement boundary; this runner
proves the x402 commitment and orchestration boundary around the same payment
fields.

The real-Safe fork test uses the official Safe v1.4.1 `SafeL2` singleton and
`SafeProxyFactory` already deployed on Base. It creates only fork-local state
and does not broadcast a transaction or spend real funds. Run it with:

```bash
BASE_RPC_URL=https://mainnet.base.org forge test \
  --match-contract AgentPayRealSafeForkSpikeTest -vvv
```

No public type, ABI, provider claim, deployment, or production support claim is
created by this spike. Promotion requires a reviewed authorization contract,
real Safe conformance, versioned public types and Schema, provider behavior,
and Base verification.
