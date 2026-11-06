import { readFile } from "node:fs/promises";

const sources = {};
for (const path of ["src/AgentPayEscrowFactory.sol", "src/OrderEscrowVault.sol"]) {
  sources[path] = { content: await readFile(new URL(`../contracts/${path}`, import.meta.url), "utf8") };
}

process.stdout.write(JSON.stringify({
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    evmVersion: "cancun",
    outputSelection: {
      "*": {
        "*": [
          "abi",
          "evm.bytecode.object",
          "evm.deployedBytecode.object",
          "evm.deployedBytecode.immutableReferences",
          "metadata"
        ]
      }
    }
  }
}));
