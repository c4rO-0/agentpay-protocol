#!/usr/bin/env bash
set -euo pipefail
set +x

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTOCOL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${AGENTPAY_ENV_FILE:-/etc/agentpay/agentpay.env}"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "[cdp-agentpay-verify] cannot read $ENV_FILE; run with sudo/root" >&2
  exit 1
fi

if [[ ! -x "$NODE_BIN" ]]; then
  echo "[cdp-agentpay-verify] Node.js is not executable: $NODE_BIN" >&2
  exit 1
fi

cd "$PROTOCOL_DIR"
exec "$NODE_BIN" scripts/cdp-agentpay-binding-verify-probe.mjs "$ENV_FILE"
