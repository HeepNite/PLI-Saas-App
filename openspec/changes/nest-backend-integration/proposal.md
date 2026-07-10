# Proposal: Nest Backend Integration

## Intent
Split backend orchestration from the Next app without breaking current web contracts. The business outcome is a scalable service boundary that can later support native Tap to Pay kiosk flows while preserving current check-in and checkout behavior during migration.

## Scope
### In Scope
- Keep Next.js as the public BFF and migrate selected domains to Nest behind unchanged `/api/*` contracts.
- Define first-slice backend domains: kiosk/check-in and checkout/payments, with native kiosk app payment acceptance and customer web/PWA QR identity.
- Establish migration rules for shared DB access, single-writer ownership, and chained PR slices under the 400-line review budget.

### Out of Scope
- Replacing current customer web/PWA with a native customer app.
- NFC-based customer identity, direct browser Tap to Pay, or full backend extraction in one step.

## Capabilities
### New Capabilities
- `nest-bff-gateway`: Next proxies stable contracts to internal Nest services during migration.
- `kiosk-tap-to-pay`: Native kiosk app accepts Stripe Terminal Tap to Pay and reports results through backend orchestration.
- `customer-qr-identity`: Logged-in customers use web/PWA QR flows so kiosk users do not type phone numbers.
- `migration-domain-ownership`: Per-domain single-writer and rollback rules for Next/Nest coexistence.

### Modified Capabilities
- None.

## Approach
Adopt gradual extraction. Phase 1 keeps Clerk and existing terminal/session boundaries in Next, adds a minimal Nest service plus an internal gateway, and proves the pattern with a read-only slice first. Payment writes stay on existing Next/Stripe webhook flows until specs define a single Nest-owned payment/check-in slice. Kiosk app platform decision starts with a KMP feasibility spike; if KMP does not quickly prove reliable Stripe Terminal/Tap to Pay support on both iOS and Android, the fallback is separate native iOS and native Android implementations using the official Stripe Terminal SDKs. React Native is acknowledged as Stripe-supported but is intentionally not the fallback path. Flutter MUST NOT be assumed first-class for Tap to Pay.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `openspec/changes/nest-backend-integration/proposal.md` | New | Proposal baseline |
| `app/api/**` | Modified | Next BFF proxies and contract preservation |
| `app/api/checkin/qr/**` | Modified | QR identity and kiosk bootstrap boundaries |
| `app/api/checkout/**`, `app/api/stripe/webhook/route.ts` | Modified | Deferred single-writer payment migration |
| `lib/checkout/**`, `lib/security/staff-terminal.ts` | Modified | Shared orchestration/session boundaries |
| `prisma/schema.prisma` | Modified later | Models: `Purchase`, `Attendance`, `PreparedCheckoutContext`, `StaffTerminalSession`, `KioskSession`; no migration in bootstrap slice |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dual-writer regressions between Next and Nest | High | Enforce per-domain writer ownership in specs/design |
| KMP Tap to Pay integration complexity | High | Treat KMP as spike; fall back to separate native iOS + Android SDK implementations |
| QR identity edge cases for anonymous vs account users | Med | Specify scan states, expiry, and fallback rules |

## Rollback Plan
Ship migration behind Next-owned routes. If a slice fails, route traffic back to existing Next handlers and disable the Nest-backed path without changing public contracts.

## Dependencies
- Nest service bootstrap and internal auth between Next and Nest.
- Stripe Terminal platform verification for KMP vs separate native iOS + Android implementations.

## Success Criteria
- [ ] First migrated slice preserves current `/api/*` contracts with zero rupture for web clients.
- [ ] Proposal leads to chained specs/tasks where each initial PR slice stays reviewable under 400 changed lines.
- [ ] Specs resolve kiosk platform choice, QR identity rules, and payment/check-in writer ownership before implementation.
