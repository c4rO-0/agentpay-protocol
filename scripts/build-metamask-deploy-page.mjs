import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(scriptDir, "..");
const contractsDir = resolve(scriptDir, "../contracts");

function readForgeWithLocalForge(contractPath, contractName, field, json = false) {
  const args = ["inspect"];
  if (json) args.push("--json");
  args.push(`${contractPath}:${contractName}`, field);
  return execFileSync("forge", args, {
    cwd: contractsDir,
    encoding: "utf8"
  }).trim();
}

function readForgeWithDocker(contractPath, contractName, field, json = false) {
  const jsonFlag = json ? "--json " : "";
  return execFileSync(
    "/usr/bin/docker",
    [
      "run",
      "--rm",
      "--entrypoint",
      "sh",
      "-v",
      `${contractsDir}:/src:ro`,
      "ghcr.io/foundry-rs/foundry:latest",
      "-lc",
      `export FOUNDRY_DISABLE_NIGHTLY_WARNING=1 && rm -rf /tmp/work && cp -R /src /tmp/work && cd /tmp/work && forge inspect ${jsonFlag}${contractPath}:${contractName} ${field}`
    ],
    { encoding: "utf8" }
  ).trim();
}

function readForge(contractPath, contractName, field, json = false) {
  try {
    return readForgeWithLocalForge(contractPath, contractName, field, json);
  } catch {
    return readForgeWithDocker(contractPath, contractName, field, json);
  }
}

const chainId = process.env.CHAIN_ID?.trim() || "8453";
const rpcUrl = process.env.RPC_URL?.trim() || "https://mainnet.base.org";
const outputPath = process.env.METAMASK_DEPLOY_PAGE_FILE?.trim()
  ? resolve(repoDir, process.env.METAMASK_DEPLOY_PAGE_FILE.trim())
  : resolve(repoDir, `deployments/dealmanager.metamask-deploy.chain-${chainId}.html`);

const bytecode = readForge("src/DealManager.sol", "DealManager", "bytecode");
const abi = JSON.parse(readForge("src/DealManager.sol", "DealManager", "abi", true));

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DealManager MetaMask Deploy</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f3e8;
        --ink: #152033;
        --paper: #fffdf8;
        --line: #d7cfbb;
        --accent: #0f766e;
        --accent-strong: #115e59;
        --shadow: 0 18px 40px rgba(21, 32, 51, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background: radial-gradient(circle at top, #fffef9 0%, var(--bg) 65%);
        color: var(--ink);
      }
      main {
        max-width: 880px;
        margin: 48px auto;
        padding: 0 20px 40px;
      }
      .card {
        background: var(--paper);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: var(--shadow);
        padding: 28px;
      }
      h1 { margin: 0 0 8px; font-size: 36px; }
      p { line-height: 1.6; }
      .meta {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        margin: 24px 0;
      }
      .meta div {
        background: #faf6ea;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 14px 16px;
      }
      .label {
        display: block;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #6a6557;
        margin-bottom: 4px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 20px;
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        font: inherit;
        color: white;
        background: var(--accent);
        cursor: pointer;
      }
      button.secondary { background: #334155; }
      button:hover { background: var(--accent-strong); }
      button.secondary:hover { background: #1f2937; }
      button:disabled { opacity: 0.5; cursor: not-allowed; }
      pre {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 16px;
        padding: 16px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .hint {
        margin-top: 18px;
        padding: 14px 16px;
        border: 1px dashed var(--line);
        border-radius: 14px;
        background: #fffaf0;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <h1>Deploy DealManager</h1>
        <p>This page deploys <code>DealManager</code> with MetaMask on-chain. It embeds the contract bytecode and ABI directly from your local protocol source. No private key is stored here.</p>
        <div class="meta">
          <div><span class="label">Chain ID</span><strong>${chainId}</strong></div>
          <div><span class="label">RPC Hint</span><strong>${rpcUrl}</strong></div>
          <div><span class="label">Contract</span><strong>DealManager</strong></div>
        </div>
        <div class="actions">
          <button id="connect">Connect MetaMask</button>
          <button id="deploy" disabled>Deploy DealManager</button>
          <button id="copyBytecode" class="secondary">Copy Bytecode</button>
        </div>
        <div class="hint">
          Recommended flow: connect MetaMask, switch to Base Mainnet, then click deploy. After the transaction is mined, copy the deployed address back into <code>DEAL_MANAGER_ADDRESS</code> and run <code>pnpm contracts:deploy:safe:record</code>.
        </div>
        <h2>Status</h2>
        <pre id="status">Not connected.</pre>
      </section>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js"></script>
    <script>
      const TARGET_CHAIN_ID = ${JSON.stringify(chainId)};
      const TARGET_CHAIN_HEX = "0x" + BigInt(TARGET_CHAIN_ID).toString(16);
      const BYTECODE = ${JSON.stringify(bytecode)};
      const ABI = ${JSON.stringify(abi)};
      const statusEl = document.getElementById("status");
      const connectBtn = document.getElementById("connect");
      const deployBtn = document.getElementById("deploy");
      const copyBtn = document.getElementById("copyBytecode");
      let signer;

      function setStatus(message, extra) {
        statusEl.textContent = extra ? message + "\\n\\n" + extra : message;
      }

      async function ensureEthereum() {
        if (!window.ethereum) {
          throw new Error("MetaMask not found. Open this page in a browser with MetaMask installed.");
        }
      }

      async function ensureBaseNetwork() {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: TARGET_CHAIN_HEX }]
          });
        } catch (error) {
          if (error && error.code !== 4902) throw error;
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: TARGET_CHAIN_HEX,
              chainName: "Base Mainnet",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [${JSON.stringify(rpcUrl)}],
              blockExplorerUrls: ["https://basescan.org"]
            }]
          });
        }
      }

      connectBtn.addEventListener("click", async () => {
        try {
          setStatus("Connecting to MetaMask...");
          await ensureEthereum();
          await ensureBaseNetwork();
          const provider = new ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();
          const userAddress = await signer.getAddress();
          deployBtn.disabled = false;
          setStatus("Connected as " + userAddress + ". Ready to deploy DealManager.");
        } catch (error) {
          setStatus("Connection failed.", error && error.message ? error.message : String(error));
        }
      });

      deployBtn.addEventListener("click", async () => {
        try {
          if (!signer) throw new Error("Connect MetaMask first.");
          deployBtn.disabled = true;
          setStatus("Sending deployment transaction to MetaMask for confirmation...");
          const factory = new ethers.ContractFactory(ABI, BYTECODE, signer);
          const contract = await factory.deploy();
          const tx = contract.deploymentTransaction();
          setStatus("Deployment transaction sent.", "txHash: " + tx.hash);
          await contract.waitForDeployment();
          const address = await contract.getAddress();
          setStatus(
            "DealManager deployed successfully.",
            "Contract address: " + address + "\\n\\nTransaction hash: " + tx.hash + "\\n\\nNext step:\\nexport DEAL_MANAGER_ADDRESS=" + address + "\\npnpm contracts:deploy:safe:record"
          );
        } catch (error) {
          const message = error && (error.shortMessage || error.message) ? (error.shortMessage || error.message) : String(error);
          setStatus("Deployment failed.", message);
        } finally {
          deployBtn.disabled = false;
        }
      });

      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(BYTECODE);
          setStatus("Bytecode copied to clipboard.");
        } catch (error) {
          setStatus("Failed to copy bytecode.", error && error.message ? error.message : String(error));
        }
      });
    </script>
  </body>
</html>
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, "utf8");
process.stdout.write(`Wrote MetaMask deploy page to ${outputPath}\n`);
