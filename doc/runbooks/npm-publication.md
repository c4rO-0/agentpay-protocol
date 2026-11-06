# Publish the public Protocol core

Use the **Publish Protocol to npm** GitHub Action to publish
`@c4roa0/agentpay-protocol`. It uses npm Trusted Publishing, so no npm Token or
GitHub secret is required. Only the core in `packages/types` is published.

## One-time setup

On the GitHub repository, open **Settings → Environments** and create
`npm-publish`. Under deployment branches/tags, allow only the `main` branch.
Environment names must match exactly. Add required reviewers if your team needs
an approval gate; creating an environment alone does not add approval protection.

On the npm package's **Settings → Trusted Publisher**, configure:

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | `c4rO-0` |
| Repository | `agentpay-protocol` |
| Workflow filename | `publish.yml` |
| Environment name | `npm-publish` |
| Allowed actions | Allow `npm publish`; separate dist-tag management is not needed |

The workflow must be pushed before it can run. New npm connections must complete
an initial successful publication within the deadline shown in npm Settings.
See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

## Release a version

1. Update `packages/types/package.json` and its changelog with a new stable version.
   Review the code, package contents and compatibility impact. Push reviewed changes
   to `main`; this runs CI but does **not** publish anything.
2. In GitHub, open **Actions → Publish Protocol to npm → Run workflow**.
3. Choose `main` and enter the exact package version, such as `0.14.3`.
4. Run the workflow and, if configured, approve its environment deployment.

The workflow installs from the lockfile, runs package checks and the local Anvil
payment lifecycle, packs the core, then publishes that archive. Any check failure
blocks upload. Node and npm support OIDC; publishing runs on a GitHub-hosted runner.
No production chain or deployed platform services are contacted by these tests.

Success ends with **Verify public registry integrity**. npm also generates package
provenance for this public repository. Confirm the version on npm and that the
Trusted Publisher changes from pending to validated after the first release.
Then select **Require two-factor authentication and disallow bypass 2fa tokens**
in npm Publishing access and revoke the old publishing Token if no longer needed.

## If a run fails

- Before upload: fix the error and rerun the workflow for the reviewed commit.
- After upload: check the logs and public version before rerunning. npm can accept
  a publication before the version becomes queryable; verification retries for this
  reason. Do not publish again or bump versions merely to bypass a query delay.
- Existing version: npm versions are immutable. A repeat upload must fail; inspect
  the existing version rather than overwrite it.
- Authentication: verify all npm fields match the table, direct publishing is allowed,
  and the connection has not expired. Do not add a token as a silent fallback.

To repeat only the public integrity check with the original built archive:

```sh
node scripts/verify-npm-release.mjs artifacts/npm/c4roa0-agentpay-protocol-0.14.3.tgz 0.14.3
```

## Inspect an archive locally

```sh
pnpm install --frozen-lockfile
pnpm test:packages
bash scripts/prepare-npm-release.sh
```

The script prints the file inventory and SHA-256 without publishing. The archive
contains compiled ESM/declarations, public schemas, conformance fixtures, README,
changelog and MIT license. Deployment artifacts, services and historical records
are excluded. A package release does not upgrade consumers or saved Policies/Orders.
Verify each consumer upgrade separately.
