import { createHash } from "node:crypto";
import { getAddress, verifyTypedData } from "viem";

export const SAFE_DELEGATED_SCHEME = "batch-settlement";
export const SAFE_DELEGATED_BINDING = "agentpay-safe-delegation-v1";
export const PAYMENT_TYPE =
  "SafeDelegatedPayment(address safe,address factory,bytes32 orderId,address vault,address token,uint256 amount,bytes32 termsHash,uint256 nonce,uint64 validBefore)";

export const PAYMENT_TYPES = {
  SafeDelegatedPayment: [
    { name: "safe", type: "address" },
    { name: "factory", type: "address" },
    { name: "orderId", type: "bytes32" },
    { name: "vault", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "termsHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "validBefore", type: "uint64" },
  ],
};

function sameAddress(left, right) {
  return getAddress(left) === getAddress(right);
}

function digestIdentifier(value) {
  return `0x${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(message);
}

function assertAddress(actual, expected, message) {
  if (!sameAddress(actual, expected)) throw new Error(message);
}

export function paymentDomain({ chainId, moduleAddress }) {
  return {
    name: "AgentPay Safe Authorization",
    version: "1",
    chainId,
    verifyingContract: getAddress(moduleAddress),
  };
}

export function buildDelegatedPaymentRequired(order, policy, maxTimeoutSeconds = 300) {
  return {
    scheme: SAFE_DELEGATED_SCHEME,
    network: `eip155:${order.chainId}`,
    asset: getAddress(order.token),
    amount: String(order.amount),
    payTo: getAddress(order.vault),
    maxTimeoutSeconds,
    extra: {
      binding: SAFE_DELEGATED_BINDING,
      module: getAddress(policy.moduleAddress),
      factory: getAddress(policy.factory),
    },
    extensions: {
      "agentpay-order": {
        version: "1",
        orderId: order.orderId,
        vault: getAddress(order.vault),
        buyer: getAddress(order.buyer),
        termsHash: order.termsHash,
      },
      "agentpay-safe-policy": {
        safe: getAddress(policy.safe),
        delegate: getAddress(policy.delegate),
      },
    },
  };
}

export async function createDelegatedPaymentPayload({ order, policy, delegateSigner, nonce, validBefore }) {
  const requirements = buildDelegatedPaymentRequired(order, policy);
  const message = {
    safe: getAddress(policy.safe),
    factory: getAddress(policy.factory),
    orderId: order.orderId,
    vault: getAddress(order.vault),
    token: getAddress(order.token),
    amount: BigInt(order.amount),
    termsHash: order.termsHash,
    nonce: BigInt(nonce),
    validBefore,
  };
  const signature = await delegateSigner.signTypedData({
    domain: paymentDomain({ chainId: order.chainId, moduleAddress: policy.moduleAddress }),
    types: PAYMENT_TYPES,
    primaryType: "SafeDelegatedPayment",
    message,
  });
  return {
    requirements,
    payload: {
      x402Version: 2,
      accepted: requirements,
      payload: {
        type: "commitment",
        binding: SAFE_DELEGATED_BINDING,
        commitment: {
          ...message,
          amount: message.amount.toString(),
          nonce: message.nonce.toString(),
          validBefore: String(message.validBefore),
          signature,
        },
      },
    },
  };
}

export class InMemorySafeDelegatedChain {
  constructor({ now }) {
    this.now = now;
    this.ownerConfirmations = 0;
    this.policies = new Map();
    this.orders = new Map();
    this.transfers = [];
  }

  configurePolicy(policy) {
    this.ownerConfirmations += 1;
    this.policies.set(getAddress(policy.safe), {
      ...policy,
      safe: getAddress(policy.safe),
      delegate: getAddress(policy.delegate),
      token: getAddress(policy.token),
      factory: getAddress(policy.factory),
      moduleAddress: getAddress(policy.moduleAddress),
      maxPerPayment: BigInt(policy.maxPerPayment),
      totalBudget: BigInt(policy.totalBudget),
      spent: 0n,
      nonce: 0n,
      active: true,
    });
  }

  revokePolicy(safe) {
    const policy = this.policies.get(getAddress(safe));
    if (!policy) throw new Error("policy missing");
    policy.active = false;
    policy.nonce += 1n;
    this.ownerConfirmations += 1;
  }

  addOrder(order) {
    this.orders.set(order.orderId, {
      ...order,
      vault: getAddress(order.vault),
      buyer: getAddress(order.buyer),
      token: getAddress(order.token),
      amount: BigInt(order.amount),
      balance: 0n,
      state: "Created",
    });
  }

  async simulate(payload, requirements) {
    const commitment = payload?.payload?.commitment;
    if (payload?.x402Version !== 2) throw new Error("unsupported x402 version");
    if (payload?.payload?.type !== "commitment") throw new Error("commitment required");
    if (payload?.payload?.binding !== SAFE_DELEGATED_BINDING) throw new Error("binding mismatch");
    if (requirements.scheme !== SAFE_DELEGATED_SCHEME) throw new Error("scheme mismatch");
    if (requirements.extra?.binding !== SAFE_DELEGATED_BINDING) throw new Error("binding mismatch");

    const policy = this.policies.get(getAddress(commitment.safe));
    if (!policy?.active) throw new Error("policy inactive");
    if (this.now < policy.validAfter || this.now > policy.validUntil) throw new Error("policy expired");
    if (BigInt(commitment.validBefore) < BigInt(this.now)) throw new Error("commitment expired");
    if (BigInt(commitment.validBefore) > BigInt(policy.validUntil)) throw new Error("commitment exceeds policy");
    if (BigInt(commitment.nonce) !== policy.nonce) throw new Error("bad nonce");

    const order = this.orders.get(commitment.orderId);
    if (!order) throw new Error("unknown order");
    assertAddress(commitment.factory, policy.factory, "factory mismatch");
    assertAddress(commitment.vault, order.vault, "vault mismatch");
    assertAddress(commitment.token, policy.token, "token mismatch");
    assertAddress(order.buyer, policy.safe, "buyer mismatch");
    assertEqual(commitment.termsHash, order.termsHash, "terms mismatch");
    assertEqual(String(commitment.amount), order.amount.toString(), "amount mismatch");
    assertEqual(requirements.network, `eip155:${order.chainId}`, "network mismatch");
    assertAddress(requirements.asset, order.token, "asset mismatch");
    assertAddress(requirements.payTo, order.vault, "payTo mismatch");
    assertEqual(String(requirements.amount), order.amount.toString(), "requirement amount mismatch");
    if (order.state !== "Created") throw new Error("vault not created");
    if (order.amount > policy.maxPerPayment) throw new Error("per-payment limit");
    if (policy.spent + order.amount > policy.totalBudget) throw new Error("budget exceeded");

    const { signature, ...unsignedCommitment } = commitment;
    const validSignature = await verifyTypedData({
      address: policy.delegate,
      domain: paymentDomain({ chainId: order.chainId, moduleAddress: policy.moduleAddress }),
      types: PAYMENT_TYPES,
      primaryType: "SafeDelegatedPayment",
      message: {
        ...unsignedCommitment,
        amount: BigInt(commitment.amount),
        nonce: BigInt(commitment.nonce),
        validBefore: Number(commitment.validBefore),
      },
      signature,
    });
    if (!validSignature) throw new Error("bad delegate signature");

    return { payer: policy.safe, order, policy, commitment };
  }

  async redeem(payload, requirements) {
    const checked = await this.simulate(payload, requirements);
    checked.policy.spent += checked.order.amount;
    checked.policy.nonce += 1n;
    checked.order.balance += checked.order.amount;
    const transactionHash = digestIdentifier({
      orderId: checked.order.orderId,
      nonce: checked.commitment.nonce,
      transferIndex: this.transfers.length,
    });
    this.transfers.push({
      from: checked.policy.safe,
      to: checked.order.vault,
      value: checked.order.amount.toString(),
      transactionHash,
    });
    return { transactionHash, payer: checked.policy.safe };
  }

  activate(orderId) {
    const order = this.orders.get(orderId);
    if (!order || order.state !== "Created" || order.balance < order.amount) {
      throw new Error("vault activation requires funding");
    }
    order.state = "Funded";
  }
}

export class LocalSafeDelegatedFacilitator {
  provider = "agentpay-safe-delegated-spike";

  constructor(chain) {
    this.chain = chain;
    this.commitments = new Map();
    this.redemptions = new Map();
  }

  async verify(payload, requirements) {
    try {
      const result = await this.chain.simulate(payload, requirements);
      return { isValid: true, payer: result.payer };
    } catch (error) {
      return { isValid: false, invalidReason: error.message };
    }
  }

  async settle(payload, requirements) {
    const verified = await this.verify(payload, requirements);
    if (!verified.isValid) return { success: false, errorReason: verified.invalidReason };
    const commitmentId = digestIdentifier(payload.payload.commitment);
    const existing = this.commitments.get(commitmentId);
    if (!existing) this.commitments.set(commitmentId, { payload, requirements });
    return { success: true, payer: verified.payer, commitmentId };
  }

  async redeem(commitmentId) {
    const existing = this.redemptions.get(commitmentId);
    if (existing) return existing;
    const stored = this.commitments.get(commitmentId);
    if (!stored) throw new Error("unknown commitment");
    const redeemed = await this.chain.redeem(stored.payload, stored.requirements);
    const result = { success: true, ...redeemed };
    this.redemptions.set(commitmentId, result);
    return result;
  }
}

export function issueTicket(chain, orderId) {
  const order = chain.orders.get(orderId);
  if (order?.state !== "Funded") throw new Error("ticket requires Funded Vault");
  return { orderId, vault: order.vault };
}
