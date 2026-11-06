# Open Reference Boundary

The open x402 reference demonstrates how the public contracts, types,
verification library, facilitator interface, and ticket gate compose. It is an
integration example, not a production Settlement server.

It is also not the target authorization reference: mock funding replaces
Wallet, Registry qualification, Safe Module commitment redemption, and production
batch-settlement. Direct local Settlement account finalization replaces the
Authority Controller. P4A now includes separate Controller contract and Anvil
evidence without changing this intentionally minimal Factory/Vault reference.

## Executable Flow

```text
create order and Vault
  -> return Payment Required
  -> mock facilitator transfer
  -> verify receipt, Transfer, balance, and Vault terms
  -> activate Vault
  -> issue example signed ticket
  -> submit delivery and release
     or refund a separate funded order
```

Run it with:

```bash
pnpm x402:reference
```

The runner uses Anvil and real Solidity contracts. Its expected terminal
assertions are `releaseState=Released` and `refundState=Refunded`.

## Reference Routes

The local HTTP service exposes:

### `POST /orders`

Creates canonical terms, derives `termsHash`, predicts and creates a Vault, and
returns `orderId`, `vaultAddress`, `termsHash`, and Payment Required.

### `POST /orders/{orderId}/fund`

Transfers mock USDC to the Vault, normalizes mock facilitator output, verifies
funding and Vault terms, activates the Vault, and returns evidence,
`activationHash`, and an example signed ticket.

Ticket issuance fails unless the reference order has reached `Funded`.

### `POST /orders/{orderId}/finalize`

With `{ "mode": "release" }`, submits delivery metadata and calls `release()`.
With `{ "mode": "refund" }`, refunds a separate funded order to its immutable
buyer.

## Real Components

- `AgentPayEscrowFactory` and `OrderEscrowVault` execute on Anvil;
- mock USDC is a real six-decimal ERC-20 contract;
- canonical terms and `termsHash` use `@c4roa0/agentpay-protocol`;
- Payment Required and evidence checks use `@agentpay/x402-escrow`;
- funding, activation, delivery, release, and refund are real EVM transactions;
- the example ticket is signed by the local Settlement development account.

## Deliberate Substitutions

| Reference | Production replacement |
| --- | --- |
| Anvil | Base mainnet RPC clients |
| mock USDC | official Base USDC |
| direct mock funding | Wallet commitment + native AgentPay x402 binding + Safe Module redemption |
| in-process order map | transactional Settlement database |
| in-memory replay registry | durable unique constraints and transaction records |
| public Anvil keys | separated Ticket signer, Authority executor, and relayer backends |
| fixed example pricing | Provider-authored price requirement plus Settlement Quote admission and fee policy |
| direct synchronous calls | jobs, retries, nonce handling, and recovery workers |

## Intentionally Excluded

- production credentials and private keys;
- provider admission, pricing, fraud, compliance, and dispute policy;
- customer records, private requests, and AI output payloads;
- durable queues, accounting ledgers, reconciliation, and operator actions;
- marketplace UX and Agent runtime implementation;
- production readiness or audit claims.

## Compatibility Rule

Production Settlement may replace every operational component in the table
above, but it must preserve canonical terms, public field semantics, funding
verification, immutable Vault checks, ticket-after-funding gate, and on-chain
release/refund constraints.

See [Module Boundaries](./module-boundaries.md) for ownership rules and the
[x402 Local Reference](../../packages/x402-reference/README.md) for Docker commands
and the concrete verification record.
