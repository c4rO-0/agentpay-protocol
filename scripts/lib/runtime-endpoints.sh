#!/usr/bin/env bash

# shellcheck shell=bash

read_dotenv_value() {
  local key="$1"
  local env_file="${2:-.env}"
  if [[ ! -f "$env_file" ]]; then
    return 1
  fi
  local line
  line="$(grep -E "^[[:space:]]*${key}=" "$env_file" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    return 1
  fi
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

resolve_mcp_server_url() {
  local env_file="${1:-.env}"
  if [[ -n "${MCP_SERVER_URL:-}" ]]; then
    printf '%s' "${MCP_SERVER_URL%/}"
    return 0
  fi
  local port="${SERVER_PORT:-}"
  if [[ -z "$port" ]]; then
    port="$(read_dotenv_value SERVER_PORT "$env_file" || true)"
  fi
  port="${port:-6471}"
  printf 'http://127.0.0.1:%s' "$port"
}

resolve_settlement_server_url() {
  local env_file="${1:-.env}"
  if [[ -n "${SETTLEMENT_SERVER_URL:-}" ]]; then
    printf '%s' "${SETTLEMENT_SERVER_URL%/}"
    return 0
  fi
  local port="${SETTLEMENT_PORT:-}"
  if [[ -z "$port" ]]; then
    port="$(read_dotenv_value SETTLEMENT_PORT "$env_file" || true)"
  fi
  port="${port:-6472}"
  printf 'http://127.0.0.1:%s' "$port"
}

