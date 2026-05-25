# Refactor Staff Payments Route Resolve

## Resolved decisions

| Topic | Decision |
| --- | --- |
| Active spec | `docs/specs/refactor-staff-payments-route/` is the source of truth for this refactor thread. |
| Parser responsibility | `payments-request.ts` parses query params and validates mode-specific request state only. |
| Temporal responsibility | `payments-time.ts` computes NY today boundaries separately. |
| Type model | Use a discriminated union keyed by `mode` for successful request states. |
| Non-null assertions | Do not use `historyRange!`; expose `historyFrom`/`historyTo` in the narrowed route branch. |
| Next slice | Do not continue to query building or response mapping until Phase 1 passes tests and typecheck. |
