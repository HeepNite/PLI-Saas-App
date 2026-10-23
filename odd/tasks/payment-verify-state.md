# payment-verify-state

Locator: `odd/tasks/payment-verify-state.md` (Engram mirror: `odd/payment-verify-state/tasks`)
Spec: `docs/specs/payment-attempt-visibility/{requirements.md,analysis.md}` (decisions D1-D4)
Branch: `feat/payment-verify-state` (base `origin/main`)

## Objective
Every card process that did not charge enters a visible "Verify" state that is NOT debt.
Only pending cash is outstanding balance. Verify items are resolved manually only (D4).

## Problem
- Native M2 `payment_intent.payment_failed` / `payment_intent.canceled` are acknowledged with a log only; no reason is stored.
- Failed/expired/cancelled card rows count as debt; slot dedup silently drops failed attempts when a paid row exists.

## Scope
- S1 (server): capture native M2 card failures in the webhook; relax idempotent reuse to fulfillment keys only.
- S2 (server): one verify predicate; balance excludes verify; verify amount per user; row verify flag + reason; dedup keeps verify attempts visible.
- S3-S6 (later): UI pill/filter/yellow daily, manual resolve actions, history timeline, terminal outcome endpoint.

## Constraints
- No schema migration; metadata only (`stripeFailure`, future `attemptOutcome`).
- No new card data; provider message capped. No auto-resolution.
- Cash pending behavior unchanged. Succeeded fulfillment unchanged except accepting a previously failed attempt on the same PaymentIntent.

## TDD
Mode: strict (explicit user instruction). Runner: `npx vitest run`.

## Tasks
- [ ] S1 Capture native M2 card failures (webhook + prepared purchase reuse)
- [ ] S2 Verify predicate, no-hide dedup, balance exclusion, row verify flag/reason
- [ ] S3 UI: Verify pill, Status filter option, yellow daily amount
- [ ] S4 Manual resolve actions (Collected / Dismiss) with audit
- [ ] S5 Payment history timeline
- [ ] S6 Terminal outcome endpoint (`metadata.attemptOutcome`)

## Acceptance criteria
- Native failed/canceled events record status + allowlisted `stripeFailure` while pending, idempotently.
- Customer retry after a decline still works (reuse + later success fulfills).
- Verify attempts never count toward outstanding balance; pending cash does.
- Verify attempts stay visible next to a paid row for the same slot and are excluded from revenue.

## Applicable checks
`npx vitest run tests/api tests/checkin components/front/staff`, `npx tsc --noEmit -p .`, `npx eslint <changed>`, `npx next build`, `git diff --check`.

## Progress
- Baseline: 263 files / 2633 tests passed on origin/main.

## Next step
S1.
