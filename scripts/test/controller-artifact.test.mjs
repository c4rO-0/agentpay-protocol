import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { settlementAuthorityControllerAbi } from "../../packages/types/dist/index.js";

const compiled = JSON.parse(readFileSync(
  new URL("../../contracts/out/SettlementAuthorityController.sol/SettlementAuthorityController.json", import.meta.url),
  "utf8",
)).abi;

function publicShape(value) {
  if (Array.isArray(value)) return value.map(publicShape);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "internalType")
    .map(([key, child]) => [key, publicShape(child)]));
}

function sorted(abi) {
  return abi.map(publicShape).sort((left, right) => {
    const leftKey = `${left.type}:${left.name || ""}`;
    const rightKey = `${right.type}:${right.name || ""}`;
    return leftKey.localeCompare(rightKey);
  });
}

test("published Authority Controller ABI exactly matches the compiled contract", () => {
  assert.deepEqual(sorted(settlementAuthorityControllerAbi), sorted(compiled));
});
