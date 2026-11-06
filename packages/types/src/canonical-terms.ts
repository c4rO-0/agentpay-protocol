import { getAddress, keccak256, stringToHex } from "viem";

import type { Bytes32, EscrowOrderTerms } from "./x402-escrow.js";

const DECIMAL_PATTERN = /^(0|[1-9][0-9]*)$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function requireMatch(value: string, pattern: RegExp, field: string): void {
  if (!pattern.test(value)) {
    throw new TypeError(`${field} has invalid canonical format`);
  }
}

function requireChecksummedAddress(value: string, field: string): void {
  requireMatch(value, ADDRESS_PATTERN, field);
  if (getAddress(value) !== value) {
    throw new TypeError(`${field} must be a checksummed EVM address`);
  }
}

export function canonicalizeEscrowOrderTerms(terms: EscrowOrderTerms): string {
  requireMatch(terms.chainId, DECIMAL_PATTERN, "chainId");
  requireChecksummedAddress(terms.factoryAddress, "factoryAddress");
  requireMatch(terms.orderId, BYTES32_PATTERN, "orderId");
  if (terms.orderId !== terms.orderId.toLowerCase()) {
    throw new TypeError("orderId must use lowercase bytes32 hex");
  }
  requireChecksummedAddress(terms.buyer, "buyer");
  requireChecksummedAddress(terms.seller, "seller");
  requireChecksummedAddress(terms.token, "token");
  requireChecksummedAddress(terms.settlementAuthority, "settlementAuthority");
  requireChecksummedAddress(terms.feeRecipient, "feeRecipient");
  requireMatch(terms.amount, DECIMAL_PATTERN, "amount");
  requireMatch(terms.maxFeeAmount, DECIMAL_PATTERN, "maxFeeAmount");
  requireMatch(terms.expiresAt, DECIMAL_PATTERN, "expiresAt");
  requireMatch(terms.refundAvailableAt, DECIMAL_PATTERN, "refundAvailableAt");

  if (terms.protocol !== "agentpay.x402.escrow.v1") {
    throw new TypeError("protocol must be agentpay.x402.escrow.v1");
  }
  if (terms.paymentRail !== "x402_exact_escrow") {
    throw new TypeError("paymentRail must be x402_exact_escrow");
  }

  return JSON.stringify({
    protocol: terms.protocol,
    paymentRail: terms.paymentRail,
    chainId: terms.chainId,
    factoryAddress: terms.factoryAddress,
    orderId: terms.orderId,
    buyer: terms.buyer,
    seller: terms.seller,
    token: terms.token,
    settlementAuthority: terms.settlementAuthority,
    feeRecipient: terms.feeRecipient,
    amount: terms.amount,
    maxFeeAmount: terms.maxFeeAmount,
    expiresAt: terms.expiresAt,
    refundAvailableAt: terms.refundAvailableAt,
  });
}

export function hashEscrowOrderTerms(terms: EscrowOrderTerms): Bytes32 {
  return keccak256(stringToHex(canonicalizeEscrowOrderTerms(terms)));
}
