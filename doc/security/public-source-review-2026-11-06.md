# Public source review — 2026-11-06

Scope: current tracked Protocol source, documentation, fixtures, scripts, configuration
examples and publication metadata. The owner chose a single-commit replacement of
main; old history is not the public release review target. This is repository hygiene,
not an independent contract/security audit or real-funds readiness claim.

## Findings and disposition

- MIT LICENSE exists; public source does not require changing package private flags.
- No actual credential was identified in current-file pattern checks and inspection
  of matches. CDP credential examples are placeholders; the repeated-a test key and
  zero signature are deliberately synthetic fixtures. This bounded review cannot
  prove the absence of all possible secrets.
- No tracked private environment/key/token file was found. The tracked .env.example
  uses examples/empty fields. Public addresses, transaction hashes and dated chain
  evidence are not private credentials.
- The two CDP probe shell wrappers used the parent workspace's private Node path;
  they now use PATH or explicit NODE_BIN. Optional CDP experiments still require
  separately supplied protected configuration; normal public types builds do not.
- The deployment record is historical escrow evidence, not a current full-platform
  deployment. Old source hashes are preserved, not rewritten to the initial snapshot.
- README distinguishes public source, local artifact generation, future package
  publication and chain deployment. No consumer dependency/channel changed.
- Security policy now includes the operator-confirmed private contact email.
- Remote inspection before replacement found only main and no tags. Rewrite uses
  the observed remote head as a force-with-lease guard against concurrent changes.

## Checks

- Public types TypeScript build passed using Node 22.22.3 and installed locked dependencies.
- Public types tests: 14 passed, zero failures.
- Both changed shell wrappers passed bash syntax checks; diff whitespace check passed.
- No Forge run, full build, clean-network install or deployment was performed.
- Anonymous GitHub API returned 404 before visibility change. Verify anonymous
  clone/API access after the owner enables public visibility.

The source-history replacement removes old commits from the advertised main history;
it does not promise deletion from existing clones, provider retention or external
references. Local rollback evidence stays outside Git. Future contributors should
use a fresh clone and must not merge old history back into main.
