# Generic JSON service transport v1 — types 0.12.0

Additive public contract, 2026-10-21. Existing contracts, ABIs, service profile v1,
private-request v1 and EIP-712 identities remain byte-identical. This minor release
adds service-reference, invocation and result schemas/helpers; old consumers keep
their pinned versions until deliberately updated. It does not add signer rights.

Service references contain version agentpay.service-reference.v1, skillId,
profileHash, the complete canonical service profile and an adapter discriminator.
normalizeServiceReference verifies profileHash locally; qualification remains an
independent Wallet/Module/Settlement decision. Price/offer and executable adapters
are not accepted in this reference.

JSON adapter request: version agentpay.service-invocation.v1, orderId, requestHash,
request. normalizeServiceInvocation verifies hashPrivateRequest(request), using
the existing keccak256 domain/canonical bytes. Input is JSON, at most 256 KiB,
32 nesting levels and 50000 nodes. Arrays retain order; plain object keys sort by
JavaScript UTF-16 lexical order, numbers use finite JSON number serialization.
No undefined, bigint, cycles or executable objects are allowed.

JSON adapter result: version agentpay.service-result.v1, orderId, requestHash,
output, outputHash, usageUnits. Output is JSON up to 1 MiB with the same depth
bound. For this JSON transport, outputHash retains the existing SHA-256 of
UTF-8 JSON.stringify(output), preserving application property order, without an
additional wrapper/domain. usageUnits is a canonical nonnegative integer string
of at most 77 digits. It is compared to the Order cap and accepted Receipt, not
accepted as independent billing authority. Extra fields fail normalization.
Business output shape is application-owned. Do not sort/rewrite output before
checking its evidence; other existing evidence contracts are not changed here.
Fixed independent digest vectors live in types/fixtures/agentpay-service-invocation-v1.

Providers first validate request bytes/hash, then use existing online Service
Authorization claim/decision/Receipt APIs before returning service output. Nothing
in the generic envelope proves payment or authorizes unpaid execution. Payment
still uses the existing native x402 PAYMENT-SIGNATURE and per-Order Vault flow;
private input/output do not enter Settlement. Third-party internal service design
and business input/output are unconstrained beyond the required public boundary.

Local User route/API and recovery are owned by User Runtime. They support this
JSON wire; business-specific adapter variants are prohibited. Binary streams, arbitrary custom
wire protocols and semantic quality checking are outside v1. A Provider may offer
its own asynchronous job/polling service through an appropriate Skill; this
contract does not extend an Order deadline or implement a generic async scheduler.

Version decision: new 0.12.0 exports are opt-in; User/Agent must pin matching public
archives for deployment. No schema translation, chain migration, Provider
reregistration, Safe Policy replacement or owner permission expansion is required
for unchanged qualified profiles. Actual deployment/payment acceptance is separate.
