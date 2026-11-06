#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { x402Facilitator } from "@x402/core/facilitator";

const NETWORK = "eip155:8453";
const STANDARD_SCHEME = "batch-settlement";
const AGENTPAY_METHOD = "agentpay-safe-module";

const corePackage = JSON.parse(
  readFileSync(new URL("../node_modules/@x402/core/package.json", import.meta.url), "utf8")
);

function createProbeHandler(name, scheme, assetTransferMethod, payer) {
  const calls = [];
  return {
    scheme,
    caipFamily: "eip155:*",
    calls,
    getExtra() {
      return { assetTransferMethod };
    },
    getSigners() {
      return [];
    },
    async verify(_payload, requirements) {
      calls.push({ operation: "verify", requestedMethod: requirements.extra?.assetTransferMethod });
      return { isValid: true, payer, extra: { handler: name } };
    },
    async settle(_payload, requirements) {
      calls.push({ operation: "settle", requestedMethod: requirements.extra?.assetTransferMethod });
      return {
        success: true,
        transaction: "",
        network: NETWORK,
        payer,
        extra: { handler: name, commitmentId: `probe-${name}` }
      };
    }
  };
}

function payment(method, scheme = STANDARD_SCHEME) {
  const requirements = {
    scheme,
    network: NETWORK,
    amount: "1",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0x1111111111111111111111111111111111111111",
    maxTimeoutSeconds: 60,
    extra: { assetTransferMethod: method }
  };
  return {
    payload: { x402Version: 2, accepted: requirements, payload: { type: "probe" } },
    requirements
  };
}

async function runSameKeyScenario(registrationOrder, requestedMethod) {
  const handlers = {
    standard: createProbeHandler(
      "standard",
      STANDARD_SCHEME,
      "eip3009",
      "0x0000000000000000000000000000000000000001"
    ),
    agentpay: createProbeHandler(
      "agentpay",
      STANDARD_SCHEME,
      AGENTPAY_METHOD,
      "0x0000000000000000000000000000000000000002"
    )
  };
  const facilitator = new x402Facilitator();
  for (const name of registrationOrder) {
    facilitator.register(NETWORK, handlers[name]);
  }

  const request = payment(requestedMethod);
  const verify = await facilitator.verify(request.payload, request.requirements);
  const settle = await facilitator.settle(request.payload, request.requirements);

  return {
    registrationOrder,
    requestedMethod,
    supported: facilitator.getSupported().kinds,
    selectedVerifyHandler: verify.extra?.handler,
    selectedSettleHandler: settle.extra?.handler,
    calls: {
      standard: handlers.standard.calls,
      agentpay: handlers.agentpay.calls
    }
  };
}

async function runDistinctSchemeScenario() {
  const standard = createProbeHandler(
    "standard",
    STANDARD_SCHEME,
    "eip3009",
    "0x0000000000000000000000000000000000000001"
  );
  const agentpay = createProbeHandler(
    "agentpay",
    "agentpay",
    AGENTPAY_METHOD,
    "0x0000000000000000000000000000000000000002"
  );
  const facilitator = new x402Facilitator()
    .register(NETWORK, standard)
    .register(NETWORK, agentpay);
  const request = payment(AGENTPAY_METHOD, "agentpay");
  const verify = await facilitator.verify(request.payload, request.requirements);
  const settle = await facilitator.settle(request.payload, request.requirements);

  return {
    supported: facilitator.getSupported().kinds,
    selectedVerifyHandler: verify.extra?.handler,
    selectedSettleHandler: settle.extra?.handler,
    calls: { standard: standard.calls, agentpay: agentpay.calls }
  };
}

const standardFirst = await runSameKeyScenario(
  ["standard", "agentpay"],
  AGENTPAY_METHOD
);
const agentpayFirst = await runSameKeyScenario(
  ["agentpay", "standard"],
  "eip3009"
);
const distinctScheme = await runDistinctSchemeScenario();

assert.equal(standardFirst.supported.length, 2);
assert.equal(standardFirst.selectedVerifyHandler, "standard");
assert.equal(standardFirst.selectedSettleHandler, "standard");
assert.equal(agentpayFirst.selectedVerifyHandler, "agentpay");
assert.equal(agentpayFirst.selectedSettleHandler, "agentpay");
assert.equal(distinctScheme.selectedVerifyHandler, "agentpay");
assert.equal(distinctScheme.selectedSettleHandler, "agentpay");
assert.equal(distinctScheme.calls.standard.length, 0);

console.log(JSON.stringify({
  ok: true,
  x402CoreVersion: corePackage.version,
  conclusion: {
    sameSchemeNetworkDispatchUsesRegistrationOrder: true,
    supportedExtraIsNotADispatchKey: true,
    distinctSchemeDispatchIsIsolated: true
  },
  scenarios: { standardFirst, agentpayFirst, distinctScheme }
}, null, 2));
