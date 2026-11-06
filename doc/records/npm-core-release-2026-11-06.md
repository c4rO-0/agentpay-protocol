# First public core npm release — 2026-11-06

- Package: `@c4roa0/agentpay-protocol@0.14.1`, public access, npm account `c4roa0`.
- Reviewed archive: `c4roa0-agentpay-protocol-0.14.1.tgz`, 77 files.
- SHA-256: `a61caa6c6e242d01104bf2d7ef2d5d4b2101a88d8e003d018126ff63a0e7265d`.
- npm accepted upload; immediate version lookup returned 404 during processing.
- A separate verification run matched registry SHA-512 integrity to the local
  reviewed archive, then installed the exact version in a temporary project.
- Public imports, request hashing with two distinct business payloads, Spending
  Module ABI, exported schema and installed conformance fixture checks passed.
- Registry installation disabled dependency lifecycle scripts. Temporary install
  and credential files were removed by the respective runners; no Token is recorded.

This verifies public package consumption, not consumer upgrades, on-chain behavior,
production readiness or trusted-publishing setup. Other workspace packages remain
private; external repositories retain their existing dependencies until reviewed.

## Documentation patch 0.14.2

Owner execution published 0.14.2. Registry integrity matches archive SHA-256
`c537593175253b66c32ce4f78048c712f1a3ddc10c848e578c8b0ff52bd41af5`.
Separate public metadata verification confirmed `latest=0.14.2` and the registry
README matches the revised package guide. Local independent tarball consumption
passed before upload; archive comparison confirmed only README, CHANGELOG and
package version changed from 0.14.1. No external consumer upgrade is implied.
