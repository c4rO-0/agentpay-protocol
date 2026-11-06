import test from "node:test";
import assert from "node:assert/strict";

const { DealDemoError, DealDemoSettlementService } = (await import(new URL("./service.ts", import.meta.url).href)) as
  typeof import("./service.js");

function createTerms() {
  return {
    userSafe: "0x1111111111111111111111111111111111111111",
    mcpSafe: "0x2222222222222222222222222222222222222222",
    settlement: "0x3333333333333333333333333333333333333333",
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    baseAmount: "0",
    unitPrice: "1000",
    userReportedUnits: "1000",
    gracePeriodEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  };
}

test("deal demo settlement runs the happy path through release", () => {
  const service = new DealDemoSettlementService();
  const deal = service.createDeal(createTerms());

  service.bindUser(deal.dealId, deal.userSafe, "user-signature");
  const ready = service.bindMcp(deal.dealId, deal.mcpSafe, "mcp-signature");
  assert.equal(ready.status, "Ready");

  const funded = service.markFunded(deal.dealId, deal.amount);
  assert.equal(funded.status, "Funded");

  const delivered = service.recordDelivery(deal.dealId, { randomNumber: 42 });
  assert.equal(delivered.delivery?.payload.randomNumber, 42);

  const released = service.releaseToMcp(deal.dealId);
  assert.equal(released.status, "Released");
  assert.equal(released.releasedAmount, deal.amount);
});

test("deal demo settlement requires funding before release", () => {
  const service = new DealDemoSettlementService();
  const deal = service.createDeal(createTerms());
  service.bindUser(deal.dealId, deal.userSafe, "user-signature");
  service.bindMcp(deal.dealId, deal.mcpSafe, "mcp-signature");

  assert.throws(
    () => service.releaseToMcp(deal.dealId),
    (err) => err instanceof DealDemoError && err.code === "CONFLICT"
  );
});

test("deal demo settlement rejects mismatched bind signer", () => {
  const service = new DealDemoSettlementService();
  const deal = service.createDeal(createTerms());

  assert.throws(
    () => service.bindUser(deal.dealId, deal.mcpSafe, "bad-signature"),
    (err) => err instanceof DealDemoError && err.code === "POLICY_VIOLATION"
  );
});
