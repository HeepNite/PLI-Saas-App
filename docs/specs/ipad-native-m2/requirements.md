# Requirements - ipad-native-m2

## Status
DRAFT - spec phase only. Open questions in section 6 block implementation. See analysis.md.

## 1. Objective
A native iPad app (Swift) lets the PLI kiosk at /staff/terminal take card payments on its own Stripe Reader M2, with identical server-authoritative behavior to the production Android app.

## 2. Fixed owner decisions
- D1 Native Swift app, same dynamic as Android: WKWebView hosts https://pli.palladiumlatin.art/staff/terminal (the web is the only kiosk UI) + Stripe Terminal iOS SDK connecting a Stripe Reader M2 over Bluetooth + closed-schema JS bridge. Kotlin Multiplatform is deferred until the full native kiosk redesign.
- D2 Two tablets run independently (Samsung Android + iPad), each with its OWN M2. The second M2 is not registered anywhere; its serial is pending from the owner.
- D3 The production Android app must not change behavior. Web/server contracts are reused unchanged, except the minimal web detection change (OQ7).
- D4 (resolves OQ2, 2026-10-27) Sign and distribute with the owner's paid Individual Apple Developer team 885NWQD9LK via Ad Hoc (registered UDID, profile valid 1 year, re-sign yearly; app stops launching if the membership lapses). No organization account, D-U-N-S or LLC exists, so TestFlight (90-day builds) is test-only and ABM custom apps are out of scope until an organization account exists.
- D5 (resolves OQ4 device) The production iPad is the connected test device, iPad12,2 (iPad 9th generation). Minimum iPadOS still follows the Stripe SDK minimum.
- D6 (resolves OQ3, 2026-10-27) No OS-level lockdown: no Guided Access, no supervision, no Single App Mode. Staff must always be able to leave the app and use the iPad normally. In-app only: full-screen WebView, screen kept awake while the app is in the foreground.
- D7 (2026-10-27) Owner delegates technical choices OQ1, OQ5-OQ9 to the recommended options listed in section 6.

## 3. Scope
In: new iOS app target; WKWebView host with origin lock; secure bridge matching the Android contract; Stripe Terminal iOS reader lifecycle; native staff-terminal session transport; Keychain state; kiosk fullscreen; minimal web native-WebView detection change.
Out: Android behavior changes; new endpoints or schema changes; QR/public booking/web checkout flows; KMP/shared module; native kiosk UI redesign; Tap to Pay; App Store public release.

## 4. Invariants (MUST keep)
- I1 SMS verification is mandatory in every flow.
- I2 In-studio cash is always available on the kiosk (including when the reader is unavailable).
- I3 An uncharged/unresolved card attempt is shown as Verify (visible, not debt, manual resolve); Pending/debt is cash only.
- I4 Price is server-authoritative; the app never supplies or alters an amount.
- I5 Terminal auth, staff-identity isolation, rate limits and eligibility rules are unchanged.
- I6 Android app behavior is unchanged (D3).
- I7 The page never receives secrets, cookies, serials, reader ids or provider objects.

## 5. Functional requirements and acceptance criteria
R1 Reader connect / auto-reconnect
- Given the iPad app is foreground with Bluetooth on and its configured M2 in range
- When the app starts or the reader drops
- Then it connects only to the configured reader (type stripe_m2, approved location, configured serial), retries with bounded backoff, and pushes only coarse readerStatus (connected|connecting|disconnected) to the page.

R2 Existing customer card
- Given an identified customer with a prepared purchase reference
- When card is confirmed
- Then the bridge starts the prepared purchase, the M2 prompts the server-computed amount, and on PAID the web shows success and resets.

R3 Quick repeat
- Given a customer eligible for Quick Repeat
- When they confirm
- Then the same native prepared path as R2 runs with the same server-computed amount (no package holder offered Quick Repeat, per current web rule).

R4 New student card
- Given SMS verification completed server-side (I1)
- When card is confirmed
- Then behavior equals R2 for the new-student price; without verification no purchase is prepared (see new-student-native-m2 spec).

R5 Decline / unresolved
- Given the M2 declines, is cancelled, or the outcome is unknown
- When the attempt ends
- Then the page shows an error or Verify state (I3), nothing auto-retries, and recovery uses the existing recover/reconcile actions.

R6 Reader unavailable
- Given the reader is not connected or fails policy match
- When card is selected
- Then the page sees READER_UNAVAILABLE, shows a card-unavailable message, and cash stays available (I2).

R7 Bridge origin lock
- Given any frame or URL other than the approved https origin main frame
- When it posts to the bridge or navigates
- Then the message is dropped (no reply), foreign main-frame navigation is blocked, and the bridge is invalidated on context replacement.

R8 Session cookie never exposed to JS
- Given the staff terminal session cookie (pli_terminal_session)
- When the app captures it from the WebView cookie store
- Then it is read natively, used only by the native transport, never injected into or returned to JS, and persisted only in Keychain.

R9 Kiosk fullscreen and idle reload
- Given the app is running as a kiosk
- When the web deploy watchdog reloads the exact terminal page while idle
- Then the document reloads, the bridge listener is re-attached, the reader connection stays, and an in-flight sale is never interrupted.

R10 Per-device identity
- Given two tablets with different M2 serials
- When each app runs
- Then each connects only to its own configured reader and rejects the other, with no change to the Android build's pinned reader.

## 6. Open questions (options, recommendation)
OQ1 Per-device reader pinning mechanism
- A build-time config (xcconfig/Info.plist) per device build. B Server-provided via preflight per terminal. C Local provisioning screen storing in Keychain (as Android ReaderProvisioningActivity).
- Rec: A for M2 (one iPad, one reader; simplest, no new server contract), keep C as follow-up. Owner must supply the serial.

OQ2 Apple Developer team and distribution - RESOLVED by D4 (Ad Hoc, Individual team 885NWQD9LK).

OQ3 Kiosk lockdown - RESOLVED by D6 (C, in-app only).

OQ4 iPad model / minimum iPadOS
- A iPadOS 15 (current Package.swift .iOS(.v15)). B iPadOS 16. C latest only.
- Rec: B or the SDK minimum, whichever is higher; test device is iPad12,2. Verify against SDK release notes.

OQ5 Stripe Terminal iOS SDK version
- A Match Android SDK major (5.6.0 on Android; iOS versions are independent). B Latest stable. C Pinned older.
- Rec: B latest stable at implementation, pinned exactly via SPM; verify M2 support and min OS.

OQ6 Secure storage
- A Keychain kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly. B WhenUnlockedThisDeviceOnly. C Always (deprecated).
- Rec: A (kiosk may reboot unattended); ThisDeviceOnly to prevent backup/migration.

OQ7 Web detection
- A UA token (custom suffix on applicationNameForUserAgent). B Shim presence only (window.pliNativeBridge exists). C Both.
- Rec: C. Current isNativeKioskWebView matches Android UA 'wv' only; add an iOS token while keeping the Android regex untouched.

OQ8 Location / Bluetooth permission copy
- A Minimal factual English strings. B Bilingual (en/es). C Generic.
- Rec: B (studio staff are bilingual); NSBluetoothAlwaysUsageDescription and NSLocationWhenInUseUsageDescription (required by Stripe Terminal).

OQ9 Bridge push channel on iOS
- A Native evaluateJavaScript into window.pliNativeBridge.onmessage. B WKScriptMessageHandlerWithReply only. C Polling.
- Rec: A, to satisfy the existing web contract unchanged (see analysis).
