#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${RPC_URL:-}" ]]; then
  echo "ERROR: RPC_URL is required" >&2
  exit 1
fi

if [[ -z "${DEAL_MANAGER_ADDRESS:-}" ]]; then
  echo "ERROR: DEAL_MANAGER_ADDRESS is required" >&2
  exit 1
fi

echo "RPC_URL=${RPC_URL}"
if [[ -n "${CHAIN_ID:-}" ]]; then
  echo "CHAIN_ID(env)=${CHAIN_ID}"
else
  echo "CHAIN_ID(env)=<unset>"
fi
echo "DEAL_MANAGER_ADDRESS=${DEAL_MANAGER_ADDRESS}"

node --input-type=module <<'NODE'
import { createPublicClient, http, getAddress } from 'viem';

const rpcUrl = process.env.RPC_URL;
const expectedChainIdRaw = process.env.CHAIN_ID?.trim();
const expectedChainId = expectedChainIdRaw ? Number.parseInt(expectedChainIdRaw, 10) : null;
const dealManagerAddress = getAddress(process.env.DEAL_MANAGER_ADDRESS);

const client = createPublicClient({ transport: http(rpcUrl) });
const chainId = await client.getChainId();
const bytecode = await client.getBytecode({ address: dealManagerAddress });

console.log(`CHAIN_ID(rpc)=${chainId}`);

if (expectedChainId !== null && Number.isFinite(expectedChainId) && chainId !== expectedChainId) {
  console.error(`ERROR: CHAIN_ID mismatch: env=${expectedChainId} rpc=${chainId}`);
  process.exit(3);
}

if (!bytecode || bytecode === '0x') {
  console.error(`ERROR: no contract bytecode at ${dealManagerAddress} on current RPC`);
  process.exit(2);
}

console.log(`OK: contract bytecode exists at ${dealManagerAddress}`);
console.log(`bytecode_prefix=${bytecode.slice(0, 18)}...`);
NODE
