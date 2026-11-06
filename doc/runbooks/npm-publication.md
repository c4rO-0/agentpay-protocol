# Publish the public Protocol core

The npm account scope is `c4roa0`. The first verified release is
`@c4roa0/agentpay-protocol@0.14.1`. This replaces the temporary package name
`@agentpay/types`; it does not change wire versions, hashes or contracts.
The source directory remains `packages/types`. No other workspace package is
approved for npm publication. Existing external consumers are not switched yet.

The next approved documentation-only candidate is `0.14.2`.

## Prepare and inspect

From the Protocol repository, with its pinned pnpm available:

```sh
pnpm install --frozen-lockfile
pnpm test:packages
bash scripts/prepare-npm-release.sh
```

The preparation script builds the core and packs it locally. Review the printed
file inventory and SHA-256. The archive includes compiled ESM/declarations, public
schemas, unsigned conformance fixtures, README, changelog and MIT license.
It excludes Solidity build output, source tests, historical records and services.
Independent consumer tests install actual tarballs outside the workspace and check
hashing for two business payloads, ABI/schema access and fixture availability.

## Upload — separate owner action

Only after candidate approval, authenticate locally as `c4roa0`. Never put a token
in Git, chat, shell command arguments or logs. Use npm's local credential mechanism.
Verify the account with `npm whoami --registry=https://registry.npmjs.org/`.
Publish the exact reviewed archive, not the workspace root:

```sh
npm publish artifacts/npm/c4roa0-agentpay-protocol-0.14.2.tgz --access public --registry=https://registry.npmjs.org/
```

npm versions are immutable. If that version already exists, inspect its integrity
and stop rather than overwrite or silently increment. After publication, verify
registry metadata and an independent registry install before upgrading consumers.
An npm download/install does not prove chain or payment compatibility.

## Follow-up

Switch consumer dependencies and imports one repository at a time, with their
behavior checks. Do not auto-upgrade running programs, saved Policies or Orders.
Configure GitHub trusted publishing for subsequent releases rather than keeping
a long-lived publishing token. Package semantic versions and deployment contract
addresses are different compatibility boundaries.

## Registry processing delay

An accepted publication can temporarily return 404 while npm processes it. Preserve
the successful publish output and retry metadata queries with bounded backoff. Do
not republish or increment the version to work around that delay. Verify registry
integrity and an independent registry install once the version becomes available.
