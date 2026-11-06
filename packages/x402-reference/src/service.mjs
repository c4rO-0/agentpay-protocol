import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient, createWalletClient, getAddress, http, keccak256, stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import {
  agentPayEscrowFactoryAbi, hashEscrowOrderTerms, orderEscrowVaultAbi,
} from "@agentpay/types";
import {
  FundingIdempotencyRegistry, buildPaymentRequired, validatePaymentRequired,
  validateSettlementEvidence, validateVaultTerms, waitForVaultBalance,
} from "@agentpay/x402-escrow";
import { MockX402Facilitator } from "@agentpay/x402-escrow/mock";

const here = dirname(fileURLToPath(import.meta.url));
const protocolRoot = resolve(here, "../../..");
const SETTLEMENT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const BUYER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const SELLER = getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
const FEE_RECIPIENT = getAddress("0x90F79bf6EB2c4f870365E785982E1f101E93b906");
const json = (value) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);

function artifact(name) {
  return JSON.parse(readFileSync(resolve(protocolRoot, `contracts/out/${name}.sol/${name}.json`), "utf8"));
}

async function body(request) {
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export async function createReferenceService(rpcUrl = "http://127.0.0.1:8545") {
  const settlement = privateKeyToAccount(SETTLEMENT_KEY);
  const buyer = privateKeyToAccount(BUYER_KEY);
  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const settlementWallet = createWalletClient({ account: settlement, chain: foundry, transport: http(rpcUrl) });
  const buyerWallet = createWalletClient({ account: buyer, chain: foundry, transport: http(rpcUrl) });
  const factoryArtifact = artifact("AgentPayEscrowFactory");
  const tokenArtifact = artifact("MockERC20");
  const factoryHash = await settlementWallet.deployContract({ abi: factoryArtifact.abi, bytecode: factoryArtifact.bytecode.object });
  const rawFactoryAddress = (await publicClient.waitForTransactionReceipt({ hash: factoryHash })).contractAddress;
  const tokenHash = await settlementWallet.deployContract({ abi: tokenArtifact.abi, bytecode: tokenArtifact.bytecode.object, args: ["USD Coin", "USDC", 6] });
  const rawTokenAddress = (await publicClient.waitForTransactionReceipt({ hash: tokenHash })).contractAddress;
  if (!rawFactoryAddress || !rawTokenAddress) throw new Error("local deployment failed");
  const factoryAddress = getAddress(rawFactoryAddress); const tokenAddress = getAddress(rawTokenAddress);
  await publicClient.waitForTransactionReceipt({ hash: await settlementWallet.writeContract({ address: tokenAddress, abi: tokenArtifact.abi, functionName: "mint", args: [buyer.address, 10_000_000n] }) });

  const profile = { network: "eip155:31337", asset: tokenAddress, tokenName: "USD Coin", tokenVersion: "2" };
  const orders = new Map(); const registry = new FundingIdempotencyRegistry(); let sequence = 0;

  async function createOrder() {
    const orderId = keccak256(stringToHex(`agentpay-local-order-${++sequence}`));
    const now = Math.floor(Date.now() / 1000);
    const terms = {
      protocol: "agentpay.x402.escrow.v1", paymentRail: "x402_exact_escrow", chainId: "31337",
      factoryAddress, orderId, buyer: buyer.address, seller: SELLER, token: tokenAddress,
      settlementAuthority: settlement.address, feeRecipient: FEE_RECIPIENT, amount: "1000",
      maxFeeAmount: "100", expiresAt: String(now + 3600), refundAvailableAt: String(now + 7200),
    };
    const termsHash = hashEscrowOrderTerms(terms);
    const vaultAddress = getAddress(await publicClient.readContract({ address: factoryAddress, abi: agentPayEscrowFactoryAbi, functionName: "predictVaultAddress", args: [orderId] }));
    const init = { orderId, termsHash, buyer: buyer.address, seller: SELLER, token: tokenAddress,
      settlementAuthority: settlement.address, feeRecipient: FEE_RECIPIENT, amount: 1000n,
      maxFeeAmount: 100n, expiresAt: BigInt(terms.expiresAt), refundAvailableAt: BigInt(terms.refundAvailableAt) };
    await publicClient.waitForTransactionReceipt({ hash: await settlementWallet.writeContract({ address: factoryAddress, abi: agentPayEscrowFactoryAbi, functionName: "createVault", args: [init] }) });
    const order = { terms, termsHash, vaultAddress, x402PaymentIdentifier: `local-payment-${sequence}`, state: "Created" };
    orders.set(orderId, order);
    return { orderId, vaultAddress, termsHash, paymentRequired: buildPaymentRequired(order, 300, profile) };
  }

  async function fundOrder(order) {
    const requirements = buildPaymentRequired(order, 300, profile); validatePaymentRequired(requirements, order, profile);
    const transferHash = await buyerWallet.writeContract({ address: tokenAddress, abi: tokenArtifact.abi, functionName: "transfer", args: [order.vaultAddress, 1000n] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: transferHash });
    const facilitator = new MockX402Facilitator({ isValid: true, payer: buyer.address }, { success: true, payer: buyer.address, transactionHash: transferHash, network: profile.network });
    await facilitator.verify({}, requirements); const settled = await facilitator.settle({}, requirements);
    const balance = await waitForVaultBalance(() => publicClient.readContract({ address: tokenAddress, abi: tokenArtifact.abi, functionName: "balanceOf", args: [order.vaultAddress] }), 1000n, { attempts: 3, delayMs: 10 });
    const evidence = { network: profile.network, asset: tokenAddress, transactionHash: transferHash, receiptStatus: receipt.status,
      transfer: { from: buyer.address, to: order.vaultAddress, value: "1000" }, observedVaultBalance: balance.toString() };
    validateSettlementEvidence(evidence, order, profile);
    const chainTerms = await publicClient.readContract({ address: order.vaultAddress, abi: orderEscrowVaultAbi, functionName: "getOrder" });
    const state = Number(await publicClient.readContract({ address: order.vaultAddress, abi: orderEscrowVaultAbi, functionName: "state" }));
    validateVaultTerms({ ...chainTerms, amount: chainTerms.amount.toString(), maxFeeAmount: chainTerms.maxFeeAmount.toString(), expiresAt: chainTerms.expiresAt.toString(), refundAvailableAt: chainTerms.refundAvailableAt.toString(), state }, order);
    registry.claim(order.x402PaymentIdentifier, settled.transactionHash, order.terms.orderId);
    const activationHash = await settlementWallet.writeContract({ address: order.vaultAddress, abi: orderEscrowVaultAbi, functionName: "activate" });
    await publicClient.waitForTransactionReceipt({ hash: activationHash }); order.state = "Funded";
    const ticket = { orderId: order.terms.orderId, vaultAddress: order.vaultAddress, expiresAt: order.terms.expiresAt };
    return { evidence, activationHash, ticket: { ...ticket, signature: await settlement.signMessage({ message: json(ticket) }) } };
  }

  async function finalize(order, mode) {
    if (order.state !== "Funded") throw new Error("order is not Funded");
    if (mode === "refund") {
      const hash = await settlementWallet.writeContract({ address: order.vaultAddress, abi: orderEscrowVaultAbi, functionName: "refund", args: [1000n] });
      await publicClient.waitForTransactionReceipt({ hash }); order.state = "Refunded"; return { state: order.state, transactionHash: hash };
    }
    const outputHash = keccak256(stringToHex(`output-${order.terms.orderId}`));
    const deliveryHash = await settlementWallet.writeContract({ address: order.vaultAddress, abi: orderEscrowVaultAbi, functionName: "submitDelivery", args: [outputHash, 1n] });
    await publicClient.waitForTransactionReceipt({ hash: deliveryHash });
    const releaseHash = await settlementWallet.writeContract({ address: order.vaultAddress, abi: orderEscrowVaultAbi, functionName: "release", args: [900n, 100n] });
    await publicClient.waitForTransactionReceipt({ hash: releaseHash }); order.state = "Released";
    return { state: order.state, outputHash, deliveryHash, transactionHash: releaseHash };
  }

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://local"); let result;
      if (request.method === "POST" && url.pathname === "/orders") result = await createOrder();
      else {
        const match = url.pathname.match(/^\/orders\/(0x[0-9a-f]{64})\/(fund|finalize)$/);
        if (!match || !orders.has(match[1])) { response.writeHead(404); response.end(json({ ok: false, error: "not_found" })); return; }
        const order = orders.get(match[1]); result = match[2] === "fund" ? await fundOrder(order) : await finalize(order, (await body(request)).mode);
      }
      response.writeHead(200, { "content-type": "application/json" }); response.end(json({ ok: true, result }));
    } catch (error) { response.writeHead(400, { "content-type": "application/json" }); response.end(json({ ok: false, error: error.message })); }
  });
  return { server, factoryAddress, tokenAddress };
}
