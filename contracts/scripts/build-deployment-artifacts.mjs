#!/usr/bin/env node
// Reproducible, source-bound deployment artifacts. No RPC or chain writes.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  describeArtifact,
  verifyArtifact,
  verifyAbiSubset,
} from "./deployment-artifact-integrity.mjs";
import {
  orderEscrowVaultAbi,
  agentPayEscrowFactoryAbi,
  settlementAuthorityControllerAbi,
} from "../../packages/types/dist/index.js";

const run = promisify(execFile);
const contractsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] || "build";
if (!["build", "check"].includes(mode) || process.argv.length > 3)
  throw new Error("usage: build-deployment-artifacts.mjs [build|check]");
const targetRoot = resolve(
  process.env.AGENTPAY_CONTRACT_ARTIFACT_DIR ||
    join(contractsDir, "artifacts/deployments"),
);
const dockerImage = "ghcr.io/foundry-rs/foundry:latest";
const sha = (data) => createHash("sha256").update(data).digest("hex");
const toml = await readFile(join(contractsDir, "foundry.toml"), "utf8");
const setting = (name) => {
  const found = toml.match(new RegExp(`^${name}\\s*=\\s*(.+?)\\s*$`, "m"));
  if (!found) throw new Error(`missing foundry ${name}`);
  return found[1].trim().replace(/^"|"$/g, "");
};
const solcVersion = setting("solc_version");
if (!/^0\.8\.[0-9]+$/.test(solcVersion))
  throw new Error("unsupported compiler version");
const compiler =
  process.env.AGENTPAY_SOLC_BIN ||
  join(
    process.env.HOME || "/nonexistent",
    ".local/share/svm",
    solcVersion,
    `solc-${solcVersion}`,
  );
const dockerArgs = [
  "run",
  "--interactive",
  "--rm",
  "--pull",
  "never",
  "--network",
  "none",
  "--read-only",
  "--memory=1g",
  "--memory-swap=1g",
  "--cpus=2",
  "--pids-limit=128",
  "--tmpfs",
  "/tmp:rw,noexec,size=64m",
  "--mount",
  `type=bind,src=${resolve(compiler)},dst=/solc,readonly`,
  "--entrypoint",
  "/solc",
  dockerImage,
];
const [compilerBytes, compilerVersion, imageInfo] = await Promise.all([
  readFile(compiler),
  run("docker", [...dockerArgs, "--version"]),
  run("docker", ["image", "inspect", dockerImage, "--format", "{{.Id}}"]),
]);
if (!/^sha256:[a-f0-9]{64}$/.test(imageInfo.stdout.trim()))
  throw Error("Offline compiler image identity unavailable");
const compilerExecution = {
  backend: "offline-docker",
  image: dockerImage,
  imageId: imageInfo.stdout.trim(),
  memoryBytes: 1073741824,
  network: "none",
};
if (!compilerVersion.stdout.includes(`Version: ${solcVersion}+commit.`))
  throw new Error("installed solc version mismatch");
const settings = {
  optimizer: {
    enabled: setting("optimizer") === "true",
    runs: Number(setting("optimizer_runs")),
  },
  viaIR: setting("via_ir") === "true",
  evmVersion: setting("evm_version"),
  outputSelection: Object.fromEntries(
    [
      "OrderEscrowVault",
      "AgentPayEscrowFactory",
      "SettlementAuthorityController",
    ].map((name) => [
      `src/${name}.sol`,
      {
        [name]: [
          "abi",
          "evm.bytecode.object",
          "evm.deployedBytecode.object",
          "evm.deployedBytecode.immutableReferences",
        ],
      },
    ]),
  ),
};
if (
  !Number.isSafeInteger(settings.optimizer.runs) ||
  settings.optimizer.runs < 1 ||
  !settings.optimizer.enabled ||
  !settings.viaIR
)
  throw new Error(
    "unexpected foundry optimizer settings; review the new build profile",
  );
const sources = {};
const sourceSha256 = {};
async function addSources(directory, prefix) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (entry.isDirectory())
      await addSources(join(directory, entry.name), `${prefix}${entry.name}/`);
    else if (entry.isFile() && entry.name.endsWith(".sol")) {
      const name = `${prefix}${entry.name}`;
      const content = await readFile(join(directory, entry.name));
      sources[name] = { content: content.toString() };
      sourceSha256[name] = sha(content);
    }
  }
}
await addSources(join(contractsDir, "src"), "src/");
const required = [
  "src/OrderEscrowVault.sol",
  "src/AgentPayEscrowFactory.sol",
  "src/SettlementAuthorityController.sol",
];
for (const name of required)
  if (!sources[name]) throw new Error(`missing deployment source ${name}`);
const input = {
  language: "Solidity",
  sources: Object.fromEntries(
    Object.entries(sources).sort(([a], [b]) => a.localeCompare(b)),
  ),
  settings,
};
const sourceDigest = sha(JSON.stringify(input));
const compilerSha256 = sha(compilerBytes);
const bundleDigest = sha(`${sourceDigest}:${compilerSha256}`);
const bundleId = bundleDigest.slice(0, 20);
const directory = join(targetRoot, bundleId);
const pointer = join(targetRoot, "latest.json");
const abiByName = {
  OrderEscrowVault: orderEscrowVaultAbi,
  AgentPayEscrowFactory: agentPayEscrowFactoryAbi,
  SettlementAuthorityController: settlementAuthorityControllerAbi,
};
const selected = [
  ["OrderEscrowVault.sol", "OrderEscrowVault"],
  ["AgentPayEscrowFactory.sol", "AgentPayEscrowFactory"],
  ["SettlementAuthorityController.sol", "SettlementAuthorityController"],
];
async function verifyBundle() {
  const manifest = JSON.parse(
    await readFile(join(directory, "manifest.json"), "utf8"),
  );
  if (
    manifest.version !== "agentpay.contract-deployment-artifacts.v1" ||
    manifest.bundleDigest !== bundleDigest ||
    manifest.sourceDigest !== sourceDigest ||
    manifest.compilerSha256 !== compilerSha256 ||
    JSON.stringify(manifest.sourceSha256) !== JSON.stringify(sourceSha256)
  )
    throw new Error("deployment artifact source/compiler mismatch");
  for (const [, name] of selected) {
    const bytes = await readFile(join(directory, `${name}.json`));
    const item = verifyArtifact(
      bytes,
      manifest.artifactSha256[name],
      manifest.bytecode?.[name],
    );
    verifyAbiSubset(item.abi, abiByName[name]);
  }
  return manifest;
}
if (mode === "check") {
  const selectedPointer = JSON.parse(await readFile(pointer, "utf8"));
  if (
    selectedPointer.bundleId !== bundleId ||
    selectedPointer.bundleDigest !== bundleDigest
  )
    throw new Error("latest deployment artifact is stale");
  const manifest = await verifyBundle();
  console.log(
    JSON.stringify({
      ok: true,
      mode,
      bundleId,
      directory,
      sourceDigest,
      compilerSha256,
      artifactSha256: manifest.artifactSha256,
      bytecode: manifest.bytecode,
      compilerExecution: manifest.compilerExecution,
    }),
  );
} else {
  await mkdir(targetRoot, { recursive: true, mode: 0o700 });
  let existing = false;
  try {
    existing = (await stat(directory)).isDirectory();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!existing) {
    const output = await new Promise((resolve, reject) => {
      const process = execFile(
        "docker",
        [...dockerArgs, "--standard-json"],
        { maxBuffer: 64 * 1024 * 1024, timeout: 300000 },
        (error, stdout, stderr) =>
          error
            ? reject(new Error(`solc failed: ${stderr.slice(0, 1000)}`))
            : resolve(stdout),
      );
      process.stdin.end(JSON.stringify(input));
    });
    const result = JSON.parse(output);
    const errors = (result.errors || []).filter(
      (item) => item.severity === "error",
    );
    if (errors.length)
      throw new Error(errors.map((item) => item.formattedMessage).join("\n"));
    const artifacts = {};
    const artifactSha256 = {};
    const bytecode = {};
    for (const [file, name] of selected) {
      const item = result.contracts?.[`src/${file}`]?.[name];
      bytecode[name] = describeArtifact(item);
      verifyAbiSubset(item.abi, abiByName[name]);
      const bytes = JSON.stringify(item);
      artifacts[name] = bytes;
      artifactSha256[name] = sha(bytes);
    }
    const manifest = {
      version: "agentpay.contract-deployment-artifacts.v1",
      bundleId,
      bundleDigest,
      sourceDigest,
      sourceSha256,
      compilerVersion: compilerVersion.stdout.trim().split("\n").at(-1),
      compilerSha256,
      settings,
      artifactSha256,
      bytecode,
      compilerExecution,
    };
    const temporary = join(targetRoot, `.staging-${bundleId}-${process.pid}`);
    await mkdir(temporary, { mode: 0o700 });
    for (const [name, bytes] of Object.entries(artifacts))
      await writeFile(join(temporary, `${name}.json`), bytes, { mode: 0o600 });
    await writeFile(
      join(temporary, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      { mode: 0o600 },
    );
    await rename(temporary, directory);
  }
  const manifest = await verifyBundle();
  const temporaryPointer = join(targetRoot, `.latest-${process.pid}`);
  await writeFile(
    temporaryPointer,
    JSON.stringify({ bundleId, bundleDigest }) + "\n",
    { mode: 0o600 },
  );
  await rename(temporaryPointer, pointer);
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode,
        bundleId,
        directory,
        sourceDigest,
        compilerSha256,
        sourceSha256,
        artifactSha256: manifest.artifactSha256,
        bytecode: manifest.bytecode,
        compilerExecution: manifest.compilerExecution,
        reusedExisting: existing,
        staleFoundryOutUsed: false,
      },
      null,
      2,
    ),
  );
}
