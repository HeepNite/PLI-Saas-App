# Tasks: kiosk cleanup

Source of truth: `requirements.md` (invariants, criteria) and `analysis.md` (findings). Order matters. The ~400 authored changed line PR size is an advisory planning heuristic, not a hard cap.

Every task: tests alongside code, conventional commit, small PR to `main`, and **propagate to `codex/develop` when the code exists there** (separate approved modular PR; never a full merge).

| ID | Task | Risk | Guarding tests | Notes |
| --- | --- | --- | --- | --- |
| P0a | `npm audit fix` (non-major) plus patched `next`, `@clerk/nextjs`, `@sentry/nextjs` | High: auth middleware | `tsc`, lint, vitest, build; sign-in + staff route smoke | Prisma 7 excluded |
| P0b | Android: fix `MissingPermission` (`StripeTerminalSdkAdapter.kt:186`), add `WebViewFeature` guards (`SecureWebMessageHost.kt:114,133,146`), bump Stripe Terminal 5.8.2 and androidx.webkit 1.18.0 | High: payment SDK | gradle unit tests, lint, APK build | Reader smoke is owner-gated |
| W1 (done) | Remove dead ternaries (`:727`, `:738`), shared `useNowTick`, fix stale comment | Low | existing vitest | ~100 lines |
| W2 | `useEnrollPaymentActions` helpers: ACCOUNT_EXISTS retry, failure handling, sign-in reset | Medium: payment flow | existing enroll tests plus new helper unit tests | Split in 2 PRs if >400 |
| W3 | `bridgeRequest` helper replacing 3 promises in `native-payment-bridge.ts`; unit test for `runNativePreparedCheckout` | Medium: money path | new test: paid, failed, timeout, no automatic fallback; 256 reply cache | Test first |
| W4 | Merge the two QR pollers and the two checkout API helper modules | Medium | poller tests: cadence, stop conditions, cash grant | Keep QR in-studio cash grant |
| W5 | Remove `window.pliNativeAttemptState` and `/api/checkout/native-attempt-state` | Medium | route 404 test, bridge contract test | Only after owner confirms |
| S1 | Remove `/api/checkin/phone/identify` | Low | route removal test | Only after 30-day log check = 0 hits |
| S2 | Remove `/api/kiosk/terminal/connection-token` | Medium | route removal test | Only after 30-day log check = 0 hits |
| A1 | Android: remove legacy runtime (`KioskApplication.kt:270-342`) and `OperatorActivity`; replace hard-coded reader id (`:510`) with terminal assignment | High | gradle tests, startup recovery tests | Multi-terminal assignment preserved |
| A2 | Android: remove legacy `PurchaseApi`/coordinator; keep decoding `AttemptMode.LEGACY` fail-closed | High | LEGACY decode fail-closed test | 2 PRs |
| S3 | Server: remove legacy actions; drop product/price part of `verifyLiveCatalog` (`internal-purchase.service.ts:76-93,523,537-545`), keep merchant/location | High | service tests: connection-token works with price archived | Only after A1/A2 deployed |
| S4 | Naming (`prepared-native-*` vs `native-prepared-purchase`) and remove temporary diagnostics (`internal-purchase/route.ts:19-26`) | Low | existing tests, import checks | Rename-only commit |
| S5 | Remove webhook legacy branch | High | webhook tests for current branch | Only after DB check shows no legacy purchases |
| I1 | iPad: rebase on main with cleanup, deliver | Medium | `swift test` | After A1/A2 contract is final |

## Order and gates

1. P0a, P0b first (security), independent of each other.
2. W1 -> W2 -> W3 -> W4 (web); W5 gated on owner.
3. S1, S2 gated on log evidence.
4. A1 -> A2 -> S3 (strict order: server legacy removal last).
5. S4 anytime after W3. S5 gated on DB check. I1 last.
