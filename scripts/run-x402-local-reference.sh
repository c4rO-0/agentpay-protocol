#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v forge >/dev/null || { echo "forge is required" >&2; exit 1; }
command -v anvil >/dev/null || { echo "anvil is required" >&2; exit 1; }
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
cd "$ROOT"
anvil --silent >"${TMPDIR:-/tmp}/agentpay-x402-anvil.log" 2>&1 &
ANVIL_PID=$!
trap 'kill "$ANVIL_PID" 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do curl -fsS -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' http://127.0.0.1:8545 >/dev/null && break; sleep 0.1; done
forge build --root contracts
RPC_URL=http://127.0.0.1:8545 pnpm --filter @agentpay/x402-reference start
