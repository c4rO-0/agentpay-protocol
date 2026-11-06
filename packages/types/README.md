# AgentPay Protocol

Build integrations for AI agents that purchase services within a user-approved
budget. This package provides the shared types, data validation, hashes and contract
ABIs used by AgentPay components to agree on requests and payments.

AgentPay uses a Safe smart-contract wallet to hold funds and enforce spending limits. Once its
owner grants bounded permission, eligible purchases can proceed without another
owner signature for each order.

## Who is this for?

Developers building Wallet, Provider or platform integrations. If you just want to
use AgentPay, start with [AgentPay User](https://github.com/c4rO-0/agentpay-user)
instead of installing this library separately.

## Install

With Node.js and npm installed, run this in your application directory:

```bash
npm install @c4roa0/agentpay-protocol
```

The package provides ES modules and TypeScript declarations. You do not need to
clone the Protocol repository to use it.

## Try it: hash a service request

A request hash lets components refer to the same input without sending its contents
to Settlement, the service that coordinates payments. Save this as `example.mjs`
in the directory where you installed the package:

```js
import { hashPrivateRequest } from '@c4roa0/agentpay-protocol';

const request = {
  text: 'Hello, world!',
  targetLanguage: 'fr',
};

const requestHash = hashPrivateRequest(request);
console.log(requestHash); // 0x followed by 64 hexadecimal characters
```

Run it:

```bash
node example.mjs
```

This computes the hash locally; it does not create an order, contact a service or
make a payment. The input is an example of application-owned JSON, not a required
service format. Hashing is not encryption; avoid publishing hashes of sensitive,
easily guessed inputs. See the
[request binding notes](https://github.com/c4rO-0/agentpay-protocol/blob/main/doc/reference/public-package-api.md#native-private-request-and-participant-order-v1)
for integration requirements.

## What is included?

| Capability | Use it to |
| --- | --- |
| TypeScript types | Describe service profiles, payment commitments and order records |
| Validation and normalization | Check supported message formats and timestamp representations |
| Canonical hashes | Bind requests, service profiles and payment terms consistently |
| Contract ABIs | Integrate with the Spending Module, Registry, Factory, Vault and Authority Controller |
| JSON schemas and fixtures | Validate messages and check interoperability in other languages |

The library does not store keys, sign payments, operate a Provider or run
Settlement. Its validation helpers do not replace authorization or on-chain checks.

## Documentation

- [API notes](https://github.com/c4rO-0/agentpay-protocol/blob/main/doc/reference/public-package-api.md) — helpers, schemas and compatibility details.
- [Architecture](https://github.com/c4rO-0/agentpay-protocol/blob/main/doc/architecture.md) — payment flow and component responsibilities.
- [Protocol documentation](https://github.com/c4rO-0/agentpay-protocol/blob/main/doc/README.md) — message specifications and contract guides.
- [Changelog](https://github.com/c4rO-0/agentpay-protocol/blob/main/packages/types/CHANGELOG.md) — version history.

## Contributing and security

Contributions are welcome. Start with the
[contributor guide](https://github.com/c4rO-0/agentpay-protocol/blob/main/doc/reference/CONTRIBUTING.md).
Report vulnerabilities through the
[security policy](https://github.com/c4rO-0/agentpay-protocol/blob/main/SECURITY.md).

The protocol has not completed an independent security audit. Package availability
and local tests do not establish readiness for real funds.

[MIT license](https://github.com/c4rO-0/agentpay-protocol/blob/main/LICENSE).
