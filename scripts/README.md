# Scripts

## Current verification entry points

| Entry | Purpose |
| --- | --- |
| `test-package-consumer.mjs` | Pack libraries and verify an independent temporary consumer |
| `test-native-lifecycle.mjs` | Fresh local Anvil: bounded funding, replay, release/refund and balances |
| `test/controller-artifact.test.mjs` | Public Controller ABI matches the compiled contract |
| `fixtures/package-consumer.mjs` | Consumer assertions for the package runner |

Use `pnpm test:packages` and `pnpm test:chain` as described in
[Usage](../doc/usage.md). The native runner uses disposable test keys and its own
loopback Anvil. These commands do not deploy production services.

## Historical tools

The remaining sections describe retained DealManager and direct-funding
experiments. They are not current onboarding or release procedures. Some commands
can send real transactions; their presence is not authorization to run them.

## Legacy Compatibility Path

The following commands exercise the legacy regression rail and remain for historical investigation. Do not use them for new integrations:

- `pnpm deal-demo:settlement:dev`
- `pnpm deal-demo:mcp:dev`
- `pnpm deal-demo:verify`
- `pnpm real-random-deal:prepare`
- `pnpm real-random-deal:settle`

Recovery-only command for partial runs where payout may already be done:

- `pnpm real-random-deal:settle:release-only`

Notes:

- release-only mode still calls MCP `/run` and returns `randomNumber/outputHash`
- release-only mode skips token transfer and only completes on-chain release/accounting
- do not use release-only mode for fresh deals

## Escrow Interoperability Evidence

The `x402-*` scripts prove contract `payTo`, direct EOA `exact` funding,
activation, and smoke cleanup. They do not implement Wallet, Registry qualification,
Safe Module batch redemption, or Authority Controller finalization. Production
users must not be directed through these MetaMask/private-key smoke steps.

## Main Files

- `build-metamask-deploy-page.mjs`: generate a local MetaMask deployment page for `DealManager`
- `prepare-real-random-deal.mjs`: create a production-style deal on-chain and immediately mark it ready
- `settle-real-random-deal.mjs`: pull user funds, mark funded, call MCP, pay MCP, and release the deal
- `prepare-allowance-pull.mjs`: discover the Safe Allowance Module and write an allowance execution bundle
- `execute-allowance-pull.mjs`: sign the raw allowance transfer hash with the settlement executor key and execute `executeAllowanceTransfer(...)`
- `verify-deal-demo.mjs`: verify the local minimal deal-based reference
- `verify-safe-dealmanager.sh`: run the DealManager Safe compatibility contract test
- `record-dealmanager-deployment.mjs`: record a DealManager deployment address
- `x402-verify-contract-payto.mjs`: create a signed x402 `exact` payment payload
  and call facilitator `/verify` only, to precheck whether contract `payTo` is
  accepted before any escrow deployment or settlement.
- `run-x402-contract-payto-precheck.sh`: wrapper for the x402 contract `payTo`
  precheck. It reads `X402_BUYER_PRIVATE_KEY` from a hidden prompt and defaults
  to Base mainnet, Base USDC, `0.001 USDC`, and `https://mainnet.base.org`. When
  `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` are present, it uses the CDP
  Facilitator at `https://api.cdp.coinbase.com/platform/v2/x402`; otherwise it
  uses the public x402 facilitator.
- `cdp-supported-probe.mjs` and `run-cdp-supported-probe.sh`: authenticated,
  read-only CDP facilitator capability inventory. The wrapper reads the
  root-owned deployment config and credential, calls only `GET /supported`,
  and prints public scheme, network, extension, and signer metadata. It does
  not create a payer, sign or verify a payload, settle a payment, or move funds.
- `cdp-agentpay-binding-verify-probe.mjs` and its shell wrapper: submit one
  unsigned, non-paying AgentPay-shaped draft to CDP `/verify`. The probe first
  discovers CDP's current Base receiver authorizer, never unlocks Wallet or
  creates a payer signature, and has no settlement call.
- `x402-mechanism-dispatch-probe.mjs`: register two in-memory handlers for the
  same x402 v2 `batch-settlement + eip155:8453` pair with different
  `extra.assetTransferMethod` values. It proves whether the pinned x402 core
  routes by that discriminator or by registration order, then verifies a
  separate `agentpay` scheme routes independently. It uses no RPC,
  credential, signer, HTTP request, or funds.
- `build-x402-escrow-smoke-page.mjs`: generates a local MetaMask page that
  deploys `AgentPayEscrowFactory` and creates one immutable smoke Vault.
- `record-x402-escrow-smoke.mjs`: validates and records the non-secret smoke
  deployment data copied from that page.
- `x402-settle-escrow-smoke.mjs`: verifies and, only after an explicit
  confirmation value, settles the recorded `1000`-atomic-USDC smoke payment
  into its recorded Vault.

Run the mechanism-dispatch probe from the Protocol repository:

```bash
pnpm x402:mechanism-dispatch:probe
```

## x402 Escrow Smoke Deployment

Generate the MetaMask page for Base mainnet from the protocol repository root:

```bash
export CHAIN_ID=8453
export RPC_URL=https://mainnet.base.org
pnpm x402:escrow:smoke-page
```

Open `deployments/x402-escrow-smoke.chain-8453.html` locally in a browser with
MetaMask. Connect the Base wallet with a small Base ETH balance, deploy the
Factory, then enter the real buyer, seller, settlement authority, and fee
recipient addresses before creating the `1000`-atomic-USDC Vault. The page
shows a non-secret JSON record after the transaction is mined.

Record it without adding keys to the repository:

```bash
export X402_ESCROW_SMOKE_RECORD='{"chainId":"8453", ...}'
pnpm x402:escrow:record
```

The record is written to `deployments/x402-escrow-smoke.chain-8453.json`.

After the Vault has been funded and activated, regenerate the same MetaMask
page to complete the smoke lifecycle. In **Deliver and Release Smoke Funds**,
paste the funded Vault address, generate the synthetic delivery hash, submit
it, then release the fixed `1000` amount with fee `0`. The page requires
MetaMask confirmation for both transactions and refuses other release values.

The page also provides **Refund Funded Vault** for smoke cleanup. Refund is
never automatic: the settlement authority may call `refund(1000)` immediately,
or anyone may submit the contract's timeout refund transaction after
`refundAvailableAt`.

Run the CDP `/verify` gate against the newly created Vault without spending:

```bash
export X402_PAY_TO=0x... # vaultAddress from the smoke record
scripts/run-x402-contract-payto-precheck.sh
```

After that succeeds, the settle smoke script refuses to send USDC until the
confirmation value is provided. It rejects a buyer key, token, amount, chain,
or recipient that does not match the recorded smoke Vault:

```bash
export CDP_API_KEY_ID="your-cdp-api-key-id"
export CDP_API_KEY_SECRET="your-cdp-api-key-secret"
export X402_BUYER_PRIVATE_KEY=0x...

# First run: /verify only, and prints the exact confirmation required.
pnpm x402:escrow:settle-smoke

# Second run: performs one real 0.001 USDC settlement to the recorded Vault.
export X402_CONFIRM_SETTLE=I_UNDERSTAND_THIS_SETTLES_1000_USDC
pnpm x402:escrow:settle-smoke
```

On successful settlement, it writes
`deployments/x402-escrow-settle-smoke.chain-8453.json`, including the
facilitator transaction and the observed Vault USDC balance.

Regenerate the smoke page after settlement and use its **Activate Funded
Vault** section with the `settlementAuthority` wallet. Paste the recorded Vault
address, check that the state is `1=Created` and balance is `1000`, then click
**Activate Vault**. This is a separate on-chain authority transaction; it
changes state to `2=Funded` but does not move USDC.

## Historical DealManager deployment

For investigation of this legacy deployment helper only:

1. choose a deployment signer path
2. fund it with enough native gas token for the target chain
3. keep deployment credentials out of `.env` files and only export what the command needs in the active shell session

From the protocol repository root:

```bash
export RPC_URL=https://your-rpc.example
export CHAIN_ID=<chain-id>
pnpm contracts:deploy:metamask-page
```

Default output file:

- `deployments/dealmanager.metamask-deploy.chain-<CHAIN_ID>.html`

Notes:

- the deploy page embeds the contract bytecode and ABI directly
- the current payload covers `DealManager`
- execute the payload with your chosen deployment path and record the deployed address yourself

## Run The Real Random Deal Flow

Start the random MCP demo:

```bash
pnpm deal-demo:mcp:dev
```

In another terminal:

```bash
export RPC_URL=https://your-base-rpc
export CHAIN_ID=8453
export DEAL_MANAGER_ADDRESS=0x...
export USER_SAFE_ADDRESS=0x...
export MCP_SAFE_ADDRESS=0x...
export SETTLEMENT_EXECUTOR_ADDRESS=0x...
export SETTLEMENT_EXECUTOR_PRIVATE_KEY=0x...
export SETTLEMENT_TOKEN_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export RANDOM_MCP_DEMO_BASE_URL=http://127.0.0.1:7789

pnpm real-random-deal:prepare
pnpm real-random-deal:settle
```

Notes:

- this path assumes `userSafe` already granted Base USDC spending limit to `SETTLEMENT_EXECUTOR_ADDRESS`
- MCP/provider spending limits are not required by these protocol scripts
- the settlement executor pays gas in Base ETH
- `real-random-deal:prepare` creates the deal and immediately calls `markReadyBySettlement(...)`
- `real-random-deal:settle` performs funding, MCP call, payout, and `releaseToMcp(...)`
- recovery mode: `SETTLE_SKIP_PAYOUT=1` or `pnpm real-random-deal:settle:release-only`

## Validate Allowance Pull Automation

Use this flow when `userSafe` has already granted Base USDC spending limit to the settlement executor EOA.

```bash
export RPC_URL=https://your-base-rpc
export CHAIN_ID=8453
export USER_SAFE_ADDRESS=0x...
export SETTLEMENT_EXECUTOR_ADDRESS=0x...
export TOKEN_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export AMOUNT=1000
pnpm allowance:pull:prepare

export SETTLEMENT_EXECUTOR_PRIVATE_KEY=0x...
node scripts/execute-allowance-pull.mjs
```

Notes:

- `SETTLEMENT_EXECUTOR_ADDRESS` must equal the delegate/beneficiary address configured in the Safe spending limit
- the Safe spending limit here is the User Safe payment authorization
- the settlement executor must hold enough Base ETH for gas
- the execution script signs the raw `transferHash`; do not replace it with `signMessage`

## Developer Ownership

Protocol maintainers own these scripts.
Do not add new supported package-script entrypoints for legacy order/delegation/payment flows.
