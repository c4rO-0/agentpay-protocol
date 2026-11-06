export const AGENTPAY_X402_ESCROW_PROTOCOL = "agentpay.x402.escrow.v1" as const;
export const AGENTPAY_X402_ESCROW_SCHEMA_VERSION = "1.0.0" as const;

export type EvmAddress = `0x${string}`;
export type Bytes32 = `0x${string}`;
export type TransactionHash = `0x${string}`;
export type AtomicAmount = `${bigint}`;
export type UnixSeconds = `${bigint}`;
export type IsoDateTime = string;

export type PaymentRail = "safe_allowance_deal_manager" | "x402_exact_escrow";

export const ESCROW_VAULT_STATE = {
  Uninitialized: 0,
  Created: 1,
  Funded: 2,
  Delivered: 3,
  Released: 4,
  Refunded: 5,
  Cancelled: 6,
} as const;

export type EscrowVaultState = keyof typeof ESCROW_VAULT_STATE;
export type EscrowVaultStateValue =
  (typeof ESCROW_VAULT_STATE)[EscrowVaultState];

export interface EscrowOrderTerms {
  protocol: typeof AGENTPAY_X402_ESCROW_PROTOCOL;
  paymentRail: "x402_exact_escrow";
  chainId: `${bigint}`;
  factoryAddress: EvmAddress;
  orderId: Bytes32;
  buyer: EvmAddress;
  seller: EvmAddress;
  token: EvmAddress;
  settlementAuthority: EvmAddress;
  feeRecipient: EvmAddress;
  amount: AtomicAmount;
  maxFeeAmount: AtomicAmount;
  expiresAt: UnixSeconds;
  refundAvailableAt: UnixSeconds;
}

export interface AgentPayOrderExtension {
  version: "1";
  rail: "x402_exact_escrow";
  orderId: Bytes32;
  vault: EvmAddress;
  buyer: EvmAddress;
  seller: EvmAddress;
  termsHash: Bytes32;
}

export interface X402PaymentRequired {
  scheme: "exact";
  network: `eip155:${bigint}`;
  asset: EvmAddress;
  amount: AtomicAmount;
  payTo: EvmAddress;
  maxTimeoutSeconds: number;
  extra: {
    name: "USD Coin";
    version: "2";
  };
  extensions: {
    "agentpay-order": AgentPayOrderExtension;
    "payment-identifier": { id: string };
  };
}

export interface X402SettlementEvidence {
  network: `eip155:${bigint}`;
  asset: EvmAddress;
  transactionHash: TransactionHash;
  receiptStatus: "success" | "reverted";
  transfer: {
    from: EvmAddress;
    to: EvmAddress;
    value: AtomicAmount;
  };
  observedVaultBalance: AtomicAmount;
}

export interface EscrowFundingRecord {
  schema: "agentpay.x402-escrow-funding.v1";
  paymentRail: "x402_exact_escrow";
  orderId: Bytes32;
  termsHash: Bytes32;
  vaultAddress: EvmAddress;
  x402PaymentIdentifier: string;
  evidence: X402SettlementEvidence;
  vaultState: "Funded";
  activatedTxHash: TransactionHash;
  fundingVerifiedAt: IsoDateTime;
}

export interface EscrowReceipt {
  schema: "agentpay.x402-escrow-receipt.v1";
  paymentRail: "x402_exact_escrow";
  orderId: Bytes32;
  vaultAddress: EvmAddress;
  outputHash: Bytes32;
  usageUnits: AtomicAmount;
  deliveryTxHash: TransactionHash;
  createdAt: IsoDateTime;
}

export interface EscrowReleaseRecord {
  schema: "agentpay.x402-escrow-release.v1";
  paymentRail: "x402_exact_escrow";
  orderId: Bytes32;
  vaultAddress: EvmAddress;
  sellerAmount: AtomicAmount;
  feeAmount: AtomicAmount;
  buyerRefundAmount: AtomicAmount;
  releaseTxHash: TransactionHash;
  releasedAt: IsoDateTime;
}

export interface EscrowRefundRecord {
  schema: "agentpay.x402-escrow-refund.v1";
  paymentRail: "x402_exact_escrow";
  orderId: Bytes32;
  vaultAddress: EvmAddress;
  refundAmount: AtomicAmount;
  refundTxHash: TransactionHash;
  reason: "settlement_authority" | "timeout";
  refundedAt: IsoDateTime;
}
