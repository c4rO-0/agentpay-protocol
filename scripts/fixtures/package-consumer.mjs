// Runs outside the checkout: no sibling source, workspace link or private import.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  hashPrivateRequest,
  hashAgentPayRegistryQualification,
  agentPaySpendingModuleAbi,
} from "@c4roa0/agentpay-protocol";
import {
  buildAgentPayCommitmentTypedData,
  hashAgentPayCommitment,
} from "@agentpay/x402-escrow";
const schema = JSON.parse(
  await readFile(
    new URL(import.meta.resolve("@c4roa0/agentpay-protocol/service-invocation-schema")),
    "utf8",
  ),
);
assert.equal(typeof schema.$id, "string");
for (const input of [
  { text: "translate this" },
  {
    document: { mime: "application/pdf", sha256: "a".repeat(64) },
    pages: [1, 3],
  },
]) {
  assert.match(hashPrivateRequest(input), /^0x[0-9a-f]{64}$/);
  assert.equal(
    hashPrivateRequest(input),
    hashPrivateRequest(JSON.parse(JSON.stringify(input))),
  );
}
assert.notEqual(
  hashPrivateRequest({ text: "one" }),
  hashPrivateRequest({ text: "two" }),
);
assert.ok(
  agentPaySpendingModuleAbi.some(
    (item) => item.type === "function" && item.name === "fundVault",
  ),
);
const address = "0x" + "1".repeat(40),
  hash = "0x" + "2".repeat(64);
const requirements = { network: "eip155:31337", extra: { module: address } };
const commitment = {
  safe: address,
  policyId: hash,
  factory: address,
  orderId: hash,
  vault: address,
  token: address,
  amount: "1",
  termsHash: hash,
  scopeProofHash: hashAgentPayRegistryQualification({
    registry: address,
    skillId: hash,
    profileHash: hash,
    seller: address,
  }),
  commitmentNonce: hash,
  validBefore: "1800000000",
};
assert.equal(
  buildAgentPayCommitmentTypedData(requirements, commitment).domain
    .verifyingContract,
  address,
);
assert.match(
  hashAgentPayCommitment(requirements, commitment),
  /^0x[0-9a-f]{64}$/,
);
console.log(
  "PASS: independent packed consumer imports types, schema, ABI and escrow exports for two business payloads.",
);

// Installed fixtures remain available to non-TypeScript conformance consumers.
const fixture = JSON.parse(await readFile(new URL(
  "../fixtures/agentpay-native-service-v1/records.json",
  import.meta.resolve("@c4roa0/agentpay-protocol")), "utf8"));
assert.ok(fixture && typeof fixture === "object");
