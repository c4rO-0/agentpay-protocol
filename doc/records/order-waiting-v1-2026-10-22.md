# Order waiting v1 source candidate — 2026-10-22

Adds a separate generic `agentpay.order-waiting.v1` TypeScript contract, strict
validator and JSON schema to the 0.13.0 types source candidate. Explicit Unix-ms
fields disclose payment due, response-window duration, confirmed funding and
Provider response due. Funding and response timestamps are both null before
funding; both are integers afterwards. No service-specific business is embedded.

The independent object avoids changing frozen participant-order/deadlines v2 or
signed Order terms, hashes and ABIs. Existing consumer dependencies are untouched;
package packing/vendor updates, cancellation/deadline consumer integration and
release/deployment remain open. Small TypeScript compilation and positive/negative
validator tests passed. No contract compilation or chain write occurred.
