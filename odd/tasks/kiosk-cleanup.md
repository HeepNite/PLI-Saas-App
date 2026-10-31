# Kiosk Cleanup

## Objective

Clean up, refactor and optimise the kiosk (web, server routes, Android, iPad) with good practices and no over-engineering. No behaviour change except removing the legacy USD 1 catalog dependency, plus security hardening. Owner-approved 2026-10-31.

## Source of truth

`docs/specs/kiosk-cleanup/{requirements,analysis,tasks}.md`. Invariants (money safety, idempotency, ticket signing, single attempt guard, no automatic fallback, QR cash grant, SMS verification, multi-terminal readers) must not change.

## Settings

- TDD: strict. Runners: `vitest` (web/server), `gradle` (Android), `swift test` (iPad). Source: owner decision.
- Delivery: small PRs to `main` (about 400 authored changed lines is advisory). Propagate each fix to `codex/develop` where the code exists there. Push, PR and merge remain the owner's decisions.
- Route per task: P0a/W1 inline; W2-W4, S*, A*, I1 delegated direct writer (2+ non-trivial files). Record trigger evidence per task.

## Checklist

- [ ] P0a — Non-major npm audit fix; patched next, @clerk/nextjs, @sentry/nextjs.
- [ ] P0b — Android MissingPermission, WebViewFeature guards, Stripe Terminal and androidx.webkit bumps.
- [ ] W1 — Dead ternaries, shared useNowTick, stale comment.
- [ ] W2 — useEnrollPaymentActions helpers.
- [ ] W3 — bridgeRequest helper and runNativePreparedCheckout unit test.
- [ ] W4 — Merge QR pollers and checkout API helpers.
- [ ] W5 — pliNativeAttemptState removal (only after owner confirms).
- [ ] S1 — /api/checkin/phone/identify (after log check).
- [ ] S2 — /api/kiosk/terminal/connection-token (after log check).
- [ ] A1 — Android legacy runtime / OperatorActivity; reader assignment.
- [ ] A2 — Android legacy PurchaseApi/coordinator (keep AttemptMode.LEGACY fail-closed; 2 PRs).
- [ ] S3 — Server legacy actions and USD 1 product/price check (only after A1/A2).
- [ ] S4 — Naming and temporary diagnostics.
- [ ] S5 — Webhook legacy branch (only after DB check).
- [ ] I1 — iPad rebase and delivery.

## Progress

Spec created; no implementation started. Next step: P0a.
