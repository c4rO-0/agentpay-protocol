# Security Policy

## Supported Versions

Security fixes are made against the latest release and the `main` branch. The
repository has not yet completed an independent security audit. Do not treat
the contracts or reference services as audited production infrastructure.

## Reporting a Vulnerability

Do not open a public issue for a suspected vulnerability and do not include
secrets, private keys, exploit payloads, or affected user data in public
discussion.

Use this repository's GitHub **Report a vulnerability** action to submit a
private security advisory. Include:

- the affected commit, release, contract, or protocol version;
- impact and required attacker capabilities;
- reproducible steps or a minimal proof of concept;
- any known workaround or mitigation;
- whether the issue has been disclosed elsewhere.

Maintainers will acknowledge a valid private report through the advisory and
coordinate remediation and disclosure there. If private vulnerability
reporting is unavailable, email [agentpay@mail.c4r.fun](mailto:agentpay@mail.c4r.fun).
Do not send private keys, credentials or user data.

## Scope

Reports about contract authorization, escrow state transitions, fund loss,
signature or replay handling, payment evidence validation, and secret exposure
are in scope. Production services and operator configuration outside this
repository are owned and reported through their respective projects.
