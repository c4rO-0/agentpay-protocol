import type {
  AtomicAmount,
  Bytes32,
  EvmAddress,
  TransactionHash,
  UnixSeconds,
} from "./x402-escrow.js";
import { encodeAbiParameters, keccak256 } from "viem";

export const AGENTPAY_X402_VERSION = 2 as const;
export const AGENTPAY_X402_SCHEME = "agentpay" as const;
export const AGENTPAY_SAFE_MODULE_BINDING = "agentpay.safe-module.v1" as const;
export const AGENTPAY_PAYMENT_FLOW = "escrow" as const;

export interface AgentPayRegistryQualification {
  registry: EvmAddress;
  skillId: Bytes32;
  profileHash: Bytes32;
  seller: EvmAddress;
}

export interface AgentPaySpendingPolicy {
  policyId: Bytes32;
  delegate: EvmAddress;
  token: EvmAddress;
  factory: EvmAddress;
  registry: EvmAddress;
  maxPerPayment: AtomicAmount;
  totalBudget: AtomicAmount;
  validAfter: UnixSeconds;
  validUntil: UnixSeconds;
}

export function hashAgentPayRegistryQualification(
  value: AgentPayRegistryQualification,
): Bytes32 {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "address" },
      ],
      [value.registry, value.skillId, value.profileHash, value.seller],
    ),
  );
}

export interface AgentPayPaymentRequirementsExtra {
  binding: typeof AGENTPAY_SAFE_MODULE_BINDING;
  paymentFlow: typeof AGENTPAY_PAYMENT_FLOW;
  module: EvmAddress;
  safe: EvmAddress;
  policyId: Bytes32;
  factory: EvmAddress;
  orderId: Bytes32;
  termsHash: Bytes32;
  scopeProofHash: Bytes32;
}

export interface AgentPayPaymentRequirements {
  scheme: typeof AGENTPAY_X402_SCHEME;
  network: `eip155:${bigint}`;
  asset: EvmAddress;
  amount: AtomicAmount;
  payTo: EvmAddress;
  maxTimeoutSeconds: number;
  extra: AgentPayPaymentRequirementsExtra;
}

export interface AgentPayCommitment {
  binding: typeof AGENTPAY_SAFE_MODULE_BINDING;
  safe: EvmAddress;
  policyId: Bytes32;
  factory: EvmAddress;
  orderId: Bytes32;
  vault: EvmAddress;
  token: EvmAddress;
  amount: AtomicAmount;
  termsHash: Bytes32;
  scopeProofHash: Bytes32;
  commitmentNonce: Bytes32;
  validBefore: UnixSeconds;
}

export interface AgentPayPaymentPayload {
  x402Version: typeof AGENTPAY_X402_VERSION;
  accepted: AgentPayPaymentRequirements;
  payload: {
    commitment: AgentPayCommitment;
    signature: `0x${string}`;
  };
  extensions?: Record<string, unknown>;
}

export interface AgentPayResultExtension {
  binding: typeof AGENTPAY_SAFE_MODULE_BINDING;
  paymentFlow: typeof AGENTPAY_PAYMENT_FLOW;
  commitmentId: Bytes32;
  orderId: Bytes32;
  vault: EvmAddress;
}

export type AgentPayVerifyResponse =
  | {
      isValid: true;
      payer: EvmAddress;
      extensions: { agentpay: AgentPayResultExtension };
    }
  | {
      isValid: false;
      invalidReason: string;
      invalidMessage?: string;
    };

export interface AgentPayCommitmentAcceptance {
  schema: "agentpay.commitment-acceptance.v1";
  accepted: true;
  commitmentId: Bytes32;
  orderId: Bytes32;
  status: "accepted";
  acceptedAt: string;
}

export type AgentPaySettleResponse =
  | {
      success: true;
      payer: EvmAddress;
      transaction: TransactionHash;
      network: `eip155:${bigint}`;
      amount: AtomicAmount;
      extensions: {
        agentpay: AgentPayResultExtension & { fundingEvidence: "confirmed" };
      };
    }
  | {
      success: false;
      errorReason: string;
      errorMessage?: string;
      payer?: EvmAddress;
      transaction: "";
      network: `eip155:${bigint}`;
    };
