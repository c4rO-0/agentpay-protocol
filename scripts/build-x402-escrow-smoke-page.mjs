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
  return execFileSync("forge", args, { cwd: contractsDir, encoding: "utf8" }).trim();
}

function readForgeWithDocker(contractPath, contractName, field, json = false) {
  const jsonFlag = json ? "--json " : "";
  return execFileSync(
    "/usr/bin/docker",
    [
      "run", "--rm", "--entrypoint", "sh", "-v", `${contractsDir}:/src:ro`,
      "ghcr.io/foundry-rs/foundry:latest", "-lc",
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
const outputPath = process.env.X402_ESCROW_SMOKE_PAGE_FILE?.trim()
  ? resolve(repoDir, process.env.X402_ESCROW_SMOKE_PAGE_FILE.trim())
  : resolve(repoDir, `deployments/x402-escrow-smoke.chain-${chainId}.html`);

const factoryBytecode = readForge("src/AgentPayEscrowFactory.sol", "AgentPayEscrowFactory", "bytecode");
const factoryAbi = JSON.parse(readForge("src/AgentPayEscrowFactory.sol", "AgentPayEscrowFactory", "abi", true));

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AgentPay x402 Escrow Smoke</title><style>
body{margin:0;background:#f6f7f9;color:#172033;font:15px system-ui,sans-serif}main{max-width:900px;margin:32px auto;padding:0 20px 48px}section{background:#fff;border:1px solid #d8dee9;border-radius:8px;padding:24px;margin:16px 0}h1,h2{margin:0 0 12px}p{line-height:1.5}label{display:block;font-weight:600;margin:12px 0 5px}input{width:100%;padding:9px;border:1px solid #aeb8c7;border-radius:4px;font:14px ui-monospace,monospace}button{padding:10px 14px;border:0;border-radius:4px;background:#075985;color:#fff;font-weight:600;cursor:pointer;margin:12px 8px 0 0}button.secondary{background:#475569}button:disabled{opacity:.55;cursor:not-allowed}pre{white-space:pre-wrap;overflow:auto;background:#0f172a;color:#e2e8f0;padding:14px;border-radius:4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}@media(max-width:650px){.grid{grid-template-columns:1fr}}</style></head>
<body><main><h1>AgentPay x402 Escrow Smoke</h1><p>Deploy the Factory, then create one deterministic Vault. This page contains contract bytecode and ABI only; it never stores a private key. Every transaction requires MetaMask confirmation.</p>
<section><h2>Network</h2><p>Target chain: <strong>${chainId}</strong>. RPC hint: <code>${rpcUrl}</code>.</p><button id="connect">Connect MetaMask</button><pre id="status">Not connected.</pre></section>
<section><h2>1. Deploy Factory</h2><p>The Factory deploys its immutable Vault implementation in the same deployment transaction.</p><button id="deploy" disabled>Deploy AgentPayEscrowFactory</button><label>Factory address</label><input id="factory" placeholder="Populated after deployment, or paste an existing Factory address" /></section>
<section><h2>2. Create Smoke Vault</h2><p>All fields become immutable Vault terms. Use the real x402 buyer address and Base USDC. The default amount is 1000 atomic units (0.001 USDC).</p><div class="grid">
<div><label>Order ID (bytes32)</label><input id="orderId" /></div><div><label>Terms hash (bytes32)</label><input id="termsHash" /></div>
<div><label>Buyer</label><input id="buyer" /></div><div><label>Seller</label><input id="seller" /></div>
<div><label>Settlement authority</label><input id="authority" /></div><div><label>Fee recipient</label><input id="feeRecipient" /></div>
<div><label>Token</label><input id="token" value="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" /></div><div><label>Amount (atomic USDC)</label><input id="amount" value="1000" /></div>
<div><label>Maximum fee (atomic USDC)</label><input id="maxFee" value="0" /></div><div><label>Expires at (Unix seconds)</label><input id="expiresAt" /></div>
<div><label>Refund available at (Unix seconds)</label><input id="refundAt" /></div></div>
<button id="defaults" class="secondary">Generate smoke IDs and times</button><button id="create" disabled>Create Vault</button><button id="copy" class="secondary" disabled>Copy record JSON</button></section>
<section><h2>3. Activate Funded Vault</h2><p>After CDP settlement, the settlement authority calls <code>activate()</code>. This only changes the Vault from Created to Funded after it confirms the required USDC balance.</p><label>Funded Vault address</label><input id="activateVault" placeholder="Paste the Vault address" /><button id="refreshVault" class="secondary" disabled>Check Vault status</button><button id="activate" disabled>Activate Vault</button><pre id="vaultStatus">No Vault selected.</pre></section>
<section><h2>4. Refund Funded Vault</h2><p>The settlement authority can refund this smoke order before timeout. This returns exactly 1000 atomic USDC to the immutable buyer; it does not test or pay the seller.</p><label>Funded Vault address</label><input id="refundVault" placeholder="Paste the Vault address" /><button id="refund" disabled>Refund 1000 USDC</button><pre id="refundStatus">No refund action started.</pre></section>
<section><h2>5. Deliver and Release Smoke Funds</h2><p>This completes the smoke lifecycle. Submit a synthetic delivery hash, then release exactly 1000 atomic USDC to the Vault's fixed seller. Each action requires MetaMask confirmation.</p><label>Funded Vault address</label><input id="releaseVault" placeholder="Paste the Vault address" /><div class="grid"><div><label>Output hash (bytes32)</label><input id="outputHash" /></div><div><label>Usage units</label><input id="usageUnits" value="1" /></div><div><label>Seller amount (atomic USDC)</label><input id="sellerAmount" value="1000" /></div><div><label>Fee amount (atomic USDC)</label><input id="releaseFee" value="0" /></div></div><button id="deliveryDefaults" class="secondary">Generate delivery hash</button><button id="submitDelivery" disabled>Submit Delivery</button><button id="release" disabled>Release Funds</button><pre id="releaseStatus">No release action started.</pre></section>
<section><h2>Result</h2><pre id="result">No Vault created.</pre></section>
<script src="https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js"></script><script>
const TARGET_CHAIN_ID=${JSON.stringify(chainId)}, TARGET_CHAIN_HEX="0x"+BigInt(TARGET_CHAIN_ID).toString(16), FACTORY_BYTECODE=${JSON.stringify(factoryBytecode)}, FACTORY_ABI=${JSON.stringify(factoryAbi)};
const VAULT_ABI=["function activate()","function state() view returns (uint8)","function refund(uint256)","function submitDelivery(bytes32,uint256)","function release(uint256,uint256)"], USDC_ABI=["function balanceOf(address) view returns (uint256)"], BASE_USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const $=id=>document.getElementById(id); let signer, lastRecord;
const status=(a,b)=>$("status").textContent=b?a+"\\n\\n"+b:a;
const val=id=>$(id).value.trim();
function randomHex(bytes){const data=new Uint8Array(bytes);if(globalThis.crypto&&typeof globalThis.crypto.getRandomValues==="function"){globalThis.crypto.getRandomValues(data)}else{for(let i=0;i<data.length;i+=1)data[i]=Math.floor(Math.random()*256)}return Array.from(data,b=>b.toString(16).padStart(2,"0")).join("")}
function setDefaults(){const now=Math.floor(Date.now()/1000); $("orderId").value=ethers.keccak256(ethers.toUtf8Bytes("agentpay-x402-smoke-order:"+randomHex(16))); $("termsHash").value=ethers.keccak256(ethers.toUtf8Bytes("agentpay-x402-smoke-terms:v1")); $("expiresAt").value=String(now+3600); $("refundAt").value=String(now+7200)}
function setDeliveryDefaults(){$("outputHash").value=ethers.keccak256(ethers.toUtf8Bytes("agentpay-x402-smoke-output:"+randomHex(16)))}
async function ensureNetwork(){if(!window.ethereum)throw new Error("MetaMask not found.");try{await ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:TARGET_CHAIN_HEX}]})}catch(e){if(e.code!==4902)throw e;await ethereum.request({method:"wallet_addEthereumChain",params:[{chainId:TARGET_CHAIN_HEX,chainName:"Base Mainnet",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:[${JSON.stringify(rpcUrl)}],blockExplorerUrls:["https://basescan.org"]}]})}}
async function refreshVault(){try{const address=ethers.getAddress(val("activateVault"));const provider=new ethers.BrowserProvider(ethereum);const [state,balance]=await Promise.all([new ethers.Contract(address,VAULT_ABI,provider).state(),new ethers.Contract(BASE_USDC,USDC_ABI,provider).balanceOf(address)]);$("vaultStatus").textContent="vaultAddress: "+address+"\\nstate: "+state.toString()+" (1=Created, 2=Funded)\\nUSDC balance: "+balance.toString()}catch(e){$("vaultStatus").textContent="Status check failed: "+(e.shortMessage||e.message||String(e))}}
$("connect").onclick=async()=>{try{await ensureNetwork();const provider=new ethers.BrowserProvider(ethereum);signer=await provider.getSigner();$("deploy").disabled=false;$("create").disabled=false;$("refreshVault").disabled=false;$("activate").disabled=false;$("refund").disabled=false;$("submitDelivery").disabled=false;$("release").disabled=false;status("Connected as "+await signer.getAddress())}catch(e){status("Connection failed.",e.shortMessage||e.message||String(e))}};
$("defaults").onclick=setDefaults;
$("deliveryDefaults").onclick=setDeliveryDefaults;
$("deploy").onclick=async()=>{try{if(!signer)throw new Error("Connect MetaMask first.");$("deploy").disabled=true;status("Sending Factory deployment to MetaMask...");const c=await new ethers.ContractFactory(FACTORY_ABI,FACTORY_BYTECODE,signer).deploy();const tx=c.deploymentTransaction();status("Deployment transaction sent.","txHash: "+tx.hash);await c.waitForDeployment();$("factory").value=await c.getAddress();status("Factory deployed.","factoryAddress: "+$("factory").value+"\\ntxHash: "+tx.hash)}catch(e){status("Deployment failed.",e.shortMessage||e.message||String(e))}finally{$("deploy").disabled=false}};
$("create").onclick=async()=>{try{if(!signer)throw new Error("Connect MetaMask first.");const factoryAddress=ethers.getAddress(val("factory"));const init={orderId:val("orderId"),termsHash:val("termsHash"),buyer:ethers.getAddress(val("buyer")),seller:ethers.getAddress(val("seller")),token:ethers.getAddress(val("token")),settlementAuthority:ethers.getAddress(val("authority")),feeRecipient:ethers.getAddress(val("feeRecipient")),amount:BigInt(val("amount")),maxFeeAmount:BigInt(val("maxFee")),expiresAt:BigInt(val("expiresAt")),refundAvailableAt:BigInt(val("refundAt"))};if(init.orderId.length!==66||init.termsHash.length!==66)throw new Error("orderId and termsHash must each be bytes32 hex values.");const now=BigInt(Math.floor(Date.now()/1000));if(init.expiresAt<=now)throw new Error("Expires at must be in the future. Click Generate smoke IDs and times again.");if(init.refundAvailableAt<init.expiresAt)throw new Error("Refund available at must be at or after Expires at.");$("create").disabled=true;const factory=new ethers.Contract(factoryAddress,FACTORY_ABI,signer);status("Sending createVault to MetaMask...");const tx=await factory.createVault(init);status("Create Vault transaction sent.","txHash: "+tx.hash);const receipt=await tx.wait();const vault=await factory.getVault(init.orderId);$("activateVault").value=vault;lastRecord={chainId:TARGET_CHAIN_ID,rpcUrl:${JSON.stringify(rpcUrl)},factoryAddress,vaultAddress:vault,createVaultTxHash:tx.hash,orderId:init.orderId,termsHash:init.termsHash,buyer:init.buyer,seller:init.seller,token:init.token,settlementAuthority:init.settlementAuthority,feeRecipient:init.feeRecipient,amount:init.amount.toString(),maxFeeAmount:init.maxFeeAmount.toString(),expiresAt:init.expiresAt.toString(),refundAvailableAt:init.refundAvailableAt.toString(),blockNumber:receipt.blockNumber.toString()};$("result").textContent=JSON.stringify(lastRecord,null,2);$("copy").disabled=false;await refreshVault();status("Vault created.","vaultAddress: "+vault+"\\ncreateVaultTxHash: "+tx.hash)}catch(e){status("Create Vault failed.",e.shortMessage||e.message||String(e))}finally{$("create").disabled=false}};
$("refreshVault").onclick=refreshVault;
$("activate").onclick=async()=>{try{if(!signer)throw new Error("Connect MetaMask first.");const address=ethers.getAddress(val("activateVault"));$("activate").disabled=true;$("vaultStatus").textContent="Sending activate() to MetaMask...";const tx=await new ethers.Contract(address,VAULT_ABI,signer).activate();$("vaultStatus").textContent="Activation transaction sent.\\ntxHash: "+tx.hash;await tx.wait();await refreshVault()}catch(e){$("vaultStatus").textContent="Activation failed: "+(e.shortMessage||e.message||String(e))}finally{$("activate").disabled=false}};
$("refund").onclick=async()=>{try{if(!signer)throw new Error("Connect MetaMask first.");const address=ethers.getAddress(val("refundVault"));$("refund").disabled=true;$("refundStatus").textContent="Sending refund(1000) to MetaMask...";const tx=await new ethers.Contract(address,VAULT_ABI,signer).refund(1000n);$("refundStatus").textContent="Refund transaction sent.\\ntxHash: "+tx.hash;await tx.wait();$("refundStatus").textContent="Refund complete.\\ntxHash: "+tx.hash}catch(e){$("refundStatus").textContent="Refund failed: "+(e.shortMessage||e.message||String(e))}finally{$("refund").disabled=false}};
$("submitDelivery").onclick=async()=>{try{if(!signer)throw new Error("Connect MetaMask first.");const address=ethers.getAddress(val("releaseVault")),outputHash=val("outputHash"),usage=BigInt(val("usageUnits"));if(!/^0x[0-9a-fA-F]{64}$/.test(outputHash))throw new Error("Output hash must be bytes32 hex. Click Generate delivery hash.");$("submitDelivery").disabled=true;$("releaseStatus").textContent="Sending submitDelivery() to MetaMask...";const tx=await new ethers.Contract(address,VAULT_ABI,signer).submitDelivery(outputHash,usage);$("releaseStatus").textContent="Delivery transaction sent.\\ntxHash: "+tx.hash;await tx.wait();$("releaseStatus").textContent="Delivery submitted.\\ntxHash: "+tx.hash+"\\nYou may now release funds."}catch(e){$("releaseStatus").textContent="Delivery failed: "+(e.shortMessage||e.message||String(e))}finally{$("submitDelivery").disabled=false}};
$("release").onclick=async()=>{try{if(!signer)throw new Error("Connect MetaMask first.");const address=ethers.getAddress(val("releaseVault")),sellerAmount=BigInt(val("sellerAmount")),feeAmount=BigInt(val("releaseFee"));if(sellerAmount!==1000n||feeAmount!==0n)throw new Error("This smoke page only releases exactly 1000 to the fixed seller with zero fee.");$("release").disabled=true;$("releaseStatus").textContent="Sending release(1000, 0) to MetaMask...";const tx=await new ethers.Contract(address,VAULT_ABI,signer).release(sellerAmount,feeAmount);$("releaseStatus").textContent="Release transaction sent.\\ntxHash: "+tx.hash;await tx.wait();$("releaseStatus").textContent="Funds released.\\ntxHash: "+tx.hash}catch(e){$("releaseStatus").textContent="Release failed: "+(e.shortMessage||e.message||String(e))}finally{$("release").disabled=false}};
$("copy").onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(lastRecord));status("Record JSON copied. Run pnpm x402:escrow:record with X402_ESCROW_SMOKE_RECORD set to this JSON.")}catch(e){status("Copy failed.",e.message||String(e))}};setDefaults();setDeliveryDefaults();
</script></main></body></html>`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, "utf8");
process.stdout.write(`Wrote MetaMask smoke page to ${outputPath}\n`);
