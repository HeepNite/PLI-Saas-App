# Analysis: kiosk cleanup

Audit summary from 2026-10-31. Line references are against `origin/main` at the time of the audit and must be re-checked before each task.

## Security

| Finding | Detail | Action |
| --- | --- | --- |
| `npm audit` | 4 critical, 13 high. `next`; `@clerk/nextjs` + `@clerk/shared` (middleware/route-protection bypass); `@sentry/nextjs` (tunnel middleware bypass). | P0a patched upgrades |
| Prisma | `prisma` / `@prisma/config` high; fix needs major 7.x. | Separate later spec |
| Transitive | `sharp`, `nanoid`, `postcss`, `fast-uri`, `brace-expansion`, `js-cookie`, `browserslist`, `source-map-js`. | P0a `npm audit fix` (non-major) |
| Android lint | `MissingPermission` at `StripeTerminalSdkAdapter.kt:186` (the only lint error). | P0b |
| WebView | `WebViewFeature` support guards needed at `SecureWebMessageHost.kt:114,133,146`. | P0b |
| Dependencies | Stripe Terminal 5.6.0 -> 5.8.2; androidx.webkit 1.12.1 -> 1.18.0. | P0b |
| Checked OK | Android manifest, iOS configuration. | none |
| Secret scan | gitleaks: 33 findings, all false positives. semgrep: 1 false positive. | none |

## Cleanup

### Legacy USD 1 flow (dead, but still coupled)
- The legacy flow is unreachable, yet `verifyLiveCatalog` runs on every connection-token request and checks price `pli_internal_usd1_live` (`apps/backend/src/terminal/internal-purchase.service.ts:76-93,523,537-545`). Archiving that price today would break both readers. Removing this dependency is the one approved behaviour change.
- Android `initializeRuntime` builds the legacy runtime (`KioskApplication.kt:270-342`) for the unreachable `OperatorActivity`.
- Dead routes (confirm with 30-day logs): `/api/kiosk/terminal/connection-token`, `/api/checkin/phone/identify`.
- Maybe dead: `window.pliNativeAttemptState` and `/api/checkout/native-attempt-state` (needs owner confirmation).

### Web duplication
- `useEnrollPaymentActions.ts` (927 lines): 4x ACCOUNT_EXISTS retry, 4x failure handling, ~12x sign-in reset, dead ternaries at `:727` and `:738`.
- `native-payment-bridge.ts`: request/timeout promise repeated 3x (`:133-155`, `:179-201`, `:211-231`).
- Two QR pollers have drifted: `useKioskQrCheckoutPoller.ts` vs `enroll/effects/kiosk-qr-poller.ts`. API helpers duplicated: `lib/checkin/checkin-qr-api.ts` vs `enroll/effects/checkout-api.ts`.
- Three separate 30 s clocks (candidate for a shared `useNowTick`).

### Other
- Android hard-coded reader id at `KioskApplication.kt:510` (conflicts with multi-terminal assignment).
- Naming split: `lib/stripe/prepared-native-*` vs `lib/checkout/native-prepared-purchase.ts`.
- Temporary diagnostics in `internal-purchase/route.ts:19-26`.
- Test gap: no direct test for `runNativePreparedCheckout`.

## Estimate

About 3,500 removable lines across web, server and Android, mostly legacy code and duplication.

## Risks

- Removing the catalog check or legacy actions before both Android clients stop calling them breaks readers: hence S3 only after A1/A2.
- Route removals need real log evidence, not code reading alone.
- Dependency upgrades touch auth middleware: verify sign-in and staff routes after P0a.
