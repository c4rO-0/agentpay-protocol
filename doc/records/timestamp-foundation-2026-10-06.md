# T0 timestamp foundation — 2026-10-06

Additive types utilities validate epoch seconds/milliseconds, explicitly convert
units, require a caller-selected floor/ceil when precision would be lost, and
reject ambiguous legacy ISO input. Unknown-offset -00:00 is rejected. Invalid
calendar dates, null, NaN, unsafe integers and out-of-range values fail closed.

The types package alone compiled successfully using its installed TypeScript
compiler. Both focused tests passed under UTC, Asia/Shanghai and
America/Los_Angeles, including equivalent offset instants, leap date validation,
invalid unit inputs and rounding boundaries. The first build command incorrectly
selected the workspace compiler path; it was corrected to the types package's
installed compiler, then compiled and tested successfully.

No existing contract, signed field, hash or wire format was changed. No vendor
snapshot, database or running process was updated. This closes the source
foundation loop only; consuming runtime/interface/storage migrations need their
own evidence. UTC ISO remains an explicit compatibility adapter rather than the
target encoding for new non-chain timestamp interfaces.
