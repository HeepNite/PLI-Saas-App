# Tasks - ipad-native-m2

Heuristic: ~400 changed lines per task (advisory). Each task ends with a work-unit commit (conventional) including tests/docs. Branch: feat/ipad-native-m2.

- [x] I1 Verify server contracts (read-only): confirm preflight/token endpoints do not hard-pin the Android serial; record in resolve.md. Check: rg evidence cited.
- [x] I2 Bridge parity in package: add paid state, operation field, new handler signature, SHA-256 replay, cache-stay-open, UTF-16 bounds, strict JSON, closed errors. Check: `swift test` (RED vectors first).
- [x] I3 Conformance vectors + build config scaffolding: `bridge-vectors.json` consumed by tests; xcconfig layers and placeholder-serial build guard. Check: swift test; guard fails on Release with placeholder.
- [x] I4 Admission/origin policy + shim + events: pure `OriginPolicy`, `NativeWebEvents`, shim script text generator (JSON-safe literals). Check: swift test (origin edge cases: port, http, subdomain, null frame).
- [x] I5 Core logic: `ReaderPolicy`, `ReaderConnectionOwner` (5/10/20 s backoff), `PinnedReaderBootstrap`, `TerminalAdapter` protocol with fakes. Check: swift test with fake clock.
- [x] I6 `PreparedBridgeOperations` registry (startPreparedPurchase, getPreparedPurchaseState, diagnosticRoundTrip) + field limits. Check: swift test vs Kotlin test cases.
- [x] I7 `StaffSessionTransport` (URLSession, endpoints from analysis section 3) + `KeychainStateStore` (AfterFirstUnlockThisDeviceOnly) behind protocols. Check: swift test with stubs; Keychain attribute asserted.
- [x] I8 Xcode app target `native-kiosk/iosApp`: SwiftUI host, KioskViewController, WKWebView host (navigation lock, admission, shim, push), cookie reader, idle timer, bilingual permission strings, StripeTerminal SPM pinned exactly (latest stable, verify min iOS). Check: `xcodebuild build` for iPad simulator; no lockdown APIs.
- [x] I9 StripeTerminalAdapter implementation wired to ReaderConnectionOwner and events. Check: xcodebuild build; adapter conformance unit tests via fake SDK boundary.
- [ ] I10 Simulator smoke (no reader): app loads staff terminal, bridge round trip (diagnosticRoundTrip), foreign navigation blocked, READER_UNAVAILABLE and cash visible. Check: recorded manual results.
- [ ] I11 Web PR (separate, targets main): iOS token in `isNativeKioskWebView` + vitest cases; open PR from its own branch; afterwards propagate to codex/develop. Check: `vitest run tests/checkin/native-payment-bridge.test.ts`, lint, typecheck; Android cases unchanged.
- [ ] I12 Ad Hoc signing + RELEASE.md (team 885NWQD9LK, UDID, profile expiry, yearly re-sign, versioning). Check: `xcodebuild archive` + export ad-hoc succeeds.
- [ ] I13 Install on production iPad12,2 (no reader): web detection live (needs I11 deployed), idle reload, background/foreground, reboot. Check: manual matrix rows without payment.
- [ ] I14 Pair second M2 (serial STRM2D533025667): set serial in Device-iPad.xcconfig, register reader to location, on-device pairing, auto-reconnect checks; end-to-end USD 1 test card payment ONLY with explicit owner approval, then refund/verify per owner. Check: manual matrix, server shows PAID, cash/Verify invariants intact.

## Notes
- Cleanup (2026-10-28): class names in I5-I9 were later merged; see design.md section 2 and resolve.md "Cleanup decisions".
- I1-I10 and I12 do not need the serial. I11 is independent and can ship first.
- Never commit/push without owner request; no Co-Authored-By per global rules.
