# x402 Base Mainnet Escrow Smoke Plan

Status: Base mainnet funding boundary passed; production integration pending.

This is a historical interoperability record. It proves CDP x402 `exact`
accepted a contract `payTo` and transferred Base USDC into a Vault. It does not
prove or prescribe the target user flow, which uses one bounded Safe policy,
AgentPay Wallet automatic commitments, the native AgentPay x402 binding, and
Safe Module redemption. Do not ask production users to repeat this EOA signing
flow.

Use this only for a tiny real-money smoke test on Base mainnet. The goal is to
prove x402 `exact` can settle Base USDC into an order-specific escrow contract
address. Do not switch production purchase traffic to this rail until the smoke
and contract tests pass.

## Network

```text
Network: Base mainnet
Chain ID: 8453
Gas token: ETH on Base
Settlement asset: USDC
Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Explorer: https://basescan.org
```

## Amount

Use the smallest practical amount first:

```text
USDC amount: 0.001 USDC
Atomic amount: 1000
```

Do not use a normal production price for the first smoke. The test is checking
facilitator and escrow compatibility, not revenue.

## Completed Base Mainnet Smoke

An ephemeral Factory and order Vault were deployed for a real Base mainnet
smoke. The identifying addresses and transaction hashes are intentionally not
published in this open-source document.

```text
Network: Base mainnet (eip155:8453)
Asset: Base USDC
Amount: 1000 atomic Base USDC (0.001 USDC)
```

Evidence:

- CDP `/verify` accepted the real `OrderEscrowVault` as x402 `payTo`.
- CDP `/settle` returned a successful Base transaction.
- The Base USDC `Transfer` event transferred `1000` from the buyer into the
  Vault.
- `activate()` succeeded and changed Vault state from `Created` to `Funded`.

The settlement authority subsequently called `refund(1000)`, returning the
full smoke balance and moving the Vault to `Refunded`. The refund transaction
hash is intentionally omitted with the other smoke identifiers.

Do not call `/settle` again for that terminal order or reuse its Vault address.
A release transaction was not used to expand the smoke; local Foundry tests
cover release and timeout-refund transitions.

One operational observation: immediately after the settlement receipt, a
public Base RPC briefly returned a stale `balanceOf(Vault) = 0`. Production
workers must verify the USDC `Transfer` log and retry balance reads rather than
trusting a single immediate RPC balance read.

## Initial Compatibility Precheck

CDP Facilitator verify-only compatibility is confirmed on Base mainnet for a
contract `payTo`:

```text
facilitator: https://api.cdp.coinbase.com/platform/v2/x402
scheme: exact
network: eip155:8453
asset: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
amount: 1000
payTo: 0x4200000000000000000000000000000000000006
result: isValid = true
```

This early check proved CDP does not reject contract recipients during
`/verify`. The completed smoke above subsequently proved `/settle` into an
AgentPay Vault.

## Wallets

Use separate roles, even if they are controlled by the same operator for the
first smoke:

```text
buyer: pays x402 exact and receives refunds
seller: receives released seller amount
settlementAuthority: calls activate/release/refund
feeRecipient: receives AgentPay fee
deployer: deploys Factory/Vault contracts and pays gas
```

Never put private keys in the repository. Use a local shell environment,
hardware wallet, Foundry keystore, or a root-owned runtime key file.

## Preflight

Before spending real funds, confirm:

1. `buyer` has a tiny Base USDC balance.
2. `buyer` has enough Base ETH if the x402 client requires a direct transaction.
3. `deployer` has Base ETH for contract deployment.
4. `settlementAuthority` has Base ETH for `activate`, `submitDelivery`,
   `release`, and `refund`.
5. The selected facilitator supports Base mainnet and USDC.
6. The facilitator can be configured for `network = eip155:8453`.

The public x402 Foundation facilitator at `https://x402.org/facilitator` is
useful for no-key testnet checks, but its `/supported` response currently does
not include Base mainnet `eip155:8453`. Base mainnet smoke tests need a
facilitator that explicitly supports `x402Version = 2`, `scheme = exact`, and
`network = eip155:8453`, such as an authenticated CDP Facilitator account or an
AgentPay-operated facilitator.

## Verify-Only Contract `payTo` Precheck

Do this before deploying AgentPay escrow contracts.

Goal:

```text
Prove the target facilitator does not reject contract addresses as payTo during
/verify.
```

This precheck does not prove full settlement into AgentPay Vault. It only
answers the first gate:

```text
Will the facilitator accept a signed x402 exact payload whose payTo has code?
```

Use any existing Base mainnet contract address as `payTo`, but do not call
`/settle` for this precheck. If `/settle` is called accidentally, USDC may be
sent to a contract that cannot return it.

Recommended test values:

```text
network: eip155:8453
asset: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
amount: 1000
payTo: <known Base contract address>
```

`amount = 1000` means `0.001 USDC`. CDP may reject lower values with
`amount_too_low`.

Expected result:

- `/verify` succeeds or fails for reasons unrelated to `payTo` being a
  contract, such as insufficient balance, nonce, signature, or facilitator auth.
- If `/verify` returns an error like `payTo must be EOA`, `recipient must not be
  contract`, or equivalent, the x402 escrow route is blocked for that
  facilitator.

After this passes, deploy AgentPay `AgentPayEscrowFactory`, create one real
Vault, and run the tiny `/settle` smoke with `payTo = <vaultAddress>`.

### Verify-Only Script

The repository includes a helper:

```text
protocol/scripts/x402-verify-contract-payto.mjs
```

It creates a signed x402 `exact` payload and calls facilitator `/verify` only.
It never calls `/settle`.

Run it from the protocol repository root:

```bash
export X402_FACILITATOR_URL=https://your-facilitator.example
export X402_BUYER_PRIVATE_KEY=0x...
export X402_PAY_TO=0x4200000000000000000000000000000000000006
export X402_AMOUNT=1000
export X402_NETWORK=eip155:8453
export X402_ASSET=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
export RPC_URL=https://your-base-rpc.example

pnpm x402:verify-contract-payto
```

If your facilitator requires bearer auth:

```bash
export X402_FACILITATOR_AUTH_TOKEN=...
```

Or use the wrapper that reads the buyer private key from a hidden prompt and
defaults to Base public RPC:

```bash
scripts/run-x402-contract-payto-precheck.sh
```

For Base mainnet with CDP Facilitator, export the CDP Secret API Key credentials
in your shell first:

```bash
export CDP_API_KEY_ID="your-cdp-api-key-id"
export CDP_API_KEY_SECRET="your-cdp-api-key-secret"

scripts/run-x402-contract-payto-precheck.sh
```

Do not write CDP credentials or buyer private keys into repository files. Keep
them in the active shell, a local secret manager, or root-owned runtime config.

The wrapper checks facilitator `/supported` before reading the private key. If
the selected facilitator does not support the configured network, it exits
without signing a payment payload.

Example `X402_PAY_TO` above is a Base predeploy contract address. You may use
another known Base contract address. Keep `X402_AMOUNT=1000` for the precheck.

Interpretation:

- `isValid: true`: the facilitator accepts the signed payload and does not
  reject contract `payTo` in `/verify`.
- `isValid: false` with balance/authorization/nonce/signature wording: the
  facilitator reached payment validation; contract `payTo` is probably not the
  blocker.
- HTTP or invalid response with recipient/payTo/EOA/contract wording: treat as
  facilitator incompatibility until proven otherwise.

## Foundry Test Through Docker

This host may not be able to run native Foundry if the system glibc is too old.
Use the official Foundry Docker image instead:

```text
ghcr.io/foundry-rs/foundry:latest
```

From the `protocol` repository root:

```bash
sudo docker run --rm \
  -e HOME=/tmp \
  -v "$PWD/contracts:/workspace" \
  -w /workspace \
  --entrypoint forge \
  ghcr.io/foundry-rs/foundry:latest \
  test --match-contract AgentPayEscrowFactoryTest -vvv \
  --out /tmp/foundry-out \
  --cache-path /tmp/foundry-cache
```

This command only runs local contract tests. It does not deploy contracts or
send transactions.

## Contract Deployment and Vault Creation

The repository supplies a local MetaMask page generator. It embeds the
compiled Factory bytecode and ABI, but never a private key:

```bash
export CHAIN_ID=8453
export RPC_URL=https://mainnet.base.org
pnpm x402:escrow:smoke-page
```

Open the resulting file in a browser with MetaMask:

```text
deployments/x402-escrow-smoke.chain-8453.html
```

The page performs these separate user-confirmed transactions:

```text
1. deploy AgentPayEscrowFactory (which deploys its Vault implementation)
2. create one deterministic OrderEscrowVault
```

For the first smoke, create one Vault with:

```text
orderId: bytes32 test id
termsHash: hash of the smoke terms
buyer: buyer address
seller: seller address
token: Base USDC
settlementAuthority: settlement authority address
feeRecipient: fee recipient address
amount: 1000
maxFeeAmount: 0 or a tiny value
expiresAt: now + short window
refundAvailableAt: now + short timeout
```

Record:

```text
factoryAddress
vaultAddress
orderId
termsHash
buyer
seller
settlementAuthority
amount
```

Copy the JSON displayed by the page and record it locally:

```bash
export X402_ESCROW_SMOKE_RECORD='{"chainId":"8453", ...}'
pnpm x402:escrow:record
```

This creates `deployments/x402-escrow-smoke.chain-8453.json`. The deployment
record contains no private keys or CDP credentials. Use its `vaultAddress` as
`X402_PAY_TO` for the next CDP `/verify` and `/settle` smoke steps.

### CDP Verify and Settle

First run the existing no-cost verification against the real Vault:

```bash
export X402_PAY_TO=0x... # vaultAddress from x402-escrow-smoke.chain-8453.json
scripts/run-x402-contract-payto-precheck.sh
```

Then run the settlement helper. It validates the recorded Base chain, Base
USDC token, buyer address, Vault address, and `1000` amount before it calls
CDP. Its first invocation remains verify-only unless the explicit confirmation
value is set:

```bash
export CDP_API_KEY_ID="your-cdp-api-key-id"
export CDP_API_KEY_SECRET="your-cdp-api-key-secret"
export X402_BUYER_PRIVATE_KEY=0x...

pnpm x402:escrow:settle-smoke

export X402_CONFIRM_SETTLE=I_UNDERSTAND_THIS_SETTLES_1000_USDC
pnpm x402:escrow:settle-smoke
```

The second command sends exactly `1000` atomic USDC (`0.001 USDC`) to the
recorded Vault. It writes the facilitator transaction response, transaction
receipt status, and observed Vault USDC balance to
`deployments/x402-escrow-settle-smoke.chain-8453.json`.

### Activate the Vault

After the settlement record reports a Vault balance of `1000`, regenerate the
MetaMask smoke page and open it locally. In **Activate Funded Vault**, paste
the Vault address, click **Check Vault status**, then use the
`settlementAuthority` wallet to click **Activate Vault**. A successful call
changes Vault state from `Created` to `Funded`; it does not transfer tokens.

### Refund Without Release

Refund is not automatic. At `refundAvailableAt`, any account may call
`refundAfterTimeout()`, but a transaction is still required. Before then, the
fixed `settlementAuthority` may call `refund(1000)` while the Vault is Funded
or Delivered. The MetaMask smoke page provides **Refund Funded Vault**, which
only calls `refund(1000)` and therefore returns the full smoke balance to the
immutable buyer without testing the seller release path.

### Complete the Release Path

For this smoke order, use the same MetaMask page to generate a synthetic
`outputHash`, call `submitDelivery(outputHash, 1)`, then call
`release(1000, 0)`. The tool fixes the release values to the smoke order's full
amount and zero fee. The contract pays the immutable seller and completes the
Vault state transition to `Released`; because the smoke buyer and seller are
the same test wallet, the `0.001 USDC` returns to that wallet.

## x402 Payment Required

Generate a Payment Required response with:

```json
{
  "scheme": "exact",
  "network": "eip155:8453",
  "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount": "1000",
  "payTo": "<vaultAddress>"
}
```

Include AgentPay extension metadata:

```json
{
  "agentpay-order": {
    "version": "1",
    "rail": "x402_exact_escrow",
    "orderId": "<orderId>",
    "vault": "<vaultAddress>",
    "buyer": "<buyer>",
    "seller": "<seller>",
    "termsHash": "<termsHash>"
  },
  "payment-identifier": {
    "id": "<stable smoke payment id>"
  }
}
```

## Verification Sequence

1. Call facilitator `/verify`.
2. Confirm verification accepts `payTo = vaultAddress`.
3. Call facilitator `/settle`.
4. Record returned `txHash`.
5. Wait for the Base transaction receipt.
6. Confirm receipt success.
7. Confirm Base USDC `Transfer` event sends `amount` to `vaultAddress`.
8. Confirm `USDC.balanceOf(vaultAddress) >= amount`.
9. Call `OrderEscrowVault.activate()`.
10. Confirm Vault state is `Funded`.
11. Call `submitDelivery(outputHash, usageUnits)`.
12. Call `release(sellerAmount, feeAmount)`.
13. Confirm seller/feeRecipient/buyer balances reflect release and residual
    refund.

## Pass Criteria

The smoke passes only if:

- facilitator accepts contract `payTo`;
- settle produces a successful Base transaction;
- Base USDC lands in the Vault;
- Vault activates from on-chain balance;
- release pays only fixed seller/feeRecipient and refunds remainder to buyer;
- duplicate payment identifier retry does not create a second logical order.

## Stop Conditions

Stop immediately if:

- facilitator rejects contract `payTo`;
- facilitator does not return enough data to verify chain/network/asset/amount;
- settlement tx sends USDC anywhere other than the Vault;
- Vault cannot activate after a successful settle;
- release/refund behavior differs from contract expectations.
