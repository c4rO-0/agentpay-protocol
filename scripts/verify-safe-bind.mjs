import { createPublicClient, createWalletClient, getAddress, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const DEAL_MANAGER_ABI = [
  {
    type: "function",
    name: "createDeal",
    stateMutability: "nonpayable",
    inputs: [{
      name: "terms",
      type: "tuple",
      components: [
        { name: "dealId", type: "bytes32" },
        { name: "userSafe", type: "address" },
        { name: "mcpSafe", type: "address" },
        { name: "settlement", type: "address" },
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "fee", type: "uint256" },
        { name: "maxRefund", type: "uint256" },
        { name: "maxLiability", type: "uint256" },
        { name: "gracePeriodEnd", type: "uint64" },
        { name: "deadline", type: "uint64" },
        { name: "userNonce", type: "uint256" },
        { name: "mcpNonce", type: "uint256" }
      ]
    }],
    outputs: [{ name: "", type: "bytes32" }]
  },
  {
    type: "function",
    name: "bindUserWithSig",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "terms",
        type: "tuple",
        components: [
          { name: "dealId", type: "bytes32" },
          { name: "userSafe", type: "address" },
          { name: "mcpSafe", type: "address" },
          { name: "settlement", type: "address" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "fee", type: "uint256" },
          { name: "maxRefund", type: "uint256" },
          { name: "maxLiability", type: "uint256" },
          { name: "gracePeriodEnd", type: "uint64" },
          { name: "deadline", type: "uint64" },
          { name: "userNonce", type: "uint256" },
          { name: "mcpNonce", type: "uint256" }
        ]
      },
      { name: "signature", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "bindMcpWithSig",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "terms",
        type: "tuple",
        components: [
          { name: "dealId", type: "bytes32" },
          { name: "userSafe", type: "address" },
          { name: "mcpSafe", type: "address" },
          { name: "settlement", type: "address" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "fee", type: "uint256" },
          { name: "maxRefund", type: "uint256" },
          { name: "maxLiability", type: "uint256" },
          { name: "gracePeriodEnd", type: "uint64" },
          { name: "deadline", type: "uint64" },
          { name: "userNonce", type: "uint256" },
          { name: "mcpNonce", type: "uint256" }
        ]
      },
      { name: "signature", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "getDeal",
    stateMutability: "view",
    inputs: [{ name: "dealId", type: "bytes32" }],
    outputs: [{
      name: "",
      type: "tuple",
      components: [
        { name: "dealId", type: "bytes32" },
        { name: "userSafe", type: "address" },
        { name: "mcpSafe", type: "address" },
        { name: "settlement", type: "address" },
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "fee", type: "uint256" },
        { name: "maxRefund", type: "uint256" },
        { name: "maxLiability", type: "uint256" },
        { name: "gracePeriodEnd", type: "uint64" },
        { name: "deadline", type: "uint64" },
        { name: "userNonce", type: "uint256" },
        { name: "mcpNonce", type: "uint256" },
        { name: "status", type: "uint8" },
        { name: "userBound", type: "bool" },
        { name: "mcpBound", type: "bool" },
        { name: "fundedAmount", type: "uint256" },
        { name: "releasedAmount", type: "uint256" },
        { name: "feePaid", type: "uint256" },
        { name: "refundedAmount", type: "uint256" },
        { name: "chargebackAmount", type: "uint256" }
      ]
    }]
  }
];

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireAddress(name) {
  const value = requireEnv(name);
  if (!isAddress(value)) throw new Error(`${name} must be an address`);
  return getAddress(value);
}

function requireBigInt(name) {
  const raw = requireEnv(name);
  try {
    return BigInt(raw);
  } catch {
    throw new Error(`${name} must be an integer string`);
  }
}

function requireNumber(name) {
  const raw = requireEnv(name);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function requireHex(name) {
  const value = requireEnv(name);
  if (!/^0x[0-9a-fA-F]*$/.test(value)) throw new Error(`${name} must be a hex string`);
  return value;
}

const statusNames = ["None", "Created", "Ready", "Funded", "GracePeriod", "Released", "Disputed", "Refunded", "Chargeback", "Closed", "Cancelled"];

async function main() {
  const rpcUrl = requireEnv("RPC_URL");
  const chainId = requireNumber("CHAIN_ID");
  const account = privateKeyToAccount(requireHex("PRIVATE_KEY_SETTLEMENT_AGENT"));
  const settlement = requireAddress("SETTLEMENT_ADDRESS");
  if (getAddress(account.address) !== settlement) {
    throw new Error(`PRIVATE_KEY_SETTLEMENT_AGENT address ${account.address} does not match SETTLEMENT_ADDRESS ${settlement}`);
  }

  const dealManagerAddress = requireAddress("DEAL_MANAGER_ADDRESS");
  const terms = {
    dealId: requireHex("DEAL_ID"),
    userSafe: requireAddress("USER_SAFE_ADDRESS"),
    mcpSafe: requireAddress("MCP_SAFE_ADDRESS"),
    settlement,
    token: requireAddress("TOKEN_ADDRESS"),
    amount: requireBigInt("DEAL_AMOUNT"),
    fee: requireBigInt("DEAL_FEE"),
    maxRefund: requireBigInt("DEAL_MAX_REFUND"),
    maxLiability: requireBigInt("DEAL_MAX_LIABILITY"),
    gracePeriodEnd: BigInt(requireNumber("DEAL_GRACE_PERIOD_END")),
    deadline: BigInt(requireNumber("DEAL_DEADLINE")),
    userNonce: requireBigInt("DEAL_USER_NONCE"),
    mcpNonce: requireBigInt("DEAL_MCP_NONCE")
  };

  const userSignature = requireHex("USER_BINDING_SIGNATURE");
  const mcpSignature = requireHex("MCP_BINDING_SIGNATURE");

  const chain = {
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Native", symbol: "NATIVE", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } }
  };

  const walletClient = createWalletClient({ account, transport: http(rpcUrl), chain });
  const publicClient = createPublicClient({ transport: http(rpcUrl), chain });

  const createTxHash = await walletClient.writeContract({
    address: dealManagerAddress,
    abi: DEAL_MANAGER_ABI,
    functionName: "createDeal",
    args: [terms]
  });
  await publicClient.waitForTransactionReceipt({ hash: createTxHash });

  const bindUserTxHash = await walletClient.writeContract({
    address: dealManagerAddress,
    abi: DEAL_MANAGER_ABI,
    functionName: "bindUserWithSig",
    args: [terms, userSignature]
  });
  await publicClient.waitForTransactionReceipt({ hash: bindUserTxHash });

  const bindMcpTxHash = await walletClient.writeContract({
    address: dealManagerAddress,
    abi: DEAL_MANAGER_ABI,
    functionName: "bindMcpWithSig",
    args: [terms, mcpSignature]
  });
  await publicClient.waitForTransactionReceipt({ hash: bindMcpTxHash });

  const deal = await publicClient.readContract({
    address: dealManagerAddress,
    abi: DEAL_MANAGER_ABI,
    functionName: "getDeal",
    args: [terms.dealId]
  });

  if (!deal.userBound) throw new Error("userBound is false");
  if (!deal.mcpBound) throw new Error("mcpBound is false");
  if (Number(deal.status) !== 2) throw new Error(`expected Ready (2), got ${deal.status}`);

  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        mode: "safe-bind-verify",
        dealId: terms.dealId,
        createTxHash,
        bindUserTxHash,
        bindMcpTxHash,
        status: statusNames[Number(deal.status)] || String(deal.status),
        userBound: deal.userBound,
        mcpBound: deal.mcpBound
      },
      null,
      2
    ) + "\n"
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
