# Native M2 promotion to main

## Objective

Promote the live, physically validated M2 card flow (production deployment built from the
`integration/native-m2-current-production-reviewable` worktree) into `main`, so that ordinary
`main` deployments stop removing M2 from production. Afterwards, run a separate simplification pass.

## Problem and why

- Production runs a manual CLI deployment from this worktree; `main` lacks the M2 web/server code.
- Every merge to `main` auto-deployed and removed M2 from production (happened twice on 2026-10-21/22, PRs #707/#709).
- Live evidence 2026-10-22: existing-customer card sale and Quick Repeat card sale completed end to end on Reader M2 (Samsung `R52M70E2L5P`), success screen 5 s, return to landing.

## Scope

- In: commit pending W3p25–W3p33 work, merge `origin/main` (14 commits, one conflict in
  `components/front/courses/enroll/hooks/useEnrollPaymentActions.ts`, keep both QR-cash grant and native M2),
  security audit of the server/web surface, four reviewable PRs of roughly 2,500 lines each.
- Out: new-student M2 (next spec), admin-panel charging (later spec), refunds of the three USD 1 test charges (deferred by owner), simplification (follow-up feature).

## Decisions

- Keep the QR cash hotfixes from `main` (#704/#707/#709); the outage was caused by the deployment, not by that code.
- Four PRs (owner choice), each with its own tests:
  1. Server + database (routes, services, Stripe webhook, two already-applied migrations).
  2. Kiosk web (native bridge, payment flow, Quick Repeat, conflict resolution).
  3. Android part 1 (encrypted state, session, transport, recovery).
  4. Android part 2 (reader, collection, web bridge, diagnostics).
- Order: merge first, simplify afterwards (owner choice). Simplification candidates: remove the legacy USD 1 internal-purchase flow (`attempt`/`payment-intent`/`recover`, operator activity) after verifying no consumer; flatten recovery layers; review webhook additions.

## Tasks

- [x] P1 — Commit pending W3p25–W3p33 work as work-unit commits (exclude `.build/`). Route: delegated writer.
  Commits: `abd97d87` (ignore `.build/`), `08597005` (server creation-status + exact-bound expired recovery, 114/114 focused),
  `f9c8f90b` (Android retained startup recovery; isolated tree compiled and passed 205/205 unit tests),
  `b1bdfc8c` (Android warm reader, discovery generation/seconds, bootstrap deadline, diagnostics, prepared-recover),
  `f596c8b8` (web shared native prepared checkout + Quick Repeat card, 94/94 focused), `25992410` (specs/odd docs).
  Staged diffs scanned for secrets/forbidden files before every commit: clean.
- [x] P2 — Merge `origin/main`, resolve the single conflict keeping both behaviors, full test/typecheck/build. Route: delegated writer.
  Merge `95793c88` (main at `c6beec22`). Conflict only in the `buildCheckoutPayload` memo deps of
  `useEnrollPaymentActions.ts`: kept main's `kioskQrCashGrant` (payload + deps); dropped `infoStepIndex` because the
  M2 side no longer destructures it; native M2 branch via `runNativePreparedCheckout` untouched.
  Evidence: `npx tsc --noEmit -p .` exit 0; `npx vitest run` 3596 passed / 1 file failed (`tests/integration/prisma-security.test.ts`,
  missing `DATABASE_URL`, environmental, file identical to origin/main); `npx next build` exit 0;
  Android `:androidApp:testDebugUnitTest` 228/228. Note: shared `node_modules` lacked main's new `qrcode.react@4.2.0`;
  it was copied in from a sibling worktree (untracked, no lockfile change beyond main's).
- [x] P3 — Security audit of server/web/bridge surface; fix confirmed findings with tests. Route: delegated read-only auditors, then writer.
  All three findings re-verified against the code before changing it (strict TDD, RED observed for each):
  - HIGH-1 (fixed, `3b045f40`): `native_m2_prepare` stored the list price (`validation.amountInt`) on the prepared Purchase
    while embedded/gateway paths charged `promotionPricing.effectiveAmountCents`. Now uses the same effective amount and resolved
    `currency`; the idempotency/selection digest and attempt/PaymentIntent bindings all derive from `Purchase.amount`, so one source.
  - MEDIUM-1 (fixed, `08fc3969`): any reserved-metadata event went to fulfillment, which throws unless succeeded → 500 and endless
    retries for `payment_intent.payment_failed/canceled/created/processing` and every `charge.*`. Only `payment_intent.succeeded`
    fulfills; the rest are acknowledged 200 with `[native-m2-webhook:non-fulfilling-event-acknowledged]` (event type only).
  - MEDIUM-2 (fixed, `843d5c3f`): refunds were swallowed and disputes no-oped. Reversal events now route before the reserved path
    (internal USD 1 classification first, unchanged), and prepared-native reversals are recorded on the existing
    `StripeWebhookEvent` `manual_resolution` marker (`resolutionReason` `prepared_native_reversal_requires_review` /
    `prepared_native_purchase_binding_missing`, `purchaseId` FK) plus `[native-m2-reversal:manual-resolution-required]`. No schema change.
    Purchase, credits, and attendance are NOT mutated (no tombstone): automatic reversal / credit revocation is an owner decision.
    Known gap: a dispute on a Purchase not yet bound to its PaymentIntent (no metadata on Dispute objects) cannot be classified.
  Deferred LOW items: shared (cross-instance) rate limiter; CSP on `/staff/terminal` and native-only connection-token proof;
  provisioning APK tokens; Gradle wrapper checksum verification.
  Evidence: `npx vitest run` 3606 passed / 1 file failed (`tests/integration/prisma-security.test.ts`, missing `DATABASE_URL`, environmental);
  `npx tsc --noEmit -p .` exit 0; eslint on changed files clean; `npx next build` exit 0; `git diff --check` clean.
- [ ] P4 — Build the four PR branches and open PRs to `main`. Route: delegated writer.
- [ ] P5 — Owner merges; verify production deployment from `main` keeps M2 (`POST /api/kiosk/terminal/internal-purchase` → 401, not 404) and one live sale.
- [ ] P6 — Follow-up feature: simplification pass.

## Checks

- `npx vitest run` (full), `npx tsc --noEmit -p .`, `npx eslint` on changed files, `next build`.
- Android: `./gradlew --no-daemon --offline :androidApp:testDebugUnitTest` (JAVA_HOME = Android Studio JBR).
- TDD mode: strict TDD for behavior changes (source: prior M2 feature practice); runner vitest / gradle.

## Progress log

- 2026-10-22 — Document created; owner approved the four-PR split and merge-first order.
- 2026-10-22 — P1 and P2 done (see task evidence). Next: P3 security audit.
- 2026-10-22 — P3 done: HIGH-1, MEDIUM-1, MEDIUM-2 fixed with tests; LOW items deferred. Next: P4 PR branches.
