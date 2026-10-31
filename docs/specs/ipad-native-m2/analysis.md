# Analysis - ipad-native-m2

## Status
DRAFT - spec phase only. No source changes. Verified against origin/main 2b8f5b31 (2026-10-27).

## 1. Android component -> iOS equivalent
Paths under native-kiosk/androidApp/src/main/kotlin/com/pli/kiosk/android/.
| Android | Ref | iOS equivalent | Portability |
|---|---|---|---|
| Approved pins (account, location tml_GqQ6wPY5rSAhAt, serial STRM2D533025669) | Foundation.kt:8-16 | per-build config | Serial is Android-reader specific; must become configurable (OQ1). |
| ReaderPolicy.matches / matchesConfigured | Foundation.kt:519, 528 | same policy in Swift | Pure logic, direct port; serial from config. |
| SecureWebBridge (strict JSON, SHA-256 replay cache) | SecureWebBridge.kt:61-139 | SecureBridge.swift | Exists, drifted (section 2). |
| SecureWebMessageHost / SecureWebAdmission | SecureWebMessageHost.kt:14-18, 35, 94 | WebKitBridgeAdapter.swift | Origin+main-frame lock exists; reply/push model differs. |
| WebViewCompat.addWebMessageListener (injects window.pliNativeBridge) | SecureWebMessageHost.kt:94 | WKUserContentController + document-start WKUserScript shim | Shim must expose postMessage/onmessage to match the web. |
| StaffSessionTransport | StaffSessionTransport.kt:131-133 | URLSession transport | Straight port; endpoints below. |
| Cookie capture via CookieManager (pli_terminal_session) | WebSessionReadiness.kt:10-11 | WKHTTPCookieStore (async) | Equivalent; HttpOnly cookies readable natively. |
| EncryptedStateStore (AndroidKeyStore AES) | EncryptedStateStore.kt:117-121 | Keychain | Simpler on iOS; OQ6. |
| ReaderConnectionOwner (5s..20s backoff) | ReaderConnectionOwner.kt:33-34, 249 | Swift reader owner | Same state machine; SDK delegates differ. |
| StripeTerminalSdkAdapter / TerminalAdapter | (same dir) | Stripe Terminal iOS SDK adapter | SDK API differs; Android uses com.stripe:stripeterminal:5.6.0 (build.gradle.kts:78). |
| NativeWebEvents (readerStatus, collectionPrompt) | NativeWebEvents.kt:7, 41-63 | evaluateJavaScript push | Closed shapes, version 1. |
| PreparedBridgeOperations | PreparedBridgeOperations.kt:288-292, 361-365 | Swift registry | Ops: startPreparedPurchase, getPreparedPurchaseState, diagnosticRoundTrip. |
| KioskWebActivity idle reload, fullscreen | KioskWebActivity.kt:30-80, 136 | UIViewController + Guided Access | Reload must keep bridge and reader (R9). |
| BuildConfig APPROVED_HTTPS_ORIGIN | build.gradle.kts:38 | xcconfig | Direct. |

## 2. Bridge contract and Swift drift
Contract: envelope {version "1", operation, requestId, payload}; string-only payload with per-field max length; <=16 KB; 256-entry replay cache keyed by requestId; same bytes -> cached reply, different bytes -> REQUEST_ID_CONFLICT. Reply JSON string: requestId, operationRef, state (accepted|pending|paid|rejected), error, operation. Web side: components/front/courses/enroll/effects/native-payment-bridge.ts (bridge() :26-31; JSON.parse of string event.data :99-180; reference regex 43 chars :11-12).
Drift in native-kiosk/apps/kiosk-native/Sources/KioskNativeBridge (258 + 133 lines, tests present):
1. State enum lacks `paid` (SecureBridge.swift:3-7 vs SecureWebBridge.kt:6).
2. Reply lacks `operation` field.
3. Handler signature fields-only; Kotlin passes requestId and operationRef into the handler; Swift derives operationRef after the handler.
4. Replay compare uses raw bytes; Kotlin uses SHA-256 digest (no raw bytes retained).
5. Cache exhaustion closes the bridge in Swift (closed = true); Kotlin returns the error and stays open.
6. bounded() trims whitespace and counts Characters; Kotlin measures UTF-8 bytes/length differently. Needs one rule.
7. Transport: Swift uses WKScriptMessageHandlerWithReply on handler `kioskNativeBridge` and replies with a [String:String] dictionary; the web expects window.pliNativeBridge.postMessage(string) and a JSON string via onmessage. No shim, no push channel, no `paid`.
8. No operations registered (no PreparedBridgeOperations port), no NativeWebEvents, no reader/session code, no app target.
9. Admission: Swift accepts port 0 or 443 and checks host only; Kotlin compares the full serialized origin string and also validates currentUrl.
Package.swift: tools 5.9, iOS 15 / macOS 13.

## 3. Server endpoints (unchanged)
- POST /api/staff/terminal/session (login; sets pli_terminal_session) - StaffSessionTransport.kt:131.
- POST /api/kiosk/terminal/internal-purchase, actions: student-lookup, preflight, attempt, payment-intent, recover, prepared-attempt, prepared-payment-intent, prepared-recover, prepared-creation-status - StaffSessionTransport.kt:132, 148-241.
- Native purchase preparation (native_m2_prepare, prepared context, native-attempt-state) per docs/specs/new-student-native-m2/analysis.md.

## 4. Web detection
native-payment-bridge.ts:43-45 `isNativeKioskWebView` matches Android UA `wv` only. Gated uses: EnrollFormFooter.tsx:51,57; useEnrollPaymentActions.ts:23,458. On iOS it returns false, so the web would offer the QR hosted-checkout path instead of the bridge. Minimal change: also true when an iOS native token is present (OQ7); Android regex untouched.

## 5. Gaps
- Second M2 serial/registration and any Stripe location assignment for it.
- Apple team, bundle id, entitlements, provisioning.
- No iOS app target; the old iosApp exists only on branch feat/native-kiosk-m2-test-payment (not available locally here; reference only, do not reuse).
- openspec/changes/native-kiosk-m2-self-service/design.md references a non-existent :shared module (stale; the file is not on origin/main, only untracked in the main checkout).
- Server preflight returns approved account/location; confirm it does not hard-pin the Android serial server-side.

## 6. Risks
1. Single-reader pinning: Android hard-codes the serial; iOS needs a second identity without touching the Android build.
2. Web detection change affects shared production code; must not regress Android or desktop/QR paths.
3. iOS WKWebView cookie/session lifecycle and Bluetooth background behavior differ (auto-reconnect, device sleep, Guided Access).
4. Stripe Terminal iOS SDK/M2 compatibility and iPadOS minimum untested on iPad12,2.
5. Bridge drift could silently diverge from the Kotlin contract; need shared conformance vectors.

## 7. Dependencies
Owner: M2 serial, Apple Developer team, distribution choice. Stripe: reader registered to location tml_GqQ6wPY5rSAhAt (or a new one). Web: detection change. Existing: new-student-native-m2 spec.

## 8. Indicative minimal surface (no code yet)
native-kiosk/apps/kiosk-native: bridge parity fixes + tests; new iOS app target (WKWebView host, shim, reader owner, session transport, Keychain store, ops registry, events); xcconfig per device; native-payment-bridge.ts detection tweak + test; no server changes.
