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
- [x] A3 — Keep the kiosk screen on (`FLAG_KEEP_SCREEN_ON`) so screen sleep (tablet timeout 10 min) never stops the
  Activity and releases the reader. Found during D1: owner disconnected with `DISCONNECT_REQUESTED` at 17:59 exactly
  10 min after connecting. Route: inline (one mechanical file + test). RED (unresolved constant) → GREEN, Android 248/248.
- [x] A4 — Crash fix: stale web event target / WebView destroy (branch `fix/kiosk-stale-web-event-target`, commit `75420dfe`).
  Route: delegated writer. Evidence: SM-T727V Android 11 debug APK, 2026-10-22 18:39:42.817 `reader disconnected
  reason=DISCONNECT_REQUESTED`, 18:39:44.512 main-thread abort `JNI DETECTED ERROR ... use of deleted weak global
  reference 0xefefefefefefefef` from `MessageQueue.nativePollOnce` into libwebviewchromium.so (SIGABRT).
  Root cause analysis: the stale-proxy hypothesis is NOT confirmed by code. `NativeWebEvents` is per prepared context
  (`KioskApplication.kt:365`, one per page admission), and every lifecycle path (onStop/onDestroy/navigation) already ran
  `SecureWebMessageHost.invalidate()` (host flag + `events.invalidate()`) before `webView.destroy()`, so the posted
  lambda dropped after invalidation. The DISCONNECT_REQUESTED line is the owner's own `terminal.disconnect()` on stop.
  The confirmed contract violation is `KioskWebActivity.onDestroy` calling `webView.destroy()` while the WebView was
  still attached to the window (Android requires removal from the view system first); this matches a Chromium-internal
  weak-ref use-after-free on a later UI-loop task, but is not proven on device.
  Fix: per-host `HostBoundWebEventTarget` (main-thread delivery, validity re-checked right before `postMessage`,
  identity-checked `NativeWebEvents.unbind`, host invalidation never clears a newer host's binding);
  `KioskWebActivity.releaseWebView` invalidates the host, detaches the WebView, then destroys it. Event schema and money
  paths unchanged. TDD: RED (unresolved `unbind`/`HostBoundWebEventTarget`/`releaseWebView`) → GREEN, Android 255/255.
  APK (prod origin, collection on) sha256 `eab4c562022c0ff3cdab3ea64036e5ddba092b314b6ef42fd0c78ebe5c5b002a`.
  Pending: on-device reproduction (stop/resume/recreate cycles) to confirm the crash is gone.
- [x] A5 — Crash fix: page reload tears down the bridge (branch `fix/kiosk-reload-stale-reply-proxy`, commit `8be6806c`).
  Route: delegated writer. Repro (SM-T727V Android 11, debug APK, CheckJNI): kiosk open, owner connected,
  `window.location.reload()` via WebView devtools → `reader disconnected reason=DISCONNECT_REQUESTED` → ~3 s later
  `JNI ERROR (app bug): accessed stale WeakGlobal 0xefefefefefefefef` from `MessageQueue.nativePollOnce` into
  libwebviewchromium. Production trigger: web deploy watchdog `useKioskDeployRefresh.ts` reload every 5 min (crashes
  at ~5 min uptime). Cause in code: any main-frame navigation while the bridge was active terminally invalidated the
  host (`KioskWebActivity.kt:113` `isMainFrame && active` in `onNavigation`, or `:64` in `onPageFinished`): that runs
  `WebViewCompat.removeWebMessageListener` mid-navigation and `stopReader()` (the DISCONNECT_REQUESTED). The
  stale-reply-proxy post hypothesis is NOT confirmed by code: A4 already invalidated the push target before the reader
  stop, so no push reached the old proxy on that path; the remaining native work on the crash path is the listener
  removal during an in-flight navigation (Chromium-internal weak-ref use-after-free, not proven on device).
  Fix: an idle reload of the exact terminal URL (no PENDING prepared operation) no longer invalidates: `onNavigation`
  and the new `onPageStarted` synchronously `retireDocument()` (old proxy dropped, document generation advanced,
  generation re-checked on the main thread right before `postMessage`, late messages from a retired proxy are neither
  dispatched nor answered nor rebound); bridge, listener and reader owner stay; completion must be exact with the same
  session authority (origin/association/cookie) or the host is invalidated. A reload during an in-flight sale, a
  redirect, or a non-terminal URL still invalidates as before. Closed schema and money paths unchanged.
  TDD: RED compile, then RED assertions (7 failing with stubs) → GREEN, Android 264/264.
  APK (prod origin, collection on) sha256 `af5e57ddecbe1912f7cb17766f791b86cf2344100975015cc30704bd4248b4d4`,
  androidTest `05ace5a38e99c60bfd521931e1a5ef7aba73dac3e7672ce525bae250c888f427`.
  Pending: on-device reload repro (devtools reload + 5-min watchdog soak) to confirm no abort and no reader disconnect.
- [~] D1 — Physical validation (PR #716 web `esmthac5z` + APK `59a4225a…`), 2026-10-22:
  - Reader off at start: owner retried 17:49:42 / 17:49:57 / 17:50:17 (scan timeouts), connected by itself at 17:50:51 once powered on. PASS.
  - Screen slept at 17:59 → owner released reader (fixed by A3). After ~30 min unconnected but on USB power the M2 stayed awake:
    on wake the owner reconnected at 18:30:29; sale at 18:32:07 reused the connection instantly; Stripe `succeeded` USD 1.00. PASS.
  - Pending: reader turned off mid-day → card gated + auto-recovery; tap popup timing observed by owner; 10 h idle power-down behavior.
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
- 2026-10-22 — D1 partial pass (auto-connect, reconnect after idle, live sale). A3 keep-screen-on added.
- 2026-10-22 — A4 crash hardening committed (`75420dfe`); root cause not confirmed on device, needs recreate-cycle soak.
- 2026-10-22 — A5 reload crash fix committed (`8be6806c`); idle reload keeps bridge and reader; needs device repro.
