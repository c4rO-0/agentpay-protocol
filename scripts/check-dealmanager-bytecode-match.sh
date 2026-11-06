#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/contracts"

if [[ -z "${RPC_URL:-}" ]]; then
  echo "ERROR: RPC_URL is required" >&2
  exit 1
fi
if [[ -z "${DEAL_MANAGER_ADDRESS:-}" ]]; then
  echo "ERROR: DEAL_MANAGER_ADDRESS is required" >&2
  exit 1
fi

fetch_local_deployed_bytecode() {
  if command -v forge >/dev/null 2>&1; then
    (cd "$CONTRACTS_DIR" && forge inspect src/DealManager.sol:DealManager deployedBytecode)
    return
  fi

  docker run --rm --entrypoint sh -v "$CONTRACTS_DIR:/src:ro" ghcr.io/foundry-rs/foundry:latest \
    -lc 'export FOUNDRY_DISABLE_NIGHTLY_WARNING=1 && rm -rf /tmp/work && cp -R /src /tmp/work && cd /tmp/work && forge inspect src/DealManager.sol:DealManager deployedBytecode'
}

LOCAL_BYTECODE_RAW="$(fetch_local_deployed_bytecode | tr -d '\r\n')"
LOCAL_BYTECODE="${LOCAL_BYTECODE_RAW#0x}"
LOCAL_BYTECODE="$(echo "$LOCAL_BYTECODE" | tr '[:upper:]' '[:lower:]')"

ONCHAIN_BYTECODE_RAW="$(node --input-type=module <<'NODE'
import { createPublicClient, http, getAddress } from 'viem';

const client = createPublicClient({ transport: http(process.env.RPC_URL) });
const address = getAddress(process.env.DEAL_MANAGER_ADDRESS);
const code = await client.getBytecode({ address });
if (!code || code === '0x') {
  console.log('NO_CODE');
  process.exit(0);
}
console.log(code);
NODE
)"

if [[ "$ONCHAIN_BYTECODE_RAW" == "NO_CODE" ]]; then
  echo "ERROR: no bytecode at DEAL_MANAGER_ADDRESS on current RPC" >&2
  exit 2
fi

ONCHAIN_BYTECODE="${ONCHAIN_BYTECODE_RAW#0x}"
ONCHAIN_BYTECODE="$(echo "$ONCHAIN_BYTECODE" | tr '[:upper:]' '[:lower:]')"

LOCAL_HASH="$(echo -n "$LOCAL_BYTECODE" | sha256sum | awk '{print $1}')"
ONCHAIN_HASH="$(echo -n "$ONCHAIN_BYTECODE" | sha256sum | awk '{print $1}')"

echo "DEAL_MANAGER_ADDRESS=$DEAL_MANAGER_ADDRESS"
echo "LOCAL_RUNTIME_SHA256=$LOCAL_HASH"
echo "ONCHAIN_RUNTIME_SHA256=$ONCHAIN_HASH"

if [[ "$LOCAL_BYTECODE" == "$ONCHAIN_BYTECODE" ]]; then
  echo "OK: on-chain runtime bytecode matches current local DealManager build"
  exit 0
fi

echo "ERROR: on-chain runtime bytecode does NOT match current local DealManager build" >&2
echo "hint: likely deployed from a stale/cached deploy page or different source revision" >&2
exit 3
