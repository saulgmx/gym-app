# Architecture test fixtures

A miniature `src/` with one file per rule. `violates-*` files must be reported by the rule
named in the test; `valid-*` files must produce no findings. `src/shared/ui/tokens.css` is the
one exception to the naming: it must pass because it is the only file allowed to declare literal
colors. Excluded from the normal lint, typecheck and Prettier runs. Used by
`tests/architecture/*.test.ts` (spec 000, AC-3 to AC-9 and AC-27).
