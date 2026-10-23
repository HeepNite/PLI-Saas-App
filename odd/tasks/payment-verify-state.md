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
- [x] S1 Capture native M2 card failures (webhook + prepared purchase reuse) — commit f96fa8ac (route: delegated writer)
- [x] S2 Verify predicate, no-hide dedup, balance exclusion, row verify flag/reason — commit 1e848273 (route: delegated writer)
- [x] S3 UI: Verify pill, Status filter option, yellow daily amount — commit 878c1e7a (route: delegated writer, resumed from interrupted diff)
- [x] S4 Manual resolve actions (Collected / Dismiss) with audit — commits 09f2b307 (API) + 734174bb (UI) (route: delegated writer)
- [x] D5 Pending is cash-only: uncharged card attempts (verify or resolved) out of the Pending pill/filter and API pendingStripe — commit b0c35a8a (route: direct, single writer)
- [x] D5 extension: in-progress card processes are Verify (`in_progress`); Reports card metric reflects Verify — commit ea4ce8ca (route: direct, single writer)
- [ ] S5 Payment history timeline (includes exposing `metadata.paymentAttempts` on payment rows; not exposed yet)
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
- S1 RED: 12 failing (webhook record/idempotency/succeeded-after-decline, normalizer, annotation strip, reuse/reopen, backend retry). GREEN: all pass.
- S2 RED: 27 failing (predicate, balances, latest-open, reason keys, row flags, route verify/dedup/summary). GREEN: all pass.

- Post-S2 commits: attempt log 97ba5446, retry after cancel 08d635ef, 24 h daily verify window server-side 63e9abef.
- S3 RED: 9 failing (filter verify-only, monthly summary verify totals, 24 h verify amount helper, pill order/count/amount/yellow, Status Verify option, daily card yellow within 24 h and hidden after, red debt excludes verify, board pill counts each verify row once and revenue excludes it). GREEN: all pass.

- S4 RED: API 8 failing (not-verify 409 x2, collected via cash path + audit, package sync on collect, dismiss reason required/kept status, idempotent, conflicting resolution, concurrent claim) + 4 predicate/row/route (dismissed out of verify and debt, readVerifyResolution allowlist, row exposes resolution, dismissed stays visible next to paid slot outside verify totals); UI 7 failing (no actions on non-verify, buttons + amount/reason, collected confirm, dismiss needs reason, error kept, resolved labels, card shows actions only on verify rows). GREEN: all pass.

- D5 RED: 8 failing (filter pending excludes verify/dismissed/collected and collected matches paid; API pendingStripe excludes verify x4, expired-next-to-paid, dismissed; board Pending pill cash-only). GREEN: all pass.

- D5 ext RED: 7 failing (in_progress reason x3, open checkout verify + success leaves, UI label, reports metric verify-only, reports label). GREEN, plus 2 existing route assertions updated to D5 (pending card next to paid slot now visible as Verify; old pending card no longer debt).

## Verification evidence (after D5 extension)
- `npx vitest run tests/api tests/checkin components/front/staff tests/reports-suggestions-provider.test.ts`: 267 files / 2706 tests passed. Full `npx vitest run`: only `tests/integration/prisma-security.test.ts` fails (needs DATABASE_URL; not run against DB by instruction).
- `npx tsc --noEmit -p .`: exit 0.
- `npx eslint <changed files>`: 0 errors (1 pre-existing warning).
- `npx next build`: exit 0.
- `git diff --check`: clean.

## Verification evidence (after D5)
- `npx vitest run tests/api tests/checkin components/front/staff`: 266 files / 2698 tests passed.
- `npx tsc --noEmit -p .`: exit 0.
- `npx eslint <changed files>`: 0 errors (1 pre-existing warning, tests/api/staff-payments.test.ts:14).
- `npx next build`: exit 0.
- `git diff --check`: clean.

## Verification evidence (after S4)
- `npx vitest run tests/api tests/checkin components/front/staff`: 266 files / 2696 tests passed.
- `npx tsc --noEmit -p .`: exit 0.
- `npx eslint <changed files>`: 0 errors (1 pre-existing warning, tests/api/staff-payments.test.ts:14 `_args`).
- `npx next build`: exit 0.
- `git diff --check`: clean.

## Verification evidence (after S3)
- `npx vitest run tests/api tests/checkin components/front/staff`: 264 files / 2674 tests passed.
- `npx tsc --noEmit -p .`: exit 0.
- `npx eslint <changed files>`: exit 0, no output.
- `npx next build`: exit 0.
- `git diff --check`: clean.

## Verification evidence (after S2)
- `npx vitest run tests/api tests/checkin components/front/staff` + S1 lib tests: 266 files / 2728 tests passed.
- `npx tsc --noEmit -p .`: exit 0.
- `npx eslint <changed files>`: 0 errors (2 pre-existing warnings in untouched lines).
- `npx next build`: exit 0.
- `git diff --check`: clean.

## Accepted design notes
- Attempt annotations (`stripeFailure`, `attemptOutcome`, `verifyResolution`) are excluded from the prepared fulfillment selection everywhere it is compared or digested (webhook, terminal backend, idempotent reuse).
- A failed prepared Purchase is reopened to pending on re-prepare; a later success on the same PaymentIntent fulfills from `failed`. Canceled stays terminal (re-prepare returns 409).
- All non-completed native M2 preparations are verify (including pending with a bound PaymentIntent), per D1.
- Summary keeps `pendingStripe` unchanged; `verifyItems`/`verifyAmount` added for S3.

- S3: the Verify pill counts verify rows (items), Pending keeps counting students; client Pending filter/pill still include unpaid card rows that are also verify (unchanged per D3 "existing pills stay"). Superseded by D5 (b0c35a8a).
- S3: yellow daily amount renders only on the daily card context (not history/global search).

- S4: actions `verify_collected` / `verify_dismissed` on the existing PATCH route, same guard (`students` section), rate limit and role rule as `mark_paid`. Collected rewrites the channel to cash (`previousPaymentChannel` kept in the resolution) and status paid, then runs the shared cash-settlement side effects (extracted `applyCashSettlementSideEffects`). Claim + StudentDataAudit run in one transaction with an `updatedAt` optimistic guard (409 on conflict).
- S4: `isVerifyCardAttempt` = `isUnchargedCardAttempt` && no resolution. Debt, latest-open and slot dedup use `isUnchargedCardAttempt`, so dismissed attempts are never debt and stay visible.
- S4 open points: (resolved by D5) dismissed/verify rows no longer match Pending. A later decline on the same PaymentIntent after Dismiss keeps the resolution (the item does not re-enter Verify). The 24 h daily window only reloads unresolved verify rows, so a dismissed attempt from yesterday drops off today's board (still in history).

- D5 extension (ea4ce8ca): pending card processes are Verify `in_progress`; Reports "Stripe pending" became "Card to verify" (counts `verify` rows; field `pendingStripeSales` kept for the suggestions contract).
- Risk to watch: staff can mark an in-progress QR/Checkout "Collected" while the session is still open; a later Stripe completion would then hit an already-paid row (native fulfillment only accepts pending/failed; Checkout path not re-verified here).

## Next step
S5 (history timeline + expose `metadata.paymentAttempts` on rows), then S6.
