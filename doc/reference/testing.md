# Functional verification

Use the commands in [usage](../usage.md). Test behavior at public boundaries;
only retain lower-level cases with distinct security, protocol or financial value.

| Previous coverage | Disposition |
| --- | --- |
| build-and-test plus conformance CI | One package job; avoid duplicate installation, build and tests |
| x402-reference test is node --check | Removed test alias; syntax remains part of build |
| Escrow LifecycleHarness sets its own state | Removed after real Anvil transaction replacement passed |
| Controller ABI against compiled Solidity | Chain job after Forge compilation; package-only tests need no contracts/out |
| Signature/hash/schema/time/amount/permission cases | Retain: public input/output and adversarial boundaries, not private implementation layout |
| Solidity authorization, cancellation, Controller and replay cases | Retain: negative boundaries complement the Anvil happy/terminal paths |
| Fork tests requiring BASE_RPC_URL | Explicit manual workflow; no hidden dependency in default PR checks |

The temporary consumer installs actual tarballs outside the checkout. It does not
use workspace source symlinks and does not imply full cross-repository acceptance.
The native lifecycle owns its disposable Anvil, accepts no RPC override and sends
real signed transactions through JSON-RPC. It uses FlowSafe, the maintained test
fixture; no production Safe, platform server, database or crash-recovery claim.

Do not delete tests merely to reduce the count or replace them with source-string
assertions. The synthetic harness was removed after observing the replacement pass on 2026-11-06.
No CI task publishes packages, deploys to a live network or uses a real private key.
