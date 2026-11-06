import {
  CDP_FACILITATOR_URL,
  createCdpFacilitatorClient,
} from "@coinbase/cdp-sdk/x402";
import type {
  EvmAddress,
  TransactionHash,
  X402PaymentRequired,
} from "@agentpay/types";
import type {
  NormalizedSettlementResult,
  NormalizedVerifyResult,
  X402Facilitator,
} from "./index.js";

export interface CdpClientPort {
  getSupported(): Promise<unknown>;
  verify(payload: never, requirements: never): Promise<Record<string, unknown>>;
  settle(payload: never, requirements: never): Promise<Record<string, unknown>>;
}

export class CdpX402Facilitator implements X402Facilitator {
  readonly provider = "cdp";
  private constructor(private readonly client: CdpClientPort) {}
  static create(baseUrl = CDP_FACILITATOR_URL): CdpX402Facilitator {
    return new CdpX402Facilitator(
      createCdpFacilitatorClient({ baseUrl }) as unknown as CdpClientPort,
    );
  }
  static fromClient(client: CdpClientPort): CdpX402Facilitator {
    return new CdpX402Facilitator(client);
  }
  getSupported(): Promise<unknown> {
    return this.client.getSupported();
  }
  async verify(
    payload: unknown,
    requirements: X402PaymentRequired,
  ): Promise<NormalizedVerifyResult> {
    const result = await this.client.verify(
      payload as never,
      requirements as never,
    );
    return {
      isValid: result.isValid === true,
      payer: result.payer as EvmAddress | undefined,
      invalidReason:
        String(result.invalidReason ?? result.invalidMessage ?? "") ||
        undefined,
    };
  }
  async settle(
    payload: unknown,
    requirements: X402PaymentRequired,
  ): Promise<NormalizedSettlementResult> {
    const result = await this.client.settle(
      payload as never,
      requirements as never,
    );
    return {
      success: result.success === true,
      payer: result.payer as EvmAddress | undefined,
      transactionHash: result.transaction as TransactionHash | undefined,
      network: result.network as string | undefined,
      errorReason:
        String(result.errorReason ?? result.errorMessage ?? "") || undefined,
    };
  }
}
