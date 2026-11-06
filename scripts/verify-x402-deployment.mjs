import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPublicClient, getAddress, http, keccak256 } from "viem";

const DEFAULT_MANIFEST = "deployments/base-mainnet/x402-escrow-v1.json";
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function fail(message) {
  throw new Error(`deployment verification failed: ${message}`);
}

function assertEqual(label, actual, expected) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) {
    fail(`${label}: expected ${expected}, got ${actual}`);
  }
}

function validateManifest(manifest) {
  const constants = {
    schema: "agentpay.x402-escrow-deployment.v1",
    status: "canonical",
    protocol: "agentpay.x402.escrow.v1",
    schemaVersion: "1.0.0",
    abiVersion: "1.0.0",
    chainId: "8453",
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  };
  for (const [field, expected] of Object.entries(constants)) {
    assertEqual(field, manifest[field], expected);
  }
  for (const field of ["factoryAddress", "implementationAddress"]) {
    if (!ADDRESS_PATTERN.test(String(manifest[field] || ""))) fail(`${field} is invalid`);
  }
  if (!/^[0-9a-f]{40}$/.test(String(manifest.factorySourceCommit || ""))) {
    fail("factorySourceCommit is invalid");
  }
  if (!HASH_PATTERN.test(String(manifest.deploymentTxHash || ""))) fail("deploymentTxHash is invalid");
  for (const field of [
    "factoryCreationKeccak256",
    "factoryRuntimeKeccak256",
    "implementationRuntimeKeccak256"
  ]) {
    if (!HASH_PATTERN.test(String(manifest.bytecode?.[field] || ""))) fail(`bytecode.${field} is invalid`);
  }
  const expectedCompiler = {
    solc: "0.8.24",
    optimizer: true,
    optimizerRuns: 200,
    viaIR: true,
    evmVersion: "cancun"
  };
  for (const [field, expected] of Object.entries(expectedCompiler)) {
    if (manifest.compiler?.[field] !== expected) fail(`compiler.${field} must be ${expected}`);
  }
  if (manifest.auditStatus !== "not-audited") fail("unexpected audit status");
}

function compiledContracts(output) {
  const factory = output.contracts?.["src/AgentPayEscrowFactory.sol"]?.AgentPayEscrowFactory?.evm;
  const vault = output.contracts?.["src/OrderEscrowVault.sol"]?.OrderEscrowVault?.evm;
  if (!factory?.bytecode?.object || !factory?.deployedBytecode?.object || !vault?.deployedBytecode?.object) {
    fail("solc output does not contain the expected contracts");
  }
  return { factory, vault };
}

function patchFactoryImmutables(factory, implementationAddress) {
  const runtime = Buffer.from(factory.deployedBytecode.object, "hex");
  const addressHex = implementationAddress.slice(2).toLowerCase();
  const references = Object.values(factory.deployedBytecode.immutableReferences || {}).flat();
  if (!references.length) fail("compiled Factory has no immutable references");
  for (const { start, length } of references) {
    Buffer.from(addressHex.padStart(length * 2, "0"), "hex").copy(runtime, start);
  }
  return `0x${runtime.toString("hex")}`;
}

async function verifyCompiledOutput(manifest, outputPath) {
  const output = JSON.parse(await readFile(resolve(outputPath), "utf8"));
  const { factory, vault } = compiledContracts(output);
  assertEqual(
    "compiled Factory creation bytecode",
    keccak256(`0x${factory.bytecode.object}`),
    manifest.bytecode.factoryCreationKeccak256
  );
  assertEqual(
    "compiled Factory runtime bytecode",
    keccak256(patchFactoryImmutables(factory, manifest.implementationAddress)),
    manifest.bytecode.factoryRuntimeKeccak256
  );
  assertEqual(
    "compiled implementation runtime bytecode",
    keccak256(`0x${vault.deployedBytecode.object}`),
    manifest.bytecode.implementationRuntimeKeccak256
  );
}

const manifestPath = resolve(process.argv[2] || DEFAULT_MANIFEST);
const solcOutputPath = process.argv[3] || "";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
validateManifest(manifest);

const client = createPublicClient({ transport: http(process.env.RPC_URL || "https://mainnet.base.org") });
const factoryAddress = getAddress(manifest.factoryAddress);
const implementationAddress = getAddress(manifest.implementationAddress);
const implementationAbi = [{
  type: "function",
  name: "implementation",
  stateMutability: "view",
  inputs: [],
  outputs: [{ type: "address" }]
}];

const [chainId, factoryCode, implementationCode, onchainImplementation, transaction, receipt] =
  await Promise.all([
    client.getChainId(),
    client.getBytecode({ address: factoryAddress }),
    client.getBytecode({ address: implementationAddress }),
    client.readContract({ address: factoryAddress, abi: implementationAbi, functionName: "implementation" }),
    client.getTransaction({ hash: manifest.deploymentTxHash }),
    client.getTransactionReceipt({ hash: manifest.deploymentTxHash })
  ]);

assertEqual("chainId", chainId, manifest.chainId);
if (!factoryCode || factoryCode === "0x") fail("Factory has no runtime bytecode");
if (!implementationCode || implementationCode === "0x") fail("implementation has no runtime bytecode");
assertEqual("Factory implementation()", onchainImplementation, implementationAddress);
assertEqual("Factory creation bytecode", keccak256(transaction.input), manifest.bytecode.factoryCreationKeccak256);
assertEqual("Factory runtime bytecode", keccak256(factoryCode), manifest.bytecode.factoryRuntimeKeccak256);
assertEqual(
  "implementation runtime bytecode",
  keccak256(implementationCode),
  manifest.bytecode.implementationRuntimeKeccak256
);
assertEqual("deployment contract address", receipt.contractAddress, factoryAddress);
assertEqual("deployment block", receipt.blockNumber, manifest.deploymentBlockNumber);
assertEqual("deployment status", receipt.status, "success");

const block = await client.getBlock({ blockNumber: receipt.blockNumber });
assertEqual("deployment timestamp", new Date(Number(block.timestamp) * 1000).toISOString(), manifest.deployedAt);
if (solcOutputPath) await verifyCompiledOutput(manifest, solcOutputPath);

console.log(JSON.stringify({
  ok: true,
  manifest: manifestPath,
  sourceVerified: Boolean(solcOutputPath),
  factoryAddress,
  implementationAddress,
  deploymentTxHash: manifest.deploymentTxHash,
  deploymentBlockNumber: manifest.deploymentBlockNumber,
  auditStatus: manifest.auditStatus
}, null, 2));
