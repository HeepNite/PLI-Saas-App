# ipad-native-m2

## Objective
Native Swift iPad kiosk app with the same dynamic as the production Android app: WKWebView hosting /staff/terminal plus a Stripe Reader M2 over Bluetooth through the closed-schema bridge.

## Problem / why
The studio runs two independent tablets (Samsung Android + iPad 9th gen), each with its own M2. Only Android can collect card payments today.

## Source of truth
docs/specs/ipad-native-m2/ (requirements, analysis, resolve, design, tasks). Plan approved by owner 2026-10-27.

## Scope and constraints
- Android app behavior unchanged; server contracts unchanged; one web change (iOS detection) in its own PR to main, then propagated to codex/develop.
- Second M2 serial STRM2D533025667, location tml_GqQ6wPY5rSAhAt, bundle id com.pli.kiosk.livefoundation.
- Signing: Individual team 885NWQD9LK, Ad Hoc. No OS lockdown (D6).
- No USD 1 payment without explicit owner approval. Push/PR/merge are owner decisions.

## Execution
- Branch: feat/ipad-native-m2 (worktree PLI-Saas-App-worktrees/ipad-native-m2), base origin/main 2b8f5b31.
- TDD: strict RED -> GREEN (source: convention of prior native-m2 features in odd/tasks). Runners: `swift test` in native-kiosk/apps/kiosk-native; `npx vitest run` for web; `xcodebuild` for the app target.
- Delivery strategy: ask-on-risk; forecast exceeds 400 lines, so chain strategy is asked before the first PR.

## Checklist (route per task)
- [x] I1 Verify server contracts do not hard-pin the Android serial (inline, read-only)
- [x] I2 Bridge parity in Swift package (delegated writer)
- [x] I3 Conformance vectors + xcconfig scaffolding (delegated writer)
- [x] I4 Origin policy + shim + events (delegated writer)
- [x] I5 Reader policy, connection owner, adapter protocol (delegated writer)
- [x] I6 Prepared-purchase operations registry (delegated writer)
- [x] I7 Staff session transport + Keychain store (delegated writer)
- [x] I8 Xcode app target native-kiosk/iosApp (delegated writer)
- [x] I9 Stripe Terminal adapter (delegated writer)
- [ ] I10 Simulator smoke, no reader
- [ ] I11 Web iOS detection PR to main (+ codex/develop)
- [ ] I12 Ad Hoc signing + RELEASE.md
- [ ] I13 Install on production iPad, no reader
- [ ] I14 Pair second M2 + USD 1 test (owner approval required)

## Simplification (target ~2,300 prod + ~1,700 test lines; money-safety invariants and bridge conformance vectors stay unchanged)
- [x] S1 Delete unused startup classifier and unused NativeCollectionRuntime API (core 199 -> 194, bridge 48; total 242)
- [x] S2 Shrink WebKitBridgeAdapter to replyJSON only (core 194, bridge 48 -> 43; total 237)
- [x] S3 Remove native staff login and Set-Cookie parsing (core 194 -> 189, bridge 43; total 232)
- [x] S4 Startup/reload recovery of a retained prepared attempt (Android rollover rules ported in WebSessionReadiness; RED: test target failed to compile, StartupRecovery missing; GREEN core 189 -> 198, bridge 43; total 241. Non-paid statuses incl. canceled stay retained exactly as on Android; KioskApplication paidRollover is operator-runtime-only and not applicable to the web-hosted iPad flow)
- [x] S5 Merge KioskNativeBridge + KioskNativeCore into one KioskNative module and one test target (swift test 241 total, 0 failures; simulator build OK; blanket `public` removal abandoned: transitive public API closure makes it churn for no gain)
- [x] S6 StrictFlatJSON (168 lines) replaced by Codable DTOs + JSONDecoder in StaffSessionPurchaseApi (swift test 241 total, 0 failures; simulator build OK; dropped duplicate-key/unknown-key/control-char-in-opaque-string tests, 1.0/1e3 expiry now accepted as integers)
- [x] S7 SecureBridge envelope parser (hand-written UTF-16 parser) replaced by JSONSerialization + explicit shape checks; a ~25-line key-count scan stays because Foundation collapses duplicate keys and accepts trailing commas, both required by bridge-vectors.json (vectors, BridgeConformanceTests unchanged; swift test 241 total, 0 failures; simulator build OK)
- [x] S8 Collapse SDK layers: TerminalAdapter loses the reuse/non-cancellable sentinels, per-sale onDisconnect and observedReaderId; StripeTerminalAdapter loses warm-link reuse (only the owner connects); ReaderPolicy loses ticket matching/isReusable. TerminalSDKClient + StripeTerminalAdapter kept: the unregistered-alias/location mapping stays unit-tested (folding it into the untestable LiveTerminalSDKClient would lose that). Landed with S10
- [x] S9 Sale controller: SaleController (one in-flight sale: owner-ready reader id == ticket reader id -> prepared-attempt (marker first) -> prepared-payment-intent -> retrieve/collect/confirm with 90 s deadline -> prepared-recover, paid only on fresh PAID; otherwise prepared-cancel, clear only on `canceled`; P3 renewal, P4 abandonment, P5 lines kept) wired in ProductionBridgeComposition; sales reuse the warm owner link (no sale discovery/connect), owner tokens no longer refused while an attempt is retained (mid-sale reconnect). Tests written after the code; mutation checks (paid gate, reader-id check, abandonment window) each turned SaleControllerTests red. swift test 281, 0 failures; simulator BUILD SUCCEEDED; prod 5116 / test 4674 lines (old files still present)
- [x] S10 Delete old runtime/bootstrap/workflow: NativeCollectionRuntime, NativeCollectionBootstrapRuntime, PinnedReaderBootstrap, ProductionPreparedBridgeWorkflow, PaymentRecovery seam and their tests; owner loses retireDiscovery/saleBootstrapWaitMs (readyReaderId test added). swift test 221, 0 failures; simulator BUILD SUCCEEDED; prod 3857 / test 3654 lines
- [x] S11 Simplify web host lifecycle: shim (document start) and the `pliNative` handler are installed when the web view is created; KioskBridgeHost (package, tested) creates the bridge only after the exact terminal page finished loading with a fresh native cookie snapshot and a captured session (startup recovery runs inside that capture), answers only approved-origin main-frame messages on the terminal page, and on a new document unbinds events and abandons its sales (P4) while keeping the bridge; background/process loss invalidates it for good and the app builds a fresh web view. prod 3643 / test 3578 lines. Dropped: load->capture->reload dance, KioskWebHostLifecycle, KioskWebHost/KioskWebHostContext protocols, WebKitKioskHost, readiness currentSession/ready/URL args. Behaviour change: a same-page reload with a sale in flight keeps the bridge (sale abandoned per P4 and settled) instead of invalidating it until the next foreground. RED: test target failed to compile (no KioskBridgeHost). GREEN: swift test 216, 0 failures; simulator BUILD SUCCEEDED (xcodegen regenerated for the WebPushTarget rename)
- [x] S12 Single in-flight operations + owner trim: PreparedBridgeOperations keeps one sale (a start while one is pending is rejected without launch; a terminal sale is replaced; no 32-entry registry/capacity); PreparedBridgeWorkflow + PreparedBridgeLifecycle merged (launch, invalidate, onWebAbandoned); ReaderConnectionOwner loses the static owner registry (owners never overlap: the host stops the old one before building a new one; a stale late connection now always releases its link), onApplicationActive (unused) and the ReaderConnectionLifecycle protocol. swift test 209, 0 failures; simulator BUILD SUCCEEDED; prod 3561 / test 3424 lines (target 2300 / 1700 not reached: remaining bulk is outside S8-S12 scope, e.g. SecureBridge, KeychainStateStore, PurchaseCoordinator, WebSessionReadiness)

## Android parity fixes (port of main #746-#752; Kotlin on main is the reference; route: single delegated writer, TDD strict)
- [x] P1 Bridge replay cache evicts oldest at 256 instead of refusing (#750). RED: conformance vector + 2 SecureBridgeTests failed (RESPONSE_CACHE_EXHAUSTED from id-256 on). GREEN: swift test 242, 0 failures; simulator BUILD SUCCEEDED. RESPONSE_CACHE_EXHAUSTED removed from the closed error set; WebKitBridgeAdapter needed no change (error replies were never pushed).
- [x] P2 Prepared sale not paid -> server prepared-cancel, clear retained attempt only on `canceled` (#746/#747). PurchaseCoordinator.cancelUnpaidPreparedAttempt (clear read back), StaffSessionPurchaseApi.preparedCancel, workflow settleNotPaid (only when the runtime holds an attempt), startup rollover in WebSessionReadiness. RED: test target failed to compile (no preparedCancel). GREEN: swift test 249, 0 failures; simulator BUILD SUCCEEDED. Supersedes S4 note "canceled stays retained".
- [x] P3 Renew captured staff session at sale admission (#748). WebSessionReadiness.renewCapturedSession (same cookie, no retained attempt, never adopts another session); workflow calls it before startPrepared; PurchaseCoordinator.load refuses an expired session without poisoning; app refreshes the WKHTTPCookieStore snapshot (off-main, 2 s bound) before renewing. RED: test target failed to compile (no renewCapturedSession). GREEN: swift test 253, 0 failures; simulator BUILD SUCCEEDED.
- [x] P4 Cancel collection when the web abandons the sale (#752). PreparedBridgeOperations liveness watchdog (10 s without a poll) + onDocumentRetired (lifecycle reports page start / non-kept main-frame navigation); workflow onWebAbandoned cancels only via NativeCollectionRuntime.cancelWhileAwaitingCard (retrieving/collecting), keeps a read card, rejects before collection and blocks a later collection start. RED: test target failed to compile (no onWebAbandoned). GREEN: swift test 259, 0 failures; simulator BUILD SUCCEEDED.
- [x] P5 Identifier-free diagnostics (#749 + lines from #748/#752). KioskDiagnostics (os.Logger subsystem com.pli.kiosk, category PLI-M2, public privacy, closed values only): bridge reply (once per op/state change) / refused, event pushed/skipped/delivered/dropped, prepared cancel outcome, retained attempt cleared, sale session renewal refused, sale admission rejected reason (PurchaseCoordinator.preparedAdmissionBlocker), sale abandoned by web. RED: test target failed to compile (no KioskDiagnostics). GREEN: swift test 262, 0 failures; simulator BUILD SUCCEEDED. Not ported: bootstrap/owner/SDK lines that predate #746 (out of the requested list).

## Cleanup (2026-10-28, owner: remove everything unused; route: single delegated writer, no SDD)
Measured with `wc -l` on package Sources + iosApp/App (prod) and package Tests (test); base 1b48744d.

| Category | Before | After |
|---|---|---|
| Production Swift | 3,561 | 2,132 |
| Swift tests | 3,424 (209 tests) | 1,468 (68 tests) |
| Xcode project | 464 | 456 |
| Scripts/config | 249 | 202 |
| Spec docs (docs/specs/ipad-native-m2) | 330 | 304 |
| Conformance vectors | 128 | 128 (unchanged, green) |

- [x] C1 944d8a07 chore: unused redirect flag, fake-only API defaults, guard self-test (+18/-102)
- [x] C2 ce32e441 refactor: reader and sale use `TerminalSDKClient` directly; `TerminalAdapter`, `StripeTerminalAdapter`, `ConnectedReader` deleted (+387/-1258)
- [x] C3 d1152050 refactor: `PurchaseCoordinator` absorbs `WebSessionReadiness`; `PurchaseServer` replaces transport/API/token source; `KeychainStore` replaces both stores; `SaleController` absorbs `PreparedBridgeOperations`; `KioskContext`/`KioskBridgeHost` replace context + composition; config files merged; tests rewritten per component over fake Keychain/server/SDK (+1509/-3776)
- [x] C4 13b29d48 refactor: models, events, HTTP client and app glue trimmed (+130/-317)
- [x] C5 4fdfdee7 refactor: app composition folded into `KioskViewController` (+40/-71)
- [x] C6 docs: design.md rewritten for the merged layout; resolve.md "Cleanup decisions"
- Evidence: every commit `swift test` green (final 68 tests, 0 failures) and simulator `BUILD SUCCEEDED`. Mutation checks on the final code each turned the suite red: paid without server PAID, ticket/reader binding, abandon-after-card-read cancel, PaymentIntent id binding on collection and on recover, clear on non-`canceled` cancel, second attempt while one is retained, pinned reader id, origin admission.
- Production target (2,000) not reached: 2,132 lines, of which about 180 are doc comments and 250 blank lines (not removed for line count); the remaining code is the money-safety path, the bridge byte contract and SDK/WebKit glue.

## Progress / evidence
- 2026-10-28: rebased feat/ipad-native-m2 onto origin/main (b6891c86, includes #746-#752) with no conflicts; baseline swift test 241, 0 failures; simulator BUILD SUCCEEDED. P1-P5 ported, one commit each.
- 2026-10-27: spec written and approved; feature document created.
- 2026-10-27: I2 done. Swift bridge aligned with Kotlin (paid, operation field, 3-arg handler, SHA-256 replay, cache stays open, UTF-16 bounds, strict UTF-16 JSON, closed SCREAMING_SNAKE errors, replyJSON byte-identical to SecureWebMessageAdapter). RED: build failed on new API (56 compile errors); GREEN: swift test 23 tests, 0 failures (was 10).

- 2026-10-27: I3 done (commit "feat(ios-kiosk): add bridge conformance vectors and device build config (I3)"). Shared native-kiosk/conformance/bridge-vectors.json from Kotlin SecureWebBridgeTest cases; Config/Base + Device-iPad xcconfig; scripts/check-device-config.sh guard. RED: conformance test failed (vectors missing), guard test 13/16 (script missing). GREEN: swift test 24 tests, 0 failures (was 23); guard test 16/16; guard exits 1 on placeholders, 0 on real values.

- 2026-10-27: I4 done (commit "feat(ios-kiosk): add origin policy, web events and bridge shim (I4)"). OriginPolicy, NativeWebEvents (+ClosureWebEventTarget), BridgeShim (JSON-safe literals; shim executed in JavaScriptCore in tests). RED: test target failed to compile (cannot find OriginPolicy/NativeWebEvents/BridgeShim). GREEN: swift test 48 tests, 0 failures (was 24).

- 2026-10-27: I5 done (commit "feat(ios-kiosk): add reader policy and connection owner (I5)"). New SwiftPM target KioskNativeCore: ReaderPolicy (serial/location injected), ReaderConnectionOwner (5/10/20 s backoff, virtual-clock tests, readerStatus/collectionPrompt via NativeWebEvents), PinnedReaderBootstrap, TerminalAdapter protocol. Difference from Kotlin: owner accepts a nil pinned reader id at first pairing (serial/type/location), pins the learned id and reports it via onReaderPaired; PinnedReaderBootstrap still requires a concrete id. RED: KioskNativeCoreTests failed to compile (cannot find ReaderPolicy/ReaderConnectionOwner/PinnedReaderBootstrap). GREEN: swift test 96 tests, 0 failures (core 48 new + bridge 48).

- 2026-10-27: I6 done (commit "feat(ios-kiosk): add prepared purchase bridge operations (I6)"). PreparedBridgeOperations registry (startPreparedPurchase 43-char ref, getPreparedPurchaseState 128, diagnosticRoundTrip empty schema; capacity 32, terminal-only eviction, invalidation poisons late completions), PreparedBridgeComposition (getReaderStatus via NativeWebEvents, 32-byte base64url operation refs), PreparedBridgeWorkflow/Lifecycle protocols, StaffSession/PaymentResult/PreparedPurchaseApi/PreparedPurchasePaymentRecovery models. Not ported (open): Kotlin ProductionPreparedBridgeWorkflow (needs PurchaseCoordinator + NativeCollectionRuntime state machine, not in I5-I7 scope). RED: tests failed to compile (cannot find PreparedBridgeOperations/StaffSession/PaymentResult/...). GREEN: swift test 119 tests, 0 failures (core 71 + bridge 48).

- 2026-10-27: I7 done (commit "feat(ios-kiosk): add staff session transport and keychain store (I7)"). StaffSessionTransport (login, importBrowserSession via injected StaffSessionCookieProvider, postInternalPurchase), StaffSessionPurchaseApi (prepared-attempt, prepared-payment-intent, prepared-recover, prepared-creation-status) + StaffSessionConnectionTokenSource (connection-token), StrictFlatJSON, URLSessionHTTPClient (https only, no cookie jar, redirects refused, 64 KiB bound), KeychainStateStore (KeychainClient seam; AfterFirstUnlockThisDeviceOnly + synchronizable=false asserted), RetainedStartupState classifier. Legacy Android-only actions (student-lookup, preflight, attempt, payment-intent, recover) not ported. RED: tests failed to compile (cannot find DurableState/RetainedStartupState/classifyRetainedStartupState, then transport/store types). GREEN: swift test 163 tests, 0 failures (core 115 + bridge 48). Real SecItem round trip is not unit-tested (needs signed device/simulator): covered by I10/I13.

- 2026-10-27: I8 done (commit "feat(ios-kiosk): add iPad kiosk app target with secure web host (I8)"). native-kiosk/iosApp generated by XcodeGen (project.yml + committed PLIKiosk.xcodeproj): SwiftUI host, KioskViewController (WKWebView, exact-origin main-frame lock, popups denied, Stripe subframes allowed as in Kotlin da1e7602, document-start shim, no-reply `pliNative` handler admitted via OriginPolicy, evaluateJavaScript push, WKHTTPCookieStore snapshot -> StaffSessionCookieProvider, idle timer disabled while active, status bar/home indicator hidden, no lockdown APIs). Package gains KioskConfiguration, KioskWebHostLifecycle (port of Kotlin lifecycle, session-gated bridge, idle reload keeps bridge) and WebSessionReadiness. StripeTerminal iOS 6.0.0 pinned exact (min iOS 16 -> deployment target 16.0). Info.plist bilingual en/es Bluetooth+Location strings, UIBackgroundModes bluetooth-central (Stripe setup docs require it for reader standby). Guard script wired as first build phase. RED: tests failed to compile (KioskConfiguration/KioskWebHostLifecycle missing). GREEN: swift test 179 tests, 0 failures (core 131 + bridge 48); xcodebuild Debug simulator BUILD SUCCEEDED; Release with placeholder pins fails in the guard phase, Release with real pins builds (CODE_SIGNING_ALLOWED=NO). WebKit glue (KioskViewController, WebKitKioskHost) is thin and not unit-tested; covered by I10.

- 2026-10-27: I9 done (commit "feat(ios-kiosk): wire Stripe Terminal reader and prepared workflow (I9)"). Core: TerminalSDKClient seam + StripeTerminalAdapter (discovery generations, warm-link reuse, context-checked connect, unregistered alias for first pairing), KeychainPairedReaderStore, PurchaseCoordinator (prepared), NativeCollectionRuntime + NativeCollectionBootstrapRuntime, ProductionPreparedBridgeWorkflow, PreparedBridgeContext + ProductionBridgeComposition (end-to-end tests through the closed bridge with fake terminal/server); ReaderConnectionOwner confirms an alias connection by hardware. App: LiveTerminalSDKClient (Terminal.shared binding), CoreBluetoothPermissions, DispatchDeadlineScheduler, composition wired. TDD: adapter, paired store, coordinator, workflow and composition tests written RED first (compile failure on missing types); NativeCollectionRuntime and bootstrap adapter were written before their tests (tests added immediately, one mutation check confirmed the intent-id guard is covered). GREEN: swift test 247 tests, 0 failures (core 199 + bridge 48); xcodebuild Debug simulator BUILD SUCCEEDED; Release with placeholder pins fails in the guard; simulator launch loads /staff/terminal. LiveTerminalSDKClient and platform seams are thin and verified only by build + I14 on-device matrix.
- 2026-10-28: ticket-only lock fix — a sale that ends after ticket issuance without a PaymentIntent id now resolves it in-session through the shared settle path (creation-status UNCREATED clears; CREATED fetches the bound intent then recover/cancel; error stays locked). RED then GREEN: swift test 69, 0 failures; simulator build succeeded.

## Next step
I10 (simulator smoke, no reader), then the on-device matrix (I13/I14) on the cleaned-up sale path.
