import type { X402PaymentRequired } from "@agentpay/types";
import type {
  NormalizedSettlementResult,
  NormalizedVerifyResult,
  X402Facilitator,
} from "./index.js";

export class MockX402Facilitator implements X402Facilitator {
  readonly provider = "mock";
  constructor(
    private readonly verifyResult: NormalizedVerifyResult,
    private readonly settleResult: NormalizedSettlementResult,
  ) {}
  async getSupported(): Promise<unknown> {
    return {
      kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
    };
  }
  async verify(
    _payload: unknown,
    _requirements: X402PaymentRequired,
  ): Promise<NormalizedVerifyResult> {
    return this.verifyResult;
  }
  async settle(
    _payload: unknown,
    _requirements: X402PaymentRequired,
  ): Promise<NormalizedSettlementResult> {
    return this.settleResult;
  }
}
