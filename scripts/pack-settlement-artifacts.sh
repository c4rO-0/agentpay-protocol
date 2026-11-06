#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${1:-$repo_dir/artifacts/settlement}"
types_version="$(node -p "require('$repo_dir/packages/types/package.json').version")"
escrow_version="$(node -p "require('$repo_dir/packages/x402-escrow/package.json').version")"

if command -v pnpm >/dev/null 2>&1; then
  pnpm_command=(pnpm)
elif command -v corepack >/dev/null 2>&1; then
  pnpm_command=(corepack pnpm)
else
  echo "pnpm or corepack is required" >&2
  exit 1
fi

mkdir -p "$output_dir"
output_dir="$(cd "$output_dir" && pwd)"

cd "$repo_dir"
"${pnpm_command[@]}" --filter @c4roa0/agentpay-protocol build
"${pnpm_command[@]}" --filter @agentpay/x402-escrow build

for package_dir in packages/types packages/x402-escrow; do
  (
    cd "$repo_dir/$package_dir"
    "${pnpm_command[@]}" --ignore-workspace pack --pack-destination "$output_dir"
  )
done

sha256sum \
  "$output_dir/c4roa0-agentpay-protocol-$types_version.tgz" \
  "$output_dir/agentpay-x402-escrow-$escrow_version.tgz"
