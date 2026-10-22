# Native M2 reader always ready

## Objective

Self check-in must never depend on staff turning the Reader M2 on per sale. The kiosk keeps the reader
connected all day, recovers by itself, never offers a broken card option, and tells the customer the exact
moment to tap.

## Problem and why

- 2026-10-22 live test (tablet unplugged from Mac, like the studio): sale failed with "The card reader did not
  respond"; logcat showed `Bluetooth scan timed out` at app start (17:11:05) and at sale (17:12:47), 0 readers.
- Root cause: the app does not hold a persistent reader connection. `ForegroundWarmReader` tries once on
  foreground and invalidates itself on any failure/disconnect (`ForegroundWarmReader.kt:157-163`); each sale
  bootstraps its own discovery/connection. An unconnected M2 sleeps, so the next customer finds nothing.
- Stripe facts (Terminal Android docs): `autoReconnectOnUnexpectedDisconnect` (default true) with
  `ReaderReconnectionListener`; `DisconnectReason.IDLE_POWER_DOWN` = reader powers down after 10 h idle.
  Unverified: how fast an unconnected M2 sleeps, and whether USB power prevents the 10 h power-down (measure on device).

## Scope

- In: persistent reader connection owner on Android (sales reuse it), endless reconnect with backoff while the
  kiosk is foreground, reader status exposed to the web through the existing secure bridge, card option gated on
  reader readiness, kiosk status indicator, exact "tap your card" moment popup with a replaceable video/animation slot.
- Later (separate task, needs server design): staff-panel "reader offline" alert via tablet heartbeat.
- Out: new-student M2, admin-panel charging, simplification pass.

## Constraints

- Preserve every money-safety invariant: fresh ticket per sale, exact amount/selection, durable PaymentIntent
  create/replay, same-PaymentIntent recovery, server `Paid` authority, no double charge.
- Bridge stays origin-locked, closed schema, no secrets/IDs to JS (status and display prompts only).
- UI copy in English (kiosk UI is English). Owner will supply the tap animation video; ship a placeholder asset path.
- TDD: strict (RED → GREEN) with vitest (web) and Gradle unit tests (Android).

## Tasks

- [x] A1 — Android persistent `ReaderConnectionOwner`: connect at kiosk start, keep one connection, sales reuse it,
  SDK auto-reconnect on, own retry loop (backoff ~15–20 s, never gives up while foreground), replaces the one-shot warm reader. Route: delegated writer.
  Commit `d5345fce` (+830/−523; removed `ForegroundWarmReader` + its test). Backoff 5→10→20 s cap, 30 s attempt deadline,
  yields 45 s to a sale bootstrap, stops on background. Sales reusing the owner link get `ReusedTerminalConnection`
  and release it without `disconnect()`. Tests: `ReaderConnectionOwnerTest` (21), `SaleConnectionReuseTest` (2).
- [x] A2 — Bridge reader status (`connected` / `connecting` / `disconnected`, optional battery %) and
  `awaiting_card` / display prompts from `MobileReaderListener.onRequestReaderInput` / `onRequestReaderDisplayMessage`. Route: delegated writer.
  Commit `1acd2ec1` (+237/−6). `NativeWebEvents` pushes `readerStatus` and `collectionPrompt`
  (`awaiting_card` from SDK 5.6.0 `onRequestReaderInput`, `processing` on CONFIRMING, `none` on sale close) to the reply
  proxy of the latest admitted page message; `getReaderStatus` (empty payload) answers with the current status.
  Battery skipped (not used by the UI). Tests: `NativeWebEventsTest` (5) + workflow/context tests (3).
- [x] W1 — Web: gate Card on reader readiness (disabled with reason, cash/QR still available), status dot on kiosk. Route: delegated writer.
  Commit `32bf0a05` (+479/−8). Gates StepPayments card option, final confirm, and Quick Repeat "Pay by Card"; dot in
  the payment heading and the Quick Repeat card button. `unknown` (no bridge or older APK that never reports) keeps
  today's behavior. Payment request handlers now ignore pushed events and replies addressed to other requests.
  Tests: `native-reader-events.test.ts` (7), `native-card-gating.test.tsx` (5).
- [x] W2 — Web: "Tap your card on the reader" popup shown exactly on `awaiting_card`, hidden on processing/result,
  with a video slot (`public/kiosk/tap-to-pay.mp4` placeholder, CSS animation fallback). Route: delegated writer.
  Commit `a9a442af` (+198/−0). `NativeTapToPayPopup` mounted once in `CheckInQrOverlays`; `runNativePreparedCheckout`
  clears a lingering prompt on finish. Video: the owner drops the final clip at `public/kiosk/tap-to-pay.mp4`
  (not committed); until then the CSS fallback shows. Tests: `native-tap-to-pay-popup.test.tsx` (4).
- [ ] D1 — Build/install APK, deploy, physical validation: idle 30+ min without sales, then a sale; unplug/replug reader; reader off → card gated; tap popup timing.
- [ ] S1 — Later: staff-panel reader-offline alert (heartbeat design).

## Checks

- Android: `./gradlew --no-daemon --offline :androidApp:testDebugUnitTest` (JAVA_HOME Android Studio JBR).
- Web: `npx vitest run tests/checkin`, `npx tsc --noEmit -p .`, eslint on changed files, `npx next build`.

## Verification (2026-10-22, delegated writer)

- `./gradlew --no-daemon --offline :androidApp:testDebugUnitTest`: pass, 247 tests, 0 failures.
- `npx vitest run tests/checkin`: 846 passed (82 files).
- `npx tsc --noEmit -p .`: pass. `npx eslint <changed files>`: pass. `npx next build`: pass. `git diff --check`: clean.
- Not yet observed: physical behavior on the tablet/M2 (D1).

## Progress log

- 2026-10-22 — Document created after the failed unplugged live test; owner approved the always-ready plan and the tap popup.
- 2026-10-22 — A1, A2, W1, W2 implemented with strict TDD (RED observed per task). Next: D1 physical validation.
