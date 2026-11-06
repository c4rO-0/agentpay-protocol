import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import { keccak256, stringToHex } from "viem";

import {
  agentPaySpendingModuleAbi,
  agentPayEscrowFactoryAbi,
  settlementAuthorityControllerAbi,
  canonicalizeEscrowOrderTerms,
  canonicalizePrivateRequest,
  hashEscrowOrderTerms,
  hashPrivateRequest,
  hashAgentPayRegistryQualification,
  orderEscrowVaultAbi,
  skillRegistryAbi,
} from "../dist/index.js";

const loadJson = (relativePath) => JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
const schema = loadJson("../schemas/agentpay-x402-escrow-v1.schema.json");
const agentPaySchema = loadJson("../schemas/agentpay-safe-module-v1.schema.json");
const controllerDeploymentSchema = loadJson("../schemas/settlement-authority-controller-deployment-v1.schema.json");
const nativeServiceSchema = loadJson("../schemas/agentpay-native-service-v1.schema.json");
const servicePaymentRequiredSchema = loadJson("../schemas/agentpay-service-payment-required-v1.schema.json");
const terms = loadJson("../fixtures/x402-escrow-v1/order-terms.json");
const records = loadJson("../fixtures/x402-escrow-v1/records.json");
const agentPayRecords = loadJson("../fixtures/agentpay-safe-module-v1/records.json");
const controllerRecords = loadJson("../fixtures/settlement-authority-controller-v1/records.json");
const expected = loadJson("../fixtures/x402-escrow-v1/expected.json");
const nativeServiceRecords = loadJson("../fixtures/agentpay-native-service-v1/records.json");
const servicePaymentRequiredRecords = loadJson("../fixtures/agentpay-service-payment-required-v1/records.json");
const ajv = new Ajv2020({ strict: true });
ajv.addSchema(schema);
ajv.addSchema(agentPaySchema);
ajv.addSchema(controllerDeploymentSchema);
ajv.addSchema(nativeServiceSchema);
ajv.addSchema(servicePaymentRequiredSchema);

test("provider service payment requirement fixture is strict and pre-Order", () => {
  const validate = ajv.compile({ $ref: servicePaymentRequiredSchema.$id });
  assert.equal(validate(servicePaymentRequiredRecords.paymentRequired), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...servicePaymentRequiredRecords.paymentRequired, orderId: `0x${"9".repeat(64)}` }), false);
  assert.equal(validate({
    ...servicePaymentRequiredRecords.paymentRequired,
    requirement: { ...servicePaymentRequiredRecords.paymentRequired.requirement, maxUsageUnits: "0" }
  }), false);
});

function validateDefinition(name, value) {
  const validate = ajv.compile({ $ref: `${schema.$id}#/$defs/${name}` });
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}

function validateAgentPayDefinition(name, value) {
  const validate = ajv.compile({ $ref: `${agentPaySchema.$id}#/$defs/${name}` });
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}

test("plain JavaScript consumer validates every public fixture", () => {
  validateDefinition("PaymentRail", "x402_exact_escrow");
  validateDefinition("EscrowVaultState", "Funded");
  validateDefinition("EscrowOrderTerms", terms);
  validateDefinition("X402PaymentRequired", records.paymentRequired);
  validateDefinition("X402SettlementEvidence", records.evidence);
  validateDefinition("EscrowFundingRecord", records.fundingRecord);
  validateDefinition("EscrowReceipt", records.receipt);
  validateDefinition("EscrowReleaseRecord", records.releaseRecord);
  validateDefinition("EscrowRefundRecord", records.refundRecord);
});

test("AgentPay Safe Module fixture fixes the x402 v2 escrow binding", () => {
  validateAgentPayDefinition("AgentPayRegistryQualification", agentPayRecords.qualification);
  validateAgentPayDefinition("AgentPaySpendingPolicy", agentPayRecords.spendingPolicy);
  assert.equal(hashAgentPayRegistryQualification(agentPayRecords.qualification), agentPayRecords.qualificationHash);
  validateAgentPayDefinition("AgentPayPaymentRequirements", agentPayRecords.requirements);
  validateAgentPayDefinition("AgentPayPaymentPayload", agentPayRecords.paymentPayload);
  validateAgentPayDefinition("AgentPayVerifyResponse", agentPayRecords.verifyResponse);
  validateAgentPayDefinition("AgentPayCommitmentAcceptance", agentPayRecords.acceptance);
  validateAgentPayDefinition("AgentPaySettleResponse", agentPayRecords.settleResponse);
  assert.equal(agentPayRecords.paymentPayload.x402Version, 2);
  assert.equal(agentPayRecords.requirements.scheme, "agentpay");
  assert.equal(agentPayRecords.requirements.extra.binding, "agentpay.safe-module.v1");
  assert.equal(agentPayRecords.requirements.extra.paymentFlow, "escrow");
});

test("AgentPay response schema rejects success without funding evidence", () => {
  const validateSettle = ajv.compile({ $ref: `${agentPaySchema.$id}#/$defs/AgentPaySettleResponse` });
  assert.equal(validateSettle({
    success: true,
    transaction: "",
    network: "eip155:8453",
  }), false);
  const validateVerify = ajv.compile({ $ref: `${agentPaySchema.$id}#/$defs/AgentPayVerifyResponse` });
  assert.equal(validateVerify({ isValid: true }), false);
  assert.equal(validateVerify({ isValid: false }), false);
});

test("canonical TypeScript API and independent JavaScript encoding agree", () => {
  const fieldOrder = [
    "protocol", "paymentRail", "chainId", "factoryAddress", "orderId", "buyer", "seller",
    "token", "settlementAuthority", "feeRecipient", "amount", "maxFeeAmount", "expiresAt",
    "refundAvailableAt",
  ];
  const plainJsCanonical = JSON.stringify(Object.fromEntries(fieldOrder.map((field) => [field, terms[field]])));
  const plainJsHash = keccak256(stringToHex(plainJsCanonical));

  assert.equal(plainJsCanonical, expected.canonicalTerms);
  assert.equal(canonicalizeEscrowOrderTerms(terms), expected.canonicalTerms);
  assert.equal(plainJsHash, expected.termsHash);
  assert.equal(hashEscrowOrderTerms(terms), expected.termsHash);
});

test("canonical terms do not depend on input property order", () => {
  const reversed = Object.fromEntries(Object.entries(terms).reverse());
  assert.equal(canonicalizeEscrowOrderTerms(reversed), expected.canonicalTerms);
});

test("native private-request fixture fixes canonical bytes and Keccak-256 hash", () => {
  assert.equal(canonicalizePrivateRequest(nativeServiceRecords.privateRequest), nativeServiceRecords.canonicalPrivateRequest);
  assert.equal(hashPrivateRequest(nativeServiceRecords.privateRequest), nativeServiceRecords.requestHash);
  const reordered = Object.fromEntries(Object.entries(nativeServiceRecords.privateRequest).reverse());
  assert.equal(hashPrivateRequest(reordered), nativeServiceRecords.requestHash);
  assert.throws(() => canonicalizePrivateRequest({ invalid: undefined }), /not a JSON value/);
});

test("native participant projections are role-qualified and reject private or operator fields", () => {
  for (const [definition, value] of [["BuyerOrderProjection", nativeServiceRecords.buyerOrder], ["ProviderOrderProjection", nativeServiceRecords.providerOrder]]) {
    const validate = ajv.compile({ $ref: `${nativeServiceSchema.$id}#/$defs/${definition}` });
    assert.equal(validate(value), true, JSON.stringify(validate.errors));
    assert.equal(validate({ ...value, privateRequest: nativeServiceRecords.privateRequest }), false);
    assert.equal(validate({ ...value, authorizationToken: "secret" }), false);
    assert.equal(validate({ ...value, encryptedTransaction: "ciphertext" }), false);
  }
  const validateBuyer = ajv.compile({ $ref: `${nativeServiceSchema.$id}#/$defs/BuyerOrderProjection` });
  const validateProvider = ajv.compile({ $ref: `${nativeServiceSchema.$id}#/$defs/ProviderOrderProjection` });
  assert.equal(validateBuyer({ ...nativeServiceRecords.buyerOrder, sellerAddress: "0x7777777777777777777777777777777777777777" }), false);
  assert.equal(validateProvider({ ...nativeServiceRecords.providerOrder, buyerAddress: "0x6666666666666666666666666666666666666666" }), false);
});

test("canonical terms reject non-checksummed addresses", () => {
  assert.throws(
    () => canonicalizeEscrowOrderTerms({ ...terms, token: terms.token.toLowerCase() }),
    /checksummed EVM address/,
  );
});

test("canonical terms reject uppercase order identifiers", () => {
  assert.throws(
    () => canonicalizeEscrowOrderTerms({ ...terms, orderId: `0x${"AB".repeat(32)}` }),
    /lowercase bytes32 hex/,
  );
});

test("typed ABIs expose the complete escrow write surface", () => {
  const factoryFunctions = new Set(agentPayEscrowFactoryAbi.filter((item) => item.type === "function").map((item) => item.name));
  const vaultFunctions = new Set(orderEscrowVaultAbi.filter((item) => item.type === "function").map((item) => item.name));
  assert.deepEqual([...factoryFunctions].sort(), ["createVault", "getVault", "implementation", "predictVaultAddress", "vaults"]);
  for (const name of ["initialize", "activate", "submitDelivery", "release", "refund", "refundAfterTimeout", "cancelUnfunded", "getOrder"]) {
    assert.equal(vaultFunctions.has(name), true, `missing Vault ABI function ${name}`);
  }
});

test("typed ABIs expose the frozen Registry and Spending Module surface", () => {
  const registryFunctions = new Set(skillRegistryAbi.filter((item) => item.type === "function").map((item) => item.name));
  const moduleFunctions = new Set(agentPaySpendingModuleAbi.filter((item) => item.type === "function").map((item) => item.name));
  assert.deepEqual([...registryFunctions].sort(), ["isQualified", "owner", "setActive", "setSkill", "skills", "transferOwnership"]);
  for (const name of ["createPolicy", "revokePolicy", "qualificationHash", "commitmentDigest", "fundVault", "policies", "usedCommitments", "fundedOrders"]) {
    assert.equal(moduleFunctions.has(name), true, `missing Spending Module ABI function ${name}`);
  }
});

test("typed ABI exposes only the frozen Authority Controller surface", () => {
  const functions = new Set(settlementAuthorityControllerAbi.filter((item) => item.type === "function").map((item) => item.name));
  const events = new Set(settlementAuthorityControllerAbi.filter((item) => item.type === "event").map((item) => item.name));
  assert.deepEqual([...functions].sort(), [
    "administrator", "cancelUnfunded", "executor", "factory", "isApprovedVault", "pause", "paused",
    "refund", "release", "setExecutor", "submitDelivery", "unpause",
  ]);
  assert.deepEqual([...events].sort(), [
    "CancellationForwarded", "DeliveryForwarded", "ExecutorUpdated", "Paused", "RefundForwarded",
    "ReleaseForwarded", "Unpaused",
  ]);
  assert.equal(functions.has("activate"), false);
  assert.equal(functions.has("execute"), false);
  assert.equal(functions.has("call"), false);
});

test("Authority Controller fixture and deployment manifest match the typed ABI", () => {
  const functions = settlementAuthorityControllerAbi.filter((item) => item.type === "function").map((item) => item.name).sort();
  const events = settlementAuthorityControllerAbi.filter((item) => item.type === "event").map((item) => item.name).sort();
  assert.deepEqual(functions, [...controllerRecords.functions].sort());
  assert.deepEqual(events, [...controllerRecords.events].sort());
  for (const forbidden of controllerRecords.forbiddenFunctions) assert.equal(functions.includes(forbidden), false);
  const validate = ajv.getSchema(controllerDeploymentSchema.$id);
  assert.equal(validate(controllerRecords.deployment), true, JSON.stringify(validate.errors));
  assert.notEqual(controllerRecords.deployment.administratorSafe, controllerRecords.deployment.initialExecutor);
});
