# Settlement Authority Controller v1

Status: production-candidate interface; locally verified; not audited or
deployed as a canonical Base release.

## Purpose

Each order Vault keeps one stable `settlementAuthority`. Binding that role
directly to an online executor would force every executor rotation to abandon
existing Vault authority. The non-upgradeable Controller instead remains the
Vault authority while an administrator Safe may rotate one online executor or
pause all privileged order actions.

This boundary does not decide whether delivery is valid, compute billing,
resolve a dispute, or select an order. Those are Settlement rules. It only
checks the caller's narrow role, proves that the target Vault belongs to the
immutable approved Factory and points back to this Controller, and forwards one
explicit Vault method.

## Frozen Roles And Surface

- `administrator` is an immutable contract address intended to be an official
  Safe. It may only call `setExecutor`, `pause`, and `unpause`.
- `factory` is immutable. A forwarded Vault must match `factory.getVault()` and
  report the same Factory and this Controller as its authority.
- `executor` is one rotatable operational address. It may only call
  `submitDelivery`, `release`, `refund`, and `cancelUnfunded` for approved
  Vaults while unpaused.
- `activate()` remains permissionless on the Vault and is not forwarded.
- There is no arbitrary call, delegatecall, batch, fallback authority,
  ownership transfer, proxy, or upgrade function.

The normative callable and event surface is
`settlementAuthorityControllerAbi` from `@agentpay/types`. The source contract
remains normative for behavior. The ABI version is `1.0.0`; adding authority or
changing role semantics is a breaking change even if Solidity selectors remain
compatible.

## Trust And Failure Model

| Threat or failure | Control | Remaining risk / response |
| --- | --- | --- |
| Executor compromise | Only four fixed operations; Factory/Vault provenance checked; administrator Safe can pause and rotate | A compromised executor can act on eligible Vaults before pause. Settlement monitoring and rapid Safe response remain required. |
| Administrator compromise | Administrator cannot perform order operations and cannot replace Factory or itself | It can pause indefinitely or install a malicious executor. Safe threshold, owner security, and recovery are deployment responsibilities. |
| Arbitrary target supplied by executor | Code, nonzero order, Factory registration, Vault Factory, and authority are checked | A defect in the immutable approved Factory/Vault remains in scope for contract review. |
| Old executor after rotation | `onlyExecutor` reads the current address | Already signed but not mined transactions from the old executor fail after rotation. Worker recovery must inspect chain state and re-prepare under the new executor. |
| Pause during worker activity | Every operational entrypoint checks `paused` | Prepared transactions may revert and retry after unpause; they must not be marked successful from broadcast alone. |
| Executor/Relayer role overlap | Constructor prevents administrator/executor overlap; deployment policy separates executor and Relayer | The contract cannot identify an off-chain Relayer address. Runtime config validation and independent credential files enforce that separation. |
| Replay or duplicate release/refund | Vault terminal-state checks and Settlement durable job uniqueness | Controller itself has no replay database. Consumers must reconcile Vault state and transaction receipts. |
| Malicious billing values | Vault amount/fee/terminal constraints | Settlement owns quote-derived billing; the Controller does not attest price or quality. |
| Upgrade or storage takeover | Non-upgradeable contract with immutable administrator and Factory | A new version requires a new Controller and only affects newly created Vaults unless existing Vault rules explicitly permit change (v1 does not). |
| Chain/RPC ambiguity | Deterministic signed transaction persistence and receipt/state recovery belong to Settlement workers | Broadcast success is not finalization evidence. |

## Deployment And Verification Requirements

A deployment record must validate against
`settlement-authority-controller-deployment-v1.schema.json` and record the
network, Controller, administrator Safe, Factory, initial executor, full source
commit, deployment transaction, compiler settings, creation/runtime bytecode
hashes, ABI version, and honest audit status. Fixture values are test data and
must never be treated as deployed addresses.

Before marking a deployment canonical:

1. reproduce the exact compiler settings and bytecode hashes from the source
   commit;
2. confirm the administrator and Factory are contracts on the target chain;
3. confirm administrator, executor, Relayer, fee recipient, and seller roles do
   not unintentionally overlap;
4. run provenance rejection, pause/unpause, executor rotation, removed-executor
   rejection, delivery, release, refund, and cancellation conformance tests;
5. record audit status as `not-audited` until an actual review is complete;
6. keep private keys and customer-linked records outside release artifacts.

## Proven Evidence And Open Gates

Focused Foundry tests cover constructor role checks, approved-Vault forwarding,
foreign Factory/Vault rejection, lack of arbitrary calldata, pause behavior,
role non-escalation, executor rotation, and permissionless activation remaining
outside the Controller. The official Safe v1.4.1 Anvil flow covers Safe
administration, old-executor rejection, pause recovery, release/refund, and
unchanged existing Vault authority. Settlement process tests additionally cover
prepared/broadcast crash recovery and concurrent executor nonce serialization.

Base-fork reproduction, a canonical Base deployment manifest, external audit,
and the controlled Base canary remain open. Local evidence must not be described
as an audit or production deployment.

## Local Release Artifact Record

The first reviewed local consumer release was built from Protocol commit
`ad12024429e15657ee5242236560115646e00745`:

- `@agentpay/types` `0.3.0`:
  `ff8bb6f0bb6306d18c7662dab293e26c6202f597cfc9b49e4e9f8754a3a7deef`;
- `@agentpay/x402-escrow` `0.3.0`:
  `ef96ccbe908819c9be36d96a357325681f0c50af2408cebd5a7589e2fdb0b47f`.

These are local `.tgz` SHA-256 values, not registry publication identifiers.
Settlement pins and verifies both packages; Wallet pins and verifies the types
package containing the Controller ABI. Neither package is public or audited.
