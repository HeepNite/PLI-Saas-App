# Design - ipad-native-m2

## 1. Layout
- `native-kiosk/apps/kiosk-native` (SwiftPM `KioskNative`): all decisions, unit-tested with fakes; no UIKit/StripeTerminal imports.
- `native-kiosk/iosApp` (XcodeGen `project.yml`): thin UIKit/WebKit/SDK glue. Android and Gradle files untouched (D3).

## 2. Components
| File | Role |
|---|---|
| `Configuration` | `OriginPolicy` (exact-origin navigation and message admission), `KioskConfiguration` (Info.plist from xcconfig), `ReaderPolicy` (pinned serial/location/reader id) |
| `SecureBridge`, `BridgeShim` | Closed-envelope bridge (byte-compatible with Kotlin, `conformance/bridge-vectors.json`) and the document-start `window.pliNativeBridge` shim |
| `NativeWebEvents` | `readerStatus` and `collectionPrompt` pushes, only on change, only to a bound page |
| `KioskBridgeHost` | Per web view: no bridge before the terminal page loaded and the session was captured; `KioskContext` wires bridge, events, sale and reader |
| `SaleController` | Bridge registry (`startPreparedPurchase`, `getPreparedPurchaseState`, `diagnosticRoundTrip`, `getReaderStatus`) and the one sale |
| `PurchaseCoordinator` | Session capture/renewal, the retained attempt, startup recovery and settlement |
| `PurchaseServer` | `/api/kiosk/terminal/internal-purchase` actions; `URLSessionHTTPClient` (HTTPS, no jar/cache, no redirects, 64 KiB) |
| `KeychainStore` | Two Keychain items (state, paired reader id), `AfterFirstUnlockThisDeviceOnly`, not synchronizable, read back after write |
| `ReaderConnectionOwner` | Warm M2 link over `TerminalSDKClient`: auto-reconnect, 5/10/20 s retries, first pairing |
| App: `KioskViewController`, `LiveTerminalSDKClient`, `PlatformSeams` | WKWebView host and cookie snapshot, `Terminal.shared` binding, scheduler/Bluetooth/push target |

## 3. Sale and money safety
1. Start only with the pinned reader ready; the server ticket must name that reader.
2. Persist the issuance marker before `prepared-attempt`, then the ticket, then only the PaymentIntent id (never the client secret).
3. SDK retrieve -> collect -> confirm under a 90 s deadline; any SDK id other than the retained one settles instead of continuing.
4. Settlement: `prepared-recover`; PAID (same id) clears and reports `paid`. Otherwise `prepared-cancel`: `canceled` clears, `paid` clears and reports `paid`, anything else keeps the attempt (kiosk locked).
5. Web abandonment (no poll for 10 s, or a new document) cancels only while the reader waits for the card. Background or web process loss rejects the sale without settling; startup recovery owns the attempt.
6. Startup: a retained attempt blocks the capture; with the same browser cookie it is settled as in 4, or, ticket-only, cleared on a fresh `UNCREATED`. A ticketless marker stays locked. After a clear the web view is rebuilt.
7. Any Keychain failure poisons the coordinator until restart.

## 4. Web host
- Main frame may load only `https://pli.palladiumlatin.art/staff/terminal`; popups denied; subframes (Stripe) allowed.
- Messages answered only from the approved origin's main frame while on the terminal URL.
- The `pli_terminal_session` cookie is read from `WKHTTPCookieStore` natively (secure, HttpOnly, host-only, exactly one) and sent only as an explicit Cookie header.
- Without valid reader pins (Debug placeholders) the app is a plain web kiosk: no shim, no bridge.
- Diagnostics: `os.Logger` `com.pli.kiosk`/`PLI-M2`, closed values only, no identifiers.

## 5. Build and rollout
- xcconfig: `Base.xcconfig` (origin, bundle id), `Device-iPad.xcconfig` (serial, location); `scripts/check-device-config.sh` fails Release/AdHoc builds on placeholders. StripeTerminal iOS 6.0.0 pinned, iOS 16.
- Ad Hoc, team 885NWQD9LK. Web iOS detection ships first as its own PR. Pairing and a USD 1 test only with explicit owner approval.
