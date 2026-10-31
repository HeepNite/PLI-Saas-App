# Resolve - ipad-native-m2

## Status
Spec-phase. Reconciles requirements.md + analysis.md against origin/main code (verified 2026-10-27). No source changes.

## 1. Resolved decisions (final)
- D1 Native Swift app: WKWebView hosting https://pli.palladiumlatin.art/staff/terminal + Stripe Terminal iOS SDK (M2, Bluetooth) + closed-schema JS bridge. KMP deferred.
- D2 Android (Samsung) and iPad run independently, each with its own M2.
- D3 Android behavior unchanged; server contracts reused; only web change = iOS detection (OQ7).
- D4 Sign with Individual team 885NWQD9LK, Ad Hoc (UDID, profile 1 year, yearly re-sign). TestFlight test-only; no ABM.
- D5 Test/production device = iPad12,2 (iPad 9th gen).
- D6 No OS lockdown (no Guided Access/supervision/SAM). In-app only: full-screen WebView + idle timer disabled in foreground.
- D7 OQ1, OQ5-OQ9 take the recommended options.
- OQ1 = A: serial/location/account pinned via xcconfig -> Info.plist, per-device build. Provisioning screen (C) is a follow-up.
- OQ2 = D4. OQ3 = D6.
- OQ4 = iPadOS 16 or the Stripe SDK minimum, whichever is higher (verify at implementation; see design section 9).
- OQ5 = B: latest stable Stripe Terminal iOS SDK at implementation, pinned exactly via SPM.
- OQ6 = A: Keychain kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly.
- OQ7 = C: UA token + shim presence. Android regex untouched.
- OQ8 = B: bilingual en/es permission strings (Bluetooth, Location When In Use).
- OQ9 = A: native evaluateJavaScript push into window.pliNativeBridge.onmessage.

## 2. Spec vs code conflicts found
1. analysis.md row "KioskWebActivity ... UIViewController + Guided Access" contradicts D6. Resolution: D6 wins; no Guided Access.
2. analysis.md "Admission: Swift accepts port 0 or 443" vs Kotlin full-origin compare: close in Swift (design 4.2); web origin is the build-config origin string only.
3. Bounds rule differs: Kotlin `bounded` = non-blank and String.length (UTF-16 units) <= max, value NOT trimmed; Swift trims and counts Characters. Resolution: Swift adopts non-blank + UTF-16 count (`utf16.count`), no trimming. Request limit: 16384 on UTF-16 length AND UTF-8 bytes.
4. Kotlin cache exhaustion returns RESPONSE_CACHE_EXHAUSTED and stays open; Swift closes. Resolution: match Kotlin (stay open).
5. Reply `operation` field and `paid` state exist in Kotlin, absent in Swift. Resolution: add (design 5).
6. Web client contract note: onmessage receives `{data: <JSON string>}`; Swift today replies with a dictionary via WKScriptMessageHandlerWithReply. Resolution: shim + string push (OQ9).
7. No `native-kiosk/iosApp` or Xcode project exists on this branch (base origin/main 2b8f5b31); no name conflict. The old iosApp lives only on feat/native-kiosk-m2-test-payment and is reference-only.
8. openspec/changes/native-kiosk-m2-self-service/design.md mentions a `:shared` module that does not exist; ignored (out of scope, KMP deferred).
9. Server preflight pinning: analysis flagged "confirm server does not hard-pin the Android serial". Still open as task I1 verification (read-only check), not a spec conflict yet.

## 3. External dependency
Second M2 serial provided by owner 2026-10-27: STRM2D533025667 (Android reader is STRM2D533025669). Location: same studio location tml_GqQ6wPY5rSAhAt. Bundle id: com.pli.kiosk.livefoundation. Plan approved by owner 2026-10-27. The Stripe reader id (tmr_...) for the second M2 is learned at first registration/connection in I14; unit tests use fakes.

## I1 outcome (2026-10-27, read-only)
- No server code pins a reader serial. Reader identity is only format-checked (`/^tmr_[A-Za-z0-9_]+$/`, lib/stripe/prepared-native-payment.ts:17; lib/stripe/internal-purchase.ts:69) and bound into the signed attempt per terminal session.
- Location tml_GqQ6wPY5rSAhAt is fixed server-side only for the legacy internal purchase (lib/stripe/internal-purchase.ts:7); the second M2 uses the same location, so no change.
- Connection tokens are unscoped (app/api/kiosk/terminal/connection-token/route.ts:46), so any reader on the account can connect.
- Consequence: the iPad needs no server change for its reader. It must log in as its own staff terminal (separate terminal record via /api/staff/terminals) because kiosk sessions are one per terminal; sharing the Samsung's terminal would let one tablet invalidate the other's kiosk session.
- Verified 2026-10-27: login (app/api/staff/terminal/session/route.ts:48-81) is per terminal slug + 4-digit PIN, and deletes every existing session of that terminal (:74-81). Sharing one terminal would log the other tablet out. Owner confirmed the iPad gets its own terminal record with its own PIN (admin setup, no code).

## I8/I9 decisions (2026-10-27)
- First pairing (owner, accepted): `ReaderConnectionOwner` may start with a nil reader id, match serial + type + location, then pin the learned `tmr_` id. The id is persisted in its own Keychain item (`KeychainPairedReaderStore`, AfterFirstUnlockThisDeviceOnly, not synchronizable) so it survives restarts. No sale before pairing: the prepared workflow throws `readerNotPaired` and the bridge answers `rejected` without any server call. A reader the SDK reports without a Stripe id is offered as `unregistered:<serial>:<type>` with the configured location; the live connection reports the real id.
- Production prepared-bridge workflow (owner): Kotlin `ProductionPreparedBridgeWorkflow`, `PurchaseCoordinator` (prepared half only), `NativeCollectionRuntime` and `NativeCollectionBootstrapRuntime` are ported to `KioskNativeCore`, composed in `ProductionBridgeComposition` and wired into the app. The legacy phone/student flow is not ported.
- Subframes (supersedes design 4.1 "subframes denied"): like Kotlin `da1e7602`, only main-frame navigations are locked to the exact terminal URL; subframes (Stripe payment elements) are allowed; popups/new windows are always denied.
- Background mode (supersedes design 6 "UIBackgroundModes not used"): Stripe's iOS setup guide requires `bluetooth-central` so the M2 can stay in standby while the iPad is locked or backgrounded. The app still tears down the bridge and any sale when it enters the background (Kotlin `onStop` parity).
- Stripe Terminal iOS SDK: 6.0.0 (latest stable release, published 2026-10-07; not a prerelease), pinned exact via SPM from https://github.com/stripe/stripe-terminal-ios. Minimum iOS 16 (its Package.swift `.iOS(.v16)` and the Stripe setup guide), so deployment target = max(16, 16) = 16.0 and the package platform is raised to iOS 16.
- Session cookie capture: `WKHTTPCookieStore` is asynchronous and the transport seam is synchronous, so the host snapshots exactly one secure, HttpOnly, host-only `pli_terminal_session` cookie natively right before each capture. The value never reaches JavaScript.
- Bridge exposure mirrors Kotlin: nothing is attached until the terminal page finished loading and its session was captured; one reload then lets the document-start shim run. Backgrounding the app is terminal for the lifecycle; becoming active again builds a fresh web view and lifecycle.

## Android parity fixes (2026-10-28, port of main #746-#752)
- #750: bridge replay cache keeps 256 entries in insertion order and evicts the oldest instead of answering RESPONSE_CACHE_EXHAUSTED (error code removed; conformance vector updated to match Kotlin).
- #746/#747: a prepared sale ending not paid (in-session decline/timeout/disconnect, or a retained not-paid attempt at startup) calls `prepared-cancel`; the retained attempt is cleared (and read back) only on server `canceled`; `succeeded` uses the paid rollover; anything else or an error keeps the kiosk locked. Supersedes the S4 rule "canceled stays retained".
- #748: sale admission renews the captured staff session from the same WKWebView cookie when no attempt is retained (cookie snapshot refreshed natively first); an expired session is refused without poisoning the coordinator.
- #752: no getPreparedPurchaseState poll for 10 s, or the sale's document replaced, cancels a reader still waiting for the card through the same cancel path as the 90 s deadline (then settles via prepared-cancel); a card already read is never canceled.
- #749: identifier-free os.Logger lines (subsystem com.pli.kiosk, category PLI-M2) mirroring the Android PLI-M2 diagnostics for bridge replies/refusals, event pushes/deliveries/drops, prepared cancel outcome, retained-attempt clears, admission rejection reason and web abandonment.

## Cleanup decisions (2026-10-28, owner: remove everything unused)
- Layers merged, money-safety rules unchanged: `PurchaseCoordinator` now owns capture, renewal, startup recovery and settlement (one settle path for sale and startup); `SaleController` owns the bridge registry; `PurchaseServer` replaces transport/API/token source; `KeychainStore` replaces both stores (same services, accounts, attributes); `ReaderConnectionOwner` talks to `TerminalSDKClient` directly (the `unregistered:` alias and `TerminalAdapter` are gone). Supersedes the I8/I9 class names above.
- Behaviour simplifications: a fresh server PAID clears the attempt directly (no intermediate `resolved` record); startup recovery may retry on the next terminal page load instead of once per web view, and a refused rebuild no longer restores the cleared attempt; the HTTP client refuses a body over 64 KiB after receipt instead of while streaming.
- Without valid reader pins (Debug placeholders) the app no longer injects the shim: it is a plain web kiosk instead of a bridge that rejects every purchase.
- Durable state JSON is now Codable (no `mode`, `resolved` or association fields). No device holds the old format yet (I13 not done).
- A ticket-only attempt (ticket issued, no PaymentIntent id) is resolved by the same settle path at startup and right after a failed sale: `prepared-creation-status` UNCREATED clears; CREATED fetches the bound intent via `prepared-payment-intent` and then recover/cancel as usual; unavailable keeps the kiosk locked.
