#!/usr/bin/env bash
set -euo pipefail

MARKET_API_BASE_URL="${MARKET_API_BASE_URL:-http://127.0.0.1:6473}"
PAYLOAD_FILE="${1:-}"

if [[ -n "$PAYLOAD_FILE" ]]; then
  if [[ ! -f "$PAYLOAD_FILE" ]]; then
    echo "[publish-local-market] payload file not found: $PAYLOAD_FILE" >&2
    exit 1
  fi
  payload="$(cat "$PAYLOAD_FILE")"
else
  payload="$(bash "$(dirname "$0")/generate-market-publish-payload.sh")"
fi

echo "[publish-local-market] POST ${MARKET_API_BASE_URL}/publish"
curl -sS -X POST "${MARKET_API_BASE_URL}/publish" \
  -H "content-type: application/json" \
  -d "$payload"

echo
