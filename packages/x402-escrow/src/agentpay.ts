import {
  AGENTPAY_PAYMENT_FLOW,
  AGENTPAY_SAFE_MODULE_BINDING,
  AGENTPAY_X402_SCHEME,
  AGENTPAY_X402_VERSION,
  type AgentPayCommitment,
  type AgentPayCommitmentAcceptance,
  type AgentPayPaymentPayload,
  type AgentPayPaymentRequirements,
  type AgentPayResultExtension,
  type AgentPayVerifyResponse,
  type Bytes32,
  type EvmAddress,
} from "@agentpay/types";
import {
  getAddress,
  hashTypedData,
  recoverTypedDataAddress,
  type Hex,
} from "viem";

export const AGENTPAY_COMMITMENT_PRIMARY_TYPE = "AgentPayCommitment" as const;
export const AGENTPAY_COMMITMENT_TYPES = {
  AgentPayCommitment: [
    { name: "safe", type: "address" },
    { name: "policyId", type: "bytes32" },
    { name: "factory", type: "address" },
    { name: "orderId", type: "bytes32" },
    { name: "vault", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "termsHash", type: "bytes32" },
    { name: "scopeProofHash", type: "bytes32" },
    { name: "commitmentNonce", type: "bytes32" },
    { name: "validBefore", type: "uint64" },
  ],
} as const;

export interface AgentPayPolicySnapshot {
  active: boolean;
  delegate: EvmAddress;
  safe: EvmAddress;
  policyId: Bytes32;
  module: EvmAddress;
  factory: EvmAddress;
  token: EvmAddress;
  maxPerPayment: `${bigint}`;
  remainingBudget: `${bigint}`;
  validAfter: `${bigint}`;
  validUntil: `${bigint}`;
}

export interface AgentPayVerificationContext {
  now: `${bigint}`;
  policy: AgentPayPolicySnapshot;
  verifyScope?: (
    scopeProofHash: Bytes32,
    commitment: AgentPayCommitment,
  ) => Promise<boolean> | boolean;
}

/** In-memory replay reference. Production acceptance needs atomic durable uniqueness
 * for both commitmentId and orderId; acceptance alone does not prove funding. */
export class AgentPayCommitmentAcceptanceRegistry {
  private readonly commitments = new Map<
    Bytes32,
    AgentPayCommitmentAcceptance
  >();
  private readonly orders = new Map<Bytes32, Bytes32>();

  constructor(
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  accept(verified: AgentPayVerifyResponse): AgentPayCommitmentAcceptance {
    if (!verified.isValid || !verified.extensions?.agentpay)
      throw new Error("cannot accept an invalid AgentPay commitment");
    const { commitmentId, orderId } = verified.extensions.agentpay;
    const existing = this.commitments.get(commitmentId);
    if (existing) return existing;
    const orderCommitment = this.orders.get(orderId);
    if (orderCommitment && orderCommitment !== commitmentId)
      throw new Error("order already has a different accepted commitment");
    const acceptance: AgentPayCommitmentAcceptance = Object.freeze({
      schema: "agentpay.commitment-acceptance.v1",
      accepted: true,
      commitmentId,
      orderId,
      status: "accepted",
      acceptedAt: this.now(),
    });
    this.commitments.set(commitmentId, acceptance);
    this.orders.set(orderId, commitmentId);
    return acceptance;
  }
}

function sameAddress(left: string, right: string): boolean {
  return getAddress(left) === getAddress(right);
}

function assertBytes32(value: string, name: string): asserts value is Bytes32 {
  if (!/^0x[0-9a-f]{64}$/.test(value))
    throw new Error(`${name} must be lowercase bytes32 hex`);
}

function assertPositiveDecimal(value: string, name: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value))
    throw new Error(`${name} must be a positive decimal integer`);
  return BigInt(value);
}

function assertExactKeys(
  value: object,
  expected: readonly string[],
  name: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    throw new Error(
      `${name} fields do not match ${AGENTPAY_SAFE_MODULE_BINDING}`,
    );
  }
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameJsonValue(value, right[index]))
    );
  }
  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  )
    return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        sameJsonValue(leftRecord[key], rightRecord[key]),
    )
  );
}

export function buildAgentPayCommitmentTypedData(
  requirements: AgentPayPaymentRequirements,
  commitment: AgentPayCommitment,
) {
  const chainId = BigInt(requirements.network.slice("eip155:".length));
  return {
    domain: {
      name: "AgentPay Safe Module",
      version: "1",
      chainId,
      verifyingContract: requirements.extra.module,
    },
    types: AGENTPAY_COMMITMENT_TYPES,
    primaryType: AGENTPAY_COMMITMENT_PRIMARY_TYPE,
    message: {
      safe: commitment.safe,
      policyId: commitment.policyId,
      factory: commitment.factory,
      orderId: commitment.orderId,
      vault: commitment.vault,
      token: commitment.token,
      amount: BigInt(commitment.amount),
      termsHash: commitment.termsHash,
      scopeProofHash: commitment.scopeProofHash,
      commitmentNonce: commitment.commitmentNonce,
      validBefore: BigInt(commitment.validBefore),
    },
  } as const;
}

export function hashAgentPayCommitment(
  requirements: AgentPayPaymentRequirements,
  commitment: AgentPayCommitment,
): Bytes32 {
  return hashTypedData(
    buildAgentPayCommitmentTypedData(requirements, commitment),
  );
}

/** Check against the caller-supplied Policy/scope snapshot. This performs no RPC:
 * the caller must obtain trustworthy state and independently verify redemption. */
export async function verifyAgentPayPayment(
  paymentPayload: AgentPayPaymentPayload,
  requirements: AgentPayPaymentRequirements,
  context: AgentPayVerificationContext,
): Promise<AgentPayVerifyResponse> {
  try {
    assertExactKeys(
      paymentPayload,
      paymentPayload.extensions === undefined
        ? ["x402Version", "accepted", "payload"]
        : ["x402Version", "accepted", "payload", "extensions"],
      "paymentPayload",
    );
    assertExactKeys(
      paymentPayload.payload,
      ["commitment", "signature"],
      "paymentPayload.payload",
    );
    assertExactKeys(
      requirements,
      [
        "scheme",
        "network",
        "asset",
        "amount",
        "payTo",
        "maxTimeoutSeconds",
        "extra",
      ],
      "requirements",
    );
    assertExactKeys(
      requirements.extra,
      [
        "binding",
        "paymentFlow",
        "module",
        "safe",
        "policyId",
        "factory",
        "orderId",
        "termsHash",
        "scopeProofHash",
      ],
      "requirements.extra",
    );
    if (paymentPayload.x402Version !== AGENTPAY_X402_VERSION)
      throw new Error("unsupported x402 version");
    if (requirements.scheme !== AGENTPAY_X402_SCHEME)
      throw new Error("unsupported scheme");
    if (!/^eip155:[1-9][0-9]*$/.test(requirements.network))
      throw new Error("unsupported network format");
    if (
      !Number.isSafeInteger(requirements.maxTimeoutSeconds) ||
      requirements.maxTimeoutSeconds <= 0
    )
      throw new Error("invalid max timeout");
    if (requirements.extra.binding !== AGENTPAY_SAFE_MODULE_BINDING)
      throw new Error("unsupported binding");
    if (requirements.extra.paymentFlow !== AGENTPAY_PAYMENT_FLOW)
      throw new Error("unsupported payment flow");
    if (!sameJsonValue(paymentPayload.accepted, requirements))
      throw new Error("accepted requirements mismatch");
    if (!/^0x[0-9a-fA-F]{130}$/.test(paymentPayload.payload.signature))
      throw new Error("invalid commitment signature encoding");

    const commitment = paymentPayload.payload.commitment;
    assertExactKeys(
      commitment,
      [
        "binding",
        "safe",
        "policyId",
        "factory",
        "orderId",
        "vault",
        "token",
        "amount",
        "termsHash",
        "scopeProofHash",
        "commitmentNonce",
        "validBefore",
      ],
      "commitment",
    );
    for (const [name, value] of [
      ["policyId", commitment.policyId],
      ["orderId", commitment.orderId],
      ["termsHash", commitment.termsHash],
      ["scopeProofHash", commitment.scopeProofHash],
      ["commitmentNonce", commitment.commitmentNonce],
    ] as const)
      assertBytes32(value, name);
    if (commitment.binding !== AGENTPAY_SAFE_MODULE_BINDING)
      throw new Error("commitment binding mismatch");

    const policy = context.policy;
    if (!policy.active) throw new Error("policy inactive or revoked");
    const now = assertPositiveDecimal(context.now, "now");
    const amount = assertPositiveDecimal(commitment.amount, "amount");
    const validBefore = assertPositiveDecimal(
      commitment.validBefore,
      "validBefore",
    );
    if (now < BigInt(policy.validAfter) || now > BigInt(policy.validUntil))
      throw new Error("policy outside validity window");
    if (validBefore < now || validBefore > BigInt(policy.validUntil))
      throw new Error("commitment outside validity window");
    if (amount > BigInt(policy.maxPerPayment))
      throw new Error("per-payment limit exceeded");
    if (amount > BigInt(policy.remainingBudget))
      throw new Error("remaining budget exceeded");

    const addressPairs: Array<[string, string, string]> = [
      ["safe", commitment.safe, policy.safe],
      ["safe requirements", commitment.safe, requirements.extra.safe],
      ["module", requirements.extra.module, policy.module],
      ["factory", commitment.factory, policy.factory],
      ["factory requirements", commitment.factory, requirements.extra.factory],
      ["token", commitment.token, policy.token],
      ["asset", commitment.token, requirements.asset],
      ["vault", commitment.vault, requirements.payTo],
    ];
    for (const [name, actual, expected] of addressPairs)
      if (!sameAddress(actual, expected)) throw new Error(`${name} mismatch`);
    const scalarPairs: Array<[string, string, string]> = [
      ["policyId", commitment.policyId, policy.policyId],
      [
        "policyId requirements",
        commitment.policyId,
        requirements.extra.policyId,
      ],
      ["orderId", commitment.orderId, requirements.extra.orderId],
      ["termsHash", commitment.termsHash, requirements.extra.termsHash],
      [
        "scopeProofHash",
        commitment.scopeProofHash,
        requirements.extra.scopeProofHash,
      ],
      ["amount", commitment.amount, requirements.amount],
    ];
    for (const [name, actual, expected] of scalarPairs)
      if (actual !== expected) throw new Error(`${name} mismatch`);
    if (
      context.verifyScope &&
      !(await context.verifyScope(commitment.scopeProofHash, commitment))
    )
      throw new Error("scope proof rejected");

    const typedData = buildAgentPayCommitmentTypedData(
      requirements,
      commitment,
    );
    const signer = await recoverTypedDataAddress({
      ...typedData,
      signature: paymentPayload.payload.signature as Hex,
    });
    if (!sameAddress(signer, policy.delegate))
      throw new Error("delegate signature mismatch");

    const extension: AgentPayResultExtension = {
      binding: AGENTPAY_SAFE_MODULE_BINDING,
      paymentFlow: AGENTPAY_PAYMENT_FLOW,
      commitmentId: hashTypedData(typedData),
      orderId: commitment.orderId,
      vault: commitment.vault,
    };
    return {
      isValid: true,
      payer: commitment.safe,
      extensions: { agentpay: extension },
    };
  } catch (error) {
    return {
      isValid: false,
      invalidReason: "invalid_agentpay_commitment",
      invalidMessage:
        error instanceof Error
          ? error.message
          : "AgentPay commitment verification failed",
    };
  }
}
