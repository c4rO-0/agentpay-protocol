import { createHash } from "node:crypto";
import { keccak256 } from "viem";
export const artifactSha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const hex = (value) =>
  typeof value === "string" && /^(?:[0-9a-fA-F]{2})+$/.test(value);
/** Immutable slots are substituted at deployment. The template hash must not be
 * compared directly with the final deployed runtime code hash. */
export function describeArtifact(item) {
  if (
    !Array.isArray(item?.abi) ||
    !item.abi.length ||
    !hex(item?.evm?.bytecode?.object) ||
    !hex(item?.evm?.deployedBytecode?.object)
  )
    throw Error("Incomplete/link-unresolved contract artifact");
  const runtime = item.evm.deployedBytecode.object;
  const references = item.evm.deployedBytecode.immutableReferences || {};
  for (const ref of Object.values(references).flat())
    if (
      !Number.isSafeInteger(ref.start) ||
      !Number.isSafeInteger(ref.length) ||
      ref.start < 0 ||
      ref.length < 1 ||
      (ref.start + ref.length) * 2 > runtime.length
    )
      throw Error("Invalid immutable reference");
  return {
    creationKeccak256: keccak256("0x" + item.evm.bytecode.object),
    runtimeTemplateKeccak256: keccak256("0x" + runtime),
    runtimeHasImmutables: Object.values(references).some(
      (refs) => refs.length > 0,
    ),
  };
}
function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "internalType")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, shape(child)]),
  );
}
export function verifyAbiSubset(compiled, published) {
  const rows = new Set(compiled.map((item) => JSON.stringify(shape(item))));
  for (const entry of published)
    if (!rows.has(JSON.stringify(shape(entry))))
      throw Error(
        "Published ABI differs from compiled contract: " +
          (entry.name || entry.type),
      );
}
export function verifyArtifact(bytes, expectedSha, expectedBytecode) {
  if (artifactSha256(bytes) !== expectedSha)
    throw Error("Contract artifact SHA mismatch");
  const item = JSON.parse(bytes),
    actual = describeArtifact(item);
  if (JSON.stringify(actual) !== JSON.stringify(expectedBytecode))
    throw Error("Contract bytecode metadata mismatch");
  return item;
}
/** EIP-1167 deployed clone code; requires the actual reviewed implementation address. */
export function deployedVaultCloneCodeHash(implementation) {
  if (
    typeof implementation !== "string" ||
    !/^0x[0-9a-fA-F]{40}$/.test(implementation) ||
    /^0x0{40}$/i.test(implementation)
  )
    throw Error("Implementation address required");
  return keccak256(
    "0x363d3d373d3d3d363d73" +
      implementation.slice(2).toLowerCase() +
      "5af43d82803e903d91602b57fd5bf3",
  );
}
