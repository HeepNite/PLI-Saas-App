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
- [x] P0b — Android MissingPermission, WebViewFeature guards, Stripe Terminal and androidx.webkit bumps. Route: inline single writer (4 Kotlin files + gradle). Evidence: 299 unit tests green, lintRelease 0 errors (was 1), assembleRelease OK; stripeterminal 5.6.0→5.8.2, webkit 1.12.1→1.18.0. Reader smoke owner-gated.
- [x] W1 — Dead ternaries, shared useNowTick, stale comment. (branch refactor/kiosk-web-w1; vitest 1386 pass, tsc + lint clean)
- [x] W2 — useEnrollPaymentActions helpers. (PRs #782, #783)
- [x] W3 — bridgeRequest helper and runNativePreparedCheckout unit test. (PR #781)
- [x] W4 — Merge QR pollers and checkout API helpers. Route: delegated writer (14 files). One core `lib/checkin/kiosk-qr-poller.ts` (moved from enroll/effects) used by both hooks; checkin hook poll loop deleted; checkout session/status/drop-in helpers live only in `lib/checkin/checkin-qr-api.ts` (check-in callers keep their no-credentials session request via `includeCredentials: false`). Drift resolved to trim-everywhere. Unchanged poll patches return `prev` (no re-render). Evidence: tests/checkin + enroll + cash-grant 923 pass; tsc, lint clean. Branch refactor/kiosk-web-w4.
- [x] W5 — pliNativeAttemptState removal: done (owner approved 2026-10-31); hook, route, lib and tests removed.
- [x] S1 — /api/checkin/phone/identify (after log check). (PR #786)
- [x] S2 — /api/kiosk/terminal/connection-token (after log check). (PR #787)
- [x] A1 — Android legacy runtime / OperatorActivity; reader assignment. (PR #785)
- [x] A2 — Android legacy PurchaseApi/coordinator (keep AttemptMode.LEGACY fail-closed). Route: delegated single writer (10+ files). Two commits on branch refactor/kiosk-android-a2: coordinator (legacy paths, student selection, Outcome.DISABLED) then API/transport (PurchaseApi, legacy StaffSessionPurchaseApi actions, PurchasePaymentRecovery, Contract.preflight/payment, USD 1 catalog constants). LEGACY attempts still decode and fail closed (new FoundationTest). Evidence: testDebugUnitTest, lintRelease, assembleRelease green.
- [x] S3 — Server legacy actions and USD 1 product/price check. Route: delegated single writer (4 files). Two commits on branch refactor/kiosk-server-s3: legacy actions removal (aa13240c; student-lookup, preflight, attempt, payment-intent, recover) then catalog check (connection-token verifies merchant + school location only; new test asserts no products/prices retrieval and fail-closed merchant/location). Callers verified: Android (main) and iPad (feat/ipad-native-m2 PurchaseServer.swift) use only connection-token + prepared-*; no web caller. Evidence: full vitest (only known DATABASE_URL integration failure), tsc, lint, build green.
- [x] S4 — Naming: checkout file renamed to `lib/checkout/prepared-native-purchase-create.ts`; rejection log kept as operational telemetry (comment reworded).
- [ ] S5 — Webhook legacy branch: deferred until 2027-02-01 (1 paid legacy USD 1 purchase from 2026-10-03 is still inside Stripe 120-day dispute window; 2 pending legacy rows exist).
- [ ] I1 — iPad rebase and delivery. Route: delegated single writer (whole iPad tree). feat/ipad-native-m2 rebased cleanly onto origin/main (a5987352); `swift test` 71 pass, `xcodebuild` iOS Simulator build succeeded. History not replayed: the final tree is rebuilt as a local chain of one-commit slices, each based on the previous (ipad/slice-a1 on origin/main), each green on its own; `git diff feat/ipad-native-m2 ipad/slice-f` is empty. Changed lines (additions + deletions) and green evidence:
  - a1 `refactor(ios-kiosk)` replace KioskNativeBridge with the KioskNative secure bridge core — 926 (339 added, 587 deleted old module). `size:exception`: the deletions are the superseded module. swift test 5 pass.
  - a2 `feat` approved origin + shared bridge conformance vectors — 369. swift test 9 pass.
  - a3 `feat` bridge shim, native web events, diagnostics — 376. swift test 22 pass.
  - b1 `feat` device-only Keychain store + models — 266. swift test 25 pass.
  - b2 `feat` internal-purchase server protocol + hardened HTTP client — 282. swift test 29 pass.
  - c1 `feat` Stripe Terminal SDK seam + pinned reader policy — 249. swift test 30 pass.
  - c2 `feat` pinned M2 connection owner — 430. `size:exception`: one reader state machine with its tests (182 test lines). swift test 41 pass.
  - d1 `feat` purchase coordinator with durable recovery — 410. `size:exception` (marginal): coordinator plus its tests (167 test lines). swift test 51 pass.
  - d2 `feat` sale controller — 466. `size:exception`: one sale state machine with its tests (185 test lines). swift test 65 pass.
  - d3 `feat` kiosk bridge host — 260. swift test 71 pass.
  - e1 `feat` iPad app target sources, Info.plist, xcconfig, project.yml, device-config script — 598. `size:exception`: the app target only builds as one unit. swift test 71 pass; `xcodegen generate` + `xcodebuild` (scratch copy) succeeded.
  - e2 `build` generated PLIKiosk.xcodeproj (byte-identical `xcodegen generate` output) + workspace + Package.resolved — 456. `size:exception`: generated. swift test 71 pass; in-tree `xcodebuild` succeeded.
  - f `docs` ipad-native-m2 spec, ODD feature document and this I1 entry. swift test 71 pass; `xcodebuild` succeeded.
  Not pushed. Next: owner opens the chained PRs (push, PR and merge remain owner decisions).

## Progress

P0b, W1-W4, S1, S2, A1, A2, S3 done. Next step: deploy S3 only after A1/A2 builds are on every reader; P0a; S4; S5 (DB-gated); W5 (owner-gated).
