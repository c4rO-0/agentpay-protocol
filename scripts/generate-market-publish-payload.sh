#!/usr/bin/env bash
set -euo pipefail

OUTPUT_PATH="${1:-}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${ROOT_DIR}/scripts/lib/runtime-endpoints.sh"
DEFAULT_MCP_SERVER_URL="$(resolve_mcp_server_url "${ROOT_DIR}/.env")"

MCP_SERVICE_ID="${PUBLISH_MCP_SERVICE_ID:-service.random-tool}"
NAME="${PUBLISH_NAME:-Paid Random Number}"
SUMMARY="${PUBLISH_SUMMARY:-Generate a random number through the deal and ticket flow.}"
DESCRIPTION="${PUBLISH_DESCRIPTION:-Generate a random number through the deal and ticket flow.}"
DESCRIPTION_MARKDOWN="${PUBLISH_DESCRIPTION_MARKDOWN:-## Overview\nGenerate a random number through the deal and ticket flow.}"
PROVIDER="${PUBLISH_PROVIDER:-provider.local.demo}"
MCP_ENDPOINT="${PUBLISH_MCP_ENDPOINT:-${DEFAULT_MCP_SERVER_URL}/mcp/invoke}"
PRICING_MODEL="${PUBLISH_PRICING_MODEL:-hybrid}"
PRICING_VERSION="${PUBLISH_PRICING_VERSION:-v1}"
SETTLEMENT_ASSET="${PUBLISH_SETTLEMENT_ASSET:-USDC}"
BASE_AMOUNT="${PUBLISH_BASE_AMOUNT:-30000}"
MAINTAINER_NAME="${PUBLISH_MAINTAINER_NAME:-demo-maintainer}"
MAINTAINER_CONTACT="${PUBLISH_MAINTAINER_CONTACT:-demo@example.com}"
DEVELOPER_ID="${PUBLISH_DEVELOPER_ID:-}"

json_escape() {
  local value="${1//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/ }"
  printf '%s' "$value"
}

build_json() {
  local maybe_developer=""
  if [[ -n "$DEVELOPER_ID" ]]; then
    maybe_developer="\n  \"developerId\": \"$(json_escape "$DEVELOPER_ID")\","
  fi

  cat <<JSON
{${maybe_developer}
  "mcpServiceId": "$(json_escape "$MCP_SERVICE_ID")",
  "name": "$(json_escape "$NAME")",
  "summary": "$(json_escape "$SUMMARY")",
  "description": "$(json_escape "$DESCRIPTION")",
  "descriptionMarkdown": "$(json_escape "$DESCRIPTION_MARKDOWN")",
  "provider": "$(json_escape "$PROVIDER")",
  "mcpEndpoint": "$(json_escape "$MCP_ENDPOINT")",
  "pricing": {
    "pricingModel": "$(json_escape "$PRICING_MODEL")",
    "pricingVersion": "$(json_escape "$PRICING_VERSION")",
    "settlementAsset": "$(json_escape "$SETTLEMENT_ASSET")",
    "baseAmount": "$(json_escape "$BASE_AMOUNT")"
  },
  "tags": ["demo", "mcp", "paid"],
  "keywords": ["random", "number", "deal", "ticket"],
  "maintainer": {
    "name": "$(json_escape "$MAINTAINER_NAME")",
    "contact": "$(json_escape "$MAINTAINER_CONTACT")"
  }
}
JSON
}

payload="$(build_json)"

if [[ -n "$OUTPUT_PATH" ]]; then
  printf '%s\n' "$payload" > "$OUTPUT_PATH"
  echo "[generate-market-publish-payload] wrote: $OUTPUT_PATH"
else
  printf '%s\n' "$payload"
fi
