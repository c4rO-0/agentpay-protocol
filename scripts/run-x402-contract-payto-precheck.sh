#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTOCOL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROTOCOL_DIR"

: "${X402_FACILITATOR_URL:=https://x402.org/facilitator}"
: "${X402_NETWORK:=eip155:8453}"
: "${X402_ASSET:=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913}"
: "${X402_PAY_TO:=0x4200000000000000000000000000000000000006}"
: "${X402_AMOUNT:=1000}"
: "${X402_MAX_TIMEOUT_SECONDS:=300}"

if [[ -z "${X402_FACILITATOR_PROVIDER:-}" ]]; then
  if [[ -n "${CDP_API_KEY_ID:-}" && -n "${CDP_API_KEY_SECRET:-}" ]]; then
    X402_FACILITATOR_PROVIDER="cdp"
  else
    X402_FACILITATOR_PROVIDER="http"
  fi
fi

if [[ "${X402_FACILITATOR_PROVIDER}" == "cdp" && "${X402_FACILITATOR_URL}" == "https://x402.org/facilitator" ]]; then
  X402_FACILITATOR_URL="https://api.cdp.coinbase.com/platform/v2/x402"
fi

if [[ -z "${RPC_URL:-}" ]]; then
  if [[ -n "${ALCHEMY_API_KEY:-}" ]]; then
    RPC_URL="https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}"
  else
    RPC_URL="https://mainnet.base.org"
  fi
fi

NODE_BIN="${NODE_BIN:-node}"
PNPM_BIN="${PNPM_BIN:-pnpm}"

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node.js 18+ or set NODE_BIN." >&2
  exit 1
fi

if ! command -v "$PNPM_BIN" >/dev/null 2>&1; then
  echo "pnpm was not found. Install pnpm or set PNPM_BIN." >&2
  exit 1
fi

if [[ "${X402_SKIP_SUPPORTED_CHECK:-0}" != "1" ]]; then
  export X402_FACILITATOR_URL X402_NETWORK X402_FACILITATOR_PROVIDER
  "$NODE_BIN" --input-type=module -e '
    import { CDP_FACILITATOR_URL, createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
    import { HTTPFacilitatorClient } from "@x402/core/http";

    const network = process.env.X402_NETWORK;
    const provider = process.env.X402_FACILITATOR_PROVIDER;
    const url = (process.env.X402_FACILITATOR_URL || CDP_FACILITATOR_URL).replace(/\/+$/, "");
    const facilitator = provider === "cdp"
      ? createCdpFacilitatorClient({ baseUrl: url })
      : new HTTPFacilitatorClient({ url });
    const supported = await facilitator.getSupported();
    const ok = Array.isArray(supported.kinds)
      && supported.kinds.some(kind =>
        kind?.x402Version === 2 && kind?.scheme === "exact" && kind?.network === network
      );
    if (!ok) {
      console.error(`Facilitator does not support x402 v2 exact on ${network}.`);
      console.error("Supported kinds:");
      for (const kind of supported.kinds || []) {
        console.error(`- v${kind.x402Version} ${kind.scheme} ${kind.network}`);
      }
      process.exit(2);
    }
  '
fi

if [[ -z "${X402_BUYER_PRIVATE_KEY:-}" ]]; then
  printf "X402_BUYER_PRIVATE_KEY: " >&2
  IFS= read -r -s X402_BUYER_PRIVATE_KEY
  printf "\n" >&2
fi

if [[ ! "$X402_BUYER_PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "X402_BUYER_PRIVATE_KEY must be a 0x-prefixed 32-byte private key" >&2
  exit 1
fi

export X402_FACILITATOR_URL
export X402_NETWORK
export X402_ASSET
export X402_PAY_TO
export X402_AMOUNT
export X402_MAX_TIMEOUT_SECONDS
export X402_FACILITATOR_PROVIDER
export RPC_URL
export X402_BUYER_PRIVATE_KEY

echo "Running x402 verify-only contract payTo precheck"
echo "provider:    $X402_FACILITATOR_PROVIDER"
echo "facilitator: $X402_FACILITATOR_URL"
echo "network:     $X402_NETWORK"
echo "asset:       $X402_ASSET"
echo "payTo:       $X402_PAY_TO"
echo "amount:      $X402_AMOUNT"
echo "rpc:         $RPC_URL"
echo

"$PNPM_BIN" x402:verify-contract-payto
