#!/usr/bin/env bash
# Prepare a reviewable local artifact; this script never publishes or authenticates.
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"
pnpm --filter @c4roa0/agentpay-protocol build
mkdir -p artifacts/npm
(cd packages/types && pnpm --ignore-workspace pack --pack-destination ../../artifacts/npm)
version="$(node -p "require('./packages/types/package.json').version")"
archive="artifacts/npm/c4roa0-agentpay-protocol-$version.tgz"
tar -tzf "$archive"
node --input-type=module - "$archive" <<'JS'
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const file = process.argv[2];
console.log('SHA-256:', createHash('sha256').update(readFileSync(file)).digest('hex'));
console.log('Prepared:', file, '\nNot uploaded. Review the archive before publishing.');
JS
