# AgentPay Service Profile v1

Status: approved public off-chain identity format in source; 2026-09-26.
The canonical types package is packed as 0.6.0 and pinned by Settlement.
The Provider registration API is implemented in Settlement source. The first
private registration returned HTTP 201; independent protected-MySQL readback
verified its service profile and active Quote target. No Quote or Order was
created by that registration. An earlier random rehearsal hash used a fixed
test label rather than this format; do not reinterpret that historical value.

A service profile identifies one Provider-served paid Skill for Registry and
Quote matching. It is separate from any author package, Market listing or
mutable offer. `skillId` remains the existing bytes32 identity of that
Provider-served Skill, chosen when registering the service; it is not the
User-installed Skill package ID or digest. Registry still qualifies the exact
`skillId + profileHash + seller` tuple.

`agentpay.service-profile.v1` has exactly eight fields: `version`, `providerId`,
`serviceId`, `mcpEndpoint`, `paymentEndpoint`, `seller`, `network`, `asset`.
`mcpEndpoint` is the challenged `.../services/<serviceId>/mcp/invoke` URL;
`paymentEndpoint` is derived from it as
`.../services/<serviceId>/agentpay/invoke`. The service ID is a single safe path
segment. URL serialization must already be canonical. HTTP and HTTPS are accepted for Provider endpoints; credentials, query and fragment
are forbidden. HTTP does not provide confidentiality or transport authentication.
This permission does not relax HTTPS requirements for platform login or credentials.
Changing the endpoint scheme changes the profile hash; existing Orders keep their
original endpoint and identity.
Seller and asset are EVM addresses; network uses canonical `eip155:<chainId>`.

Canonical bytes are UTF-8 JSON with the eight keys in lexicographic order,
no whitespace, lower-case Seller and asset addresses, and exact endpoint
strings. `profileHash = keccak256(canonical bytes)`. Unsupported or extra
fields fail closed. [Schema](../../packages/types/schemas/agentpay-service-profile-v1.schema.json),
[fixture](../../packages/types/fixtures/agentpay-service-profile-v1/records.json)
and [expected bytes/hash](../../packages/types/fixtures/agentpay-service-profile-v1/expected.json)
are the conformance examples. The TypeScript export is `canonicalizeServiceProfile`,
`hashServiceProfile` and `paymentEndpointForService` from `@agentpay/types`.

Changing Provider, endpoint, Seller, network or asset changes the hash and
requires registration/Registry qualification for the new version. Replacing a
server behind the same canonical URL does not change it. Price, `offerId`,
author package/version/digest and Market copy are excluded. Settlement still
checks a live 402 and its current admitted Quote, and Wallet/Module still check
Registry qualification independently. Endpoint control does not establish
Seller ownership by itself; production control rules remain a separate gate.

This is an additive off-chain version. It changes no existing Order,
commitment, contract ABI or Registry storage. Current Provider, Market and
User Runtime consume the prior v1 random fixture; they do not yet consume the
new profile export. Settlement's running private service consumes the 0.6.0
artifact, and one canonical service profile has been registered there. Pin the
package in further consumers
and verify the same fixture end to end. The existing 0.5.0 package is not
silently replaced on deployed services. Old profile hashes retain historical meaning;
new registrations must declare `agentpay.service-profile.v1` explicitly.

The approved product separation and proposed authenticated registration are
in the root design.
