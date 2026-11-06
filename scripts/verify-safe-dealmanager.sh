#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
CONTRACTS_DIR="$(cd -- "$SCRIPT_DIR/../contracts" && pwd)"

/usr/bin/docker run --rm --entrypoint sh   -v "$CONTRACTS_DIR:/src:ro"   ghcr.io/foundry-rs/foundry:latest   -lc 'rm -rf /tmp/work && cp -R /src /tmp/work && cd /tmp/work && forge test -vvv --match-test test_bindBothSafeParties_transitionsToReady'
