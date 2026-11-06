# @agentpay/x402-escrow

Provider-neutral x402 escrow construction and verification for AgentPay.

The core entry point exports Payment Required construction, requirement and
chain-evidence validation, immutable Vault-term checks, bounded balance retry,
and funding idempotency rules. It has no dependency on CDP response types or
credentials.

`CdpX402Facilitator` is the verified Base x402 `exact` compatibility adapter,
not the production autonomous-authorization architecture. The adapter owns CDP
SDK calls and converts responses to the public normalized interface.
`MockX402Facilitator` supports local tests. The target Wallet/Safe Module path
uses a native AgentPay x402 mechanism behind versioned interfaces with scheme `agentpay` and binding `agentpay.safe-module.v1`. Registration
under standard EVM `batch-settlement` is outside scope. Hosted CDP is not
assumed to execute it.

The package exports the canonical `agentpay.safe-module.v1` EIP-712 commitment
builder, digest, and verifier. Its public fixture fixes
`paymentFlow = escrow`; commitment acceptance is not settlement success, and
settlement success requires independently confirmed transaction evidence.

Facilitator success is never sufficient funding proof. Callers must obtain the
transaction receipt and the configured token Transfer evidence from an RPC, read immutable
Vault terms, retry `balanceOf(vault)`, and pass the normalized values to the
core validators before activation.

`FundingIdempotencyRegistry` defines and tests replay semantics as an in-memory
reference. Production settlement must enforce the same uniqueness constraints
transactionally in durable storage; it must not use process memory as the
system of record.
