// Optional adapter coverage stays separate from native escrow installation.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {CdpX402Facilitator} from "@agentpay/x402-escrow/cdp";
const fixture = name => JSON.parse(readFileSync(new URL(`../fixtures/x402-escrow-v1/${name}.json`, import.meta.resolve("@c4roa0/agentpay-protocol"))));
const terms = fixture("order-terms"), records = fixture("records");

test("CDP adapter normalizes provider-specific responses", async () => {
  const adapter = CdpX402Facilitator.fromClient({
    async getSupported() { return { kinds: [] }; },
    async verify() { return { isValid: true, payer: terms.buyer }; },
    async settle() { return { success: true, payer: terms.buyer, transaction: records.evidence.transactionHash, network: "eip155:8453" }; },
  });
  assert.deepEqual(await adapter.verify({}, records.paymentRequired), { isValid: true, payer: terms.buyer, invalidReason: undefined });
  assert.equal((await adapter.settle({}, records.paymentRequired)).transactionHash, records.evidence.transactionHash);
});

