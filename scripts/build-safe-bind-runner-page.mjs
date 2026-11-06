import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(scriptDir, "..");

const chainId = process.env.CHAIN_ID?.trim() || "8453";
const outputPath = process.env.SAFE_BIND_RUNNER_PAGE_FILE?.trim()
  ? resolve(repoDir, process.env.SAFE_BIND_RUNNER_PAGE_FILE.trim())
  : resolve(repoDir, `deployments/safe-bind-runner.chain-${chainId}.html`);
const bundlePath = process.env.SAFE_BIND_BUNDLE_FILE?.trim()
  ? resolve(repoDir, process.env.SAFE_BIND_BUNDLE_FILE.trim())
  : resolve(repoDir, `deployments/safe-bind.bundle.chain-${chainId}.json`);

const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));

const browserEntry = `
import { createSafeClient } from '@safe-global/sdk-starter-kit';

const bundle = ${JSON.stringify(bundle)};
const state = {
  connectedAddress: null,
  chainId: null
};

const statusEl = document.getElementById('status');
const accountEl = document.getElementById('account');
const chainEl = document.getElementById('chain');
const settlementSafeEl = document.getElementById('settlementSafe');
const userSafeEl = document.getElementById('userSafe');
const mcpSafeEl = document.getElementById('mcpSafe');
const dealIdEl = document.getElementById('dealId');
const connectBtn = document.getElementById('connect');
const createDealBtn = document.getElementById('createDeal');
const userApproveBtn = document.getElementById('userApprove');
const mcpApproveBtn = document.getElementById('mcpApprove');
const copyBundleBtn = document.getElementById('copyBundle');

settlementSafeEl.textContent = bundle.terms.settlement;
userSafeEl.textContent = bundle.terms.userSafe;
mcpSafeEl.textContent = bundle.terms.mcpSafe;
dealIdEl.textContent = bundle.terms.dealId;

function setStatus(message, extra) {
  statusEl.textContent = extra ? message + '\n\n' + extra : message;
}

async function ensureEthereum() {
  if (!window.ethereum) {
    throw new Error('MetaMask not found. Open this page in a browser with MetaMask installed.');
  }
}

async function ensureChain() {
  const targetChainHex = '0x' + BigInt(bundle.chainId).toString(16);
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainHex }]
    });
  } catch (error) {
    throw new Error('Switch MetaMask to the target chain before sending Safe transactions.');
  }
}

async function connectWallet() {
  await ensureEthereum();
  await ensureChain();
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const [account] = accounts;
  const chainHex = await window.ethereum.request({ method: 'eth_chainId' });
  state.connectedAddress = account;
  state.chainId = BigInt(chainHex).toString();
  accountEl.textContent = account || '-';
  chainEl.textContent = state.chainId || '-';
  setStatus('Connected. Pick the Safe role that matches the current owner account and send the corresponding transaction.');
}

async function sendSafeTransaction(safeAddress, transaction, label) {
  await ensureEthereum();
  if (!state.connectedAddress) {
    await connectWallet();
  }

  const safeClient = await createSafeClient({
    provider: window.ethereum,
    signer: state.connectedAddress,
    safeAddress
  });

  const isOwner = await safeClient.isOwner(state.connectedAddress);
  if (!isOwner) {
    throw new Error('Connected wallet is not an owner of ' + safeAddress);
  }

  const threshold = await safeClient.getThreshold();
  const result = await safeClient.send({
    transactions: [{
      to: transaction.to,
      value: transaction.value,
      data: transaction.data
    }]
  });

  const lines = [
    label + ' submitted for Safe ' + safeAddress,
    'threshold=' + threshold,
    'status=' + result.status,
    'description=' + result.description
  ];
  if (result.transactions?.safeTxHash) lines.push('safeTxHash=' + result.transactions.safeTxHash);
  if (result.transactions?.ethereumTxHash) lines.push('ethereumTxHash=' + result.transactions.ethereumTxHash);
  setStatus(label + ' sent.', lines.join('\n'));
}

connectBtn.addEventListener('click', async () => {
  try {
    setStatus('Connecting to MetaMask...');
    await connectWallet();
  } catch (error) {
    setStatus('Connection failed.', error && error.message ? error.message : String(error));
  }
});

createDealBtn.addEventListener('click', async () => {
  try {
    setStatus('Submitting createDeal through settlement Safe...');
    await sendSafeTransaction(bundle.terms.settlement, bundle.settlementTransactions.createDeal, 'createDeal');
  } catch (error) {
    setStatus('createDeal failed.', error && error.message ? error.message : String(error));
  }
});

userApproveBtn.addEventListener('click', async () => {
  try {
    setStatus('Submitting approveUserParticipation through user Safe...');
    await sendSafeTransaction(bundle.terms.userSafe, bundle.userApprovalTransaction, 'approveUserParticipation');
  } catch (error) {
    setStatus('approveUserParticipation failed.', error && error.message ? error.message : String(error));
  }
});

mcpApproveBtn.addEventListener('click', async () => {
  try {
    setStatus('Submitting approveMcpParticipation through MCP Safe...');
    await sendSafeTransaction(bundle.terms.mcpSafe, bundle.mcpApprovalTransaction, 'approveMcpParticipation');
  } catch (error) {
    setStatus('approveMcpParticipation failed.', error && error.message ? error.message : String(error));
  }
});

copyBundleBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
    setStatus('Bundle copied to clipboard.');
  } catch (error) {
    setStatus('Copy failed.', error && error.message ? error.message : String(error));
  }
});
`;

const build = await esbuild.build({
  stdin: {
    contents: browserEntry,
    resolveDir: repoDir,
    sourcefile: 'safe-bind-runner-entry.js',
    loader: 'js'
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  write: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    global: 'globalThis'
  }
});

const js = build.outputFiles[0].text;
const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Safe Deal Runner</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f3e8;
        --ink: #152033;
        --paper: #fffdf8;
        --line: #d7cfbb;
        --accent: #0f766e;
        --accent-strong: #115e59;
        --muted: #6a6557;
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
        max-width: 980px;
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
      .meta, .roles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        margin: 24px 0;
      }
      .meta div, .roles div {
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
        color: var(--muted);
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
        <h1>Safe Deal Runner</h1>
        <p>This page automates the live Safe flow for a prepared bundle: settlement Safe sends <code>createDeal</code>, then user Safe and MCP Safe send their direct on-chain approvals. No manual ABI or calldata entry is required.</p>
        <div class="meta">
          <div><span class="label">Chain ID</span><strong id="chain">-</strong></div>
          <div><span class="label">Connected Owner</span><strong id="account">-</strong></div>
          <div><span class="label">Deal ID</span><strong id="dealId">-</strong></div>
        </div>
        <div class="roles">
          <div><span class="label">Settlement Safe</span><strong id="settlementSafe">-</strong></div>
          <div><span class="label">User Safe</span><strong id="userSafe">-</strong></div>
          <div><span class="label">MCP Safe</span><strong id="mcpSafe">-</strong></div>
        </div>
        <div class="actions">
          <button id="connect">Connect MetaMask</button>
          <button id="createDeal">Send createDeal</button>
          <button id="userApprove">Send user approval</button>
          <button id="mcpApprove">Send MCP approval</button>
          <button id="copyBundle" class="secondary">Copy Bundle JSON</button>
        </div>
        <div class="hint">
          Use the wallet owner for the corresponding Safe before clicking each action. If a Safe threshold is greater than 1, Safe Starter Kit will submit the transaction to Safe Transaction Service for confirmations instead of executing immediately.
        </div>
        <h2>Status</h2>
        <pre id="status">Not connected.</pre>
      </section>
    </main>
    <script>${js}</script>
  </body>
</html>`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, 'utf8');
process.stdout.write(`Wrote Safe deal runner page to ${outputPath}\n`);
process.stdout.write(`Using bundle from ${bundlePath}\n`);
