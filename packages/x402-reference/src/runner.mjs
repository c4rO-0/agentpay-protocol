import assert from "node:assert/strict";
import { createReferenceService } from "./service.mjs";

const { server, factoryAddress, tokenAddress } = await createReferenceService(process.env.RPC_URL);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); const base = `http://127.0.0.1:${address.port}`;
const post = async (path, value) => {
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: value ? JSON.stringify(value) : undefined });
  const payload = await response.json(); if (!payload.ok) throw new Error(payload.error); return payload.result;
};
try {
  const released = await post("/orders"); const fundedRelease = await post(`/orders/${released.orderId}/fund`);
  assert.ok(fundedRelease.ticket.signature); const release = await post(`/orders/${released.orderId}/finalize`, { mode: "release" }); assert.equal(release.state, "Released");
  const refunded = await post("/orders"); await post(`/orders/${refunded.orderId}/fund`);
  const refund = await post(`/orders/${refunded.orderId}/finalize`, { mode: "refund" }); assert.equal(refund.state, "Refunded");
  console.log(JSON.stringify({ ok: true, factoryAddress, tokenAddress, releaseOrder: released.orderId, refundOrder: refunded.orderId, releaseState: release.state, refundState: refund.state }, null, 2));
} finally { await new Promise((resolve) => server.close(resolve)); }
