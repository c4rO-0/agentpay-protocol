// Real JSON-RPC transactions against a disposable Anvil owned by this process.
// FlowSafe is the maintained Safe-interface fixture, NOT a production Safe deployment.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  keccak256,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { hashAgentPayRegistryQualification } from "../packages/types/dist/index.js";
import { buildAgentPayCommitmentTypedData } from "../packages/x402-escrow/dist/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const out =
  process.env.PROTOCOL_E2E_ARTIFACTS || resolve(root, "contracts/out");
const child = spawn(
  process.env.ANVIL_BIN || "anvil",
  ["--host", "127.0.0.1", "--port", "0", "--chain-id", "31337"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let exited = false;
child.once("exit", () => {
  exited = true;
});
let output = "";
const stop = () => {
  if (!exited) child.kill("SIGTERM");
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
const deadline = setTimeout(() => {
  stop();
  console.error("Native lifecycle exceeded its five-minute deadline.");
  process.exitCode = 1;
}, 300000);
try {
  const url = await new Promise((done, reject) => {
    const timer = setTimeout(
      () => reject(Error("Anvil did not start within 20 seconds.")),
      20000,
    );
    const finish = (error, value) => {
      clearTimeout(timer);
      error ? reject(error) : done(value);
    };
    child.once("error", (error) => finish(error));
    child.once("exit", () =>
      finish(Error("Anvil exited before completing startup.")),
    );
    const consume = (bytes) => {
      output = (output + bytes.toString()).slice(-32768);
      const m = output.match(/Listening on (127\.0\.0\.1:\d+)/);
      if (m) finish(null, "http://" + m[1]);
    };
    child.stdout.on("data", consume);
    child.stderr.on("data", consume);
  });
  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(url, { timeout: 10000, retryCount: 0 }),
  });
  assert.equal(await publicClient.getChainId(), 31337);
  assert.match(
    await publicClient.request({ method: "web3_clientVersion" }),
    /anvil/i,
  );
  // Public Anvil fixtures only; there is deliberately no external RPC option.
  const owner = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  );
  const delegate = privateKeyToAccount("0x" + "aa".repeat(32));
  const wallet = createWalletClient({
    account: owner,
    chain: foundry,
    transport: http(url, { timeout: 10000, retryCount: 0 }),
  });
  const receipt = async (hash) => {
    const r = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 15000,
    });
    assert.equal(r.status, "success");
    return r;
  };
  const deploy = async (name, args = [], file = name) => {
    const a = JSON.parse(
      await readFile(resolve(out, `${file}.sol/${name}.json`), "utf8"),
    );
    const r = await receipt(
      await wallet.deployContract({
        abi: a.abi,
        bytecode: a.bytecode.object,
        args,
      }),
    );
    assert.ok(r.contractAddress);
    return { address: r.contractAddress, abi: a.abi };
  };
  const read = (c, functionName, args = []) =>
    publicClient.readContract({ ...c, functionName, args });
  const send = async (c, functionName, args = []) =>
    receipt(await wallet.writeContract({ ...c, functionName, args }));
  const factory = await deploy("AgentPayEscrowFactory"),
    module = await deploy("AgentPaySpendingModule");
  const registry = await deploy("SkillRegistry", [owner.address]),
    token = await deploy("MockERC20", ["Test USD", "TUSD", 6]);
  const safe = await deploy(
    "FlowSafe",
    [owner.address],
    "AgentPayAuthorizationFlow.t",
  );
  const id = (s) => keccak256(toHex(s));
  const policyId = id("ci-policy"),
    skillId = id("ci-service"),
    profileHash = id("ci-profile");
  const seller = "0x1000000000000000000000000000000000000001",
    fee = "0x2000000000000000000000000000000000000002";
  const now = (await publicClient.getBlock()).timestamp;
  await send(registry, "setSkill", [skillId, profileHash, seller, true]);
  await send(safe, "enableModule", [module.address]);
  await send(safe, "ownerCall", [
    module.address,
    encodeFunctionData({
      abi: module.abi,
      functionName: "createPolicy",
      args: [
        policyId,
        delegate.address,
        token.address,
        factory.address,
        registry.address,
        1000000n,
        3000000n,
        now,
        now + 86400n,
      ],
    }),
  ]);
  await send(token, "mint", [safe.address, 5000000n]);
  const ownerActions = await read(safe, "ownerActionCount");
  const vaultAbi = JSON.parse(
    await readFile(
      resolve(out, "OrderEscrowVault.sol/OrderEscrowVault.json"),
      "utf8",
    ),
  ).abi;
  const orders = [];
  for (const label of ["release", "refund"]) {
    const orderId = id(label),
      termsHash = id("terms-" + label),
      nonce = id("nonce-" + label);
    const init = {
      orderId,
      termsHash,
      buyer: safe.address,
      seller,
      token: token.address,
      settlementAuthority: owner.address,
      feeRecipient: fee,
      amount: 1000000n,
      maxFeeAmount: 50000n,
      expiresAt: now + 3600n,
      refundAvailableAt: now + 7200n,
    };
    await send(factory, "createVault", [init]);
    const vault = {
      address: await read(factory, "getVault", [orderId]),
      abi: vaultAbi,
    };
    const commitment = {
      safe: safe.address,
      policyId,
      factory: factory.address,
      orderId,
      vault: vault.address,
      token: token.address,
      amount: "1000000",
      termsHash,
      scopeProofHash: hashAgentPayRegistryQualification({
        registry: registry.address,
        skillId,
        profileHash,
        seller,
      }),
      commitmentNonce: nonce,
      validBefore: String(now + 600n),
    };
    const signature = await delegate.signTypedData(
      buildAgentPayCommitmentTypedData(
        { network: "eip155:31337", extra: { module: module.address } },
        commitment,
      ),
    );
    const args = [
      safe.address,
      policyId,
      orderId,
      skillId,
      profileHash,
      1000000n,
      nonce,
      now + 600n,
      signature,
    ];
    await send(module, "fundVault", args);
    assert.equal(await read(token, "balanceOf", [vault.address]), 1000000n);
    // Same valid request cannot charge twice. An unrelated transport failure must not pass.
    await assert.rejects(
      () =>
        publicClient.simulateContract({
          ...module,
          account: owner,
          functionName: "fundVault",
          args,
        }),
      /commitment used|already funded|nonce used/i,
    );
    await send(vault, "activate");
    orders.push(vault);
  }
  assert.equal(
    await read(safe, "ownerActionCount"),
    ownerActions,
    "No per-order owner approval",
  );
  await send(orders[0], "submitDelivery", [id("output"), 1n]);
  await send(orders[0], "release", [900000n, 50000n]);
  await send(orders[1], "refund", [1000000n]);
  assert.equal(await read(orders[0], "state"), 4);
  assert.equal(await read(orders[1], "state"), 5);
  assert.equal(await read(token, "balanceOf", [safe.address]), 4050000n);
  assert.equal(await read(token, "balanceOf", [seller]), 900000n);
  assert.equal(await read(token, "balanceOf", [fee]), 50000n);
  for (const vault of orders)
    assert.equal(await read(token, "balanceOf", [vault.address]), 0n);
  assert.equal(
    (await read(module, "policies", [safe.address, policyId]))[6],
    2000000n,
  );
  await assert.rejects(
    () =>
      publicClient.simulateContract({
        ...orders[0],
        account: owner,
        functionName: "refund",
        args: [1000000n],
      }),
    /bad state/,
  );
  await assert.rejects(
    () =>
      publicClient.simulateContract({
        ...orders[1],
        account: owner,
        functionName: "refund",
        args: [1000000n],
      }),
    /bad state/,
  );
  console.log(
    "PASS: one bounded authorization, two signed payments, replay rejection, delivery, release/refund and exact balances. Safe-interface fixture; no platform recovery claim.",
  );
} finally {
  clearTimeout(deadline);
  stop();
  if (!exited)
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  // A launcher can exit while descendants retain inherited output pipes. Do not
  // let those pipes keep this test alive; the launcher owns descendant cleanup.
  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
