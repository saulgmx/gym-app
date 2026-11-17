# Architecture test fixtures

A miniature `src/` with one file per rule. `violates-*` files must be reported by the rule
named in the test; `valid-*` files must produce no findings. Excluded from the normal lint,
typecheck and Prettier runs. Used by `tests/architecture/*.test.ts` (spec 000, AC-3 to AC-9).
