# Requirements: kiosk cleanup, refactor, optimisation and security hardening

Owner-approved 2026-10-31. Status: spec only. This document authorizes no source change by itself; each task in `tasks.md` is implemented in its own small PR.

## Objective

Clean up, refactor and optimise the kiosk following good practices, without over-engineering. Behaviour must not change, with one exception: the legacy USD 1 catalog dependency is removed. Security hardening (dependency and Android findings) is part of the work and ships first.

## Scope

| Surface | In scope |
| --- | --- |
| Web kiosk | `/staff/terminal` UI, `components/front/**` enroll/checkin hooks, `lib/checkin/**`, native bridge client code |
| Kiosk server routes | `/api/kiosk/**`, `/api/checkin/**`, `/api/checkout/native-attempt-state`, internal-purchase service and webhook |
| Android app | `apps/android` kiosk app (runtime, WebView host, Stripe Terminal adapter) |
| iPad app | rebase and delivery of the existing iPad branch (task I1) |

Out of scope: new features, schema changes, Prisma major upgrade (7.x, separate later spec), `/checkin` product behaviour, UI redesign.

## Invariants (MUST NOT change)

Money safety
- Prepared-cancel unlocks a retained attempt only on a server `canceled` answer. Never cancel a `succeeded` payment (returns paid). `processing`, `requires_capture` and unknown states stay pending.
- Idempotency keys (including the PaymentIntent-derived cancel key) are unchanged.
- Prepared ticket signing and `INTERNAL_PURCHASE_ATTEMPT_SECRET` handling are unchanged.
- Single native attempt guard stays. A failed native sale never falls back automatically to a web charge.
- Bridge reply cache keeps its 256-entry eviction.
- Never hide money rows: uncharged card = yellow Verify; Pending/debt = cash only.

Flows
- QR from an in-studio kiosk grants cash; public booking blocks cash. An open card checkout is expired before a cash settlement.
- Plain-browser web kiosk keeps its fallback (PaymentElement inside `/staff/terminal`).
- SMS verification stays mandatory in every flow.
- Multi-terminal reader assignment is preserved (see A1 for the hard-coded reader id, which must be replaced by assignment, not removed).
- `AttemptMode.LEGACY` payloads keep decoding fail-closed on Android.

## Acceptance criteria per phase

| Phase | Criteria |
| --- | --- |
| P0a | Non-major `npm audit fix` applied; `next`, `@clerk/nextjs`, `@sentry/nextjs` on patched versions; critical count 0; `tsc`, lint, vitest, build green. |
| P0b | `MissingPermission` lint error gone; `WebViewFeature` guards present; Stripe Terminal and androidx.webkit bumped; gradle unit tests and lint green. |
| W1 | Dead ternaries removed; one shared `useNowTick`; stale comment fixed; no behaviour diff. |
| W2 | `useEnrollPaymentActions` shrinks via shared helpers (ACCOUNT_EXISTS retry, failure handling, sign-in reset); existing tests unchanged and green. |
| W3 | One `bridgeRequest` helper replaces 3 request/timeout promises; new unit test covers `runNativePreparedCheckout` (paid, failed, timeout, no fallback). |
| W4 | One QR poller and one checkout API helper module; both call sites migrated; polling cadence and stop conditions unchanged. |
| W5 | `window.pliNativeAttemptState` and `/api/checkout/native-attempt-state` removed only after owner confirmation of no consumer. |
| S1, S2 | Route removed only after 30-day log check shows zero hits; 404 behaviour verified. |
| A1, A2 | Legacy runtime, `OperatorActivity`, legacy `PurchaseApi`/coordinator removed; LEGACY decode fail-closed test present; APK builds. |
| S3 | `verifyLiveCatalog` no longer reads the USD 1 product/price (merchant and location checks kept); archiving that price breaks neither reader. Only after A1/A2 ship. |
| S4 | Prepared-native files named consistently; temporary diagnostics in `internal-purchase/route.ts` removed. |
| S5 | Webhook legacy branch removed only after DB check shows no legacy purchases in flight. |
| I1 | iPad branch rebased on main with the cleanup applied; `swift test` green. |

Every phase: tests alongside behaviour, one conventional commit per work unit, no invariant above weakened.
