# Protocol packages

These workspace packages expose shared protocol formats and verification helpers.
They build independently of the other AgentPay repositories. Start with the
[installation and verification guide](../doc/usage.md).

## Package map

| Package | Role |
| --- | --- |
| [types](types/README.md) | Public messages, schemas, canonical hashes, fixtures and typed contract ABIs, including Module, Registry and Authority Controller |
| [x402-escrow](x402-escrow/README.md) | Native commitment verification and provider-neutral funding evidence checks, with optional facilitator adapters |
| [x402-reference](x402-reference/README.md) | Historical direct-funding example; not the native bounded-authorization flow |
| `utils` | Small shared utilities; not a production service |

Contract deployment artifact generation is implemented separately under
`contracts/scripts/`; see the [contract guide](../contracts/README.md). Existing
local verification and dated deployment records are evidence within their recorded
scope, not proof that the current source is deployed or audited.

## Distribution and compatibility

Packages remain `private: true` to prevent accidental registry publication. Public
package distribution is still being finalized; source availability is separate
from a supported package release. See [progress](../progress.md) and
[remaining work](../doc/TODO.md).

Maintainers preserve public field, hash and ABI compatibility. Integrators consume
exported interfaces and reviewed artifacts rather than relying on reference server
internals. Independent security audit and live-network acceptance remain release
gates.
