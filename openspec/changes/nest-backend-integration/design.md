# Design: Nest Backend Integration

## Technical Approach

Phase 1 keeps Next.js as the public BFF and security edge for all existing `/api/*` contracts. Nest is introduced as an internal service boundary reached only by server-to-server calls from selected Next Route Handlers. The first slices prove gateway, auth, rollback, and contract preservation before moving payment or attendance writes. Native kiosk payment support is designed for Stripe Terminal Tap to Pay, while customer identity remains web/PWA QR based.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Public boundary | Keep Next `/api/*` as the only browser/PWA entry point initially | Direct client-to-Nest or full backend rewrite | Preserves Clerk cookies, middleware, terminal cookie flows, and existing frontend fetch contracts. |
| Nest role | Internal orchestration service behind a Next gateway | Keep all backend logic in Next | Creates the future payment/kiosk service boundary without rupturing current behavior. |
| Kiosk app | KMP feasibility spike with native Stripe SDK bridge proof; fallback to separate native iOS + Android apps using official Stripe Terminal SDKs | React Native, Flutter-first, browser/PWA reader, NFC identity | The preferred path is one shared KMP codebase only if Tap to Pay is proven reliable on both platforms quickly. If not, use the official native iOS and Android Stripe Terminal SDKs directly. React Native is acknowledged as Stripe-supported but intentionally not selected as the fallback. Browser/PWA cannot be a Tap to Pay reader. |
| Write ownership | One authoritative writer per subdomain per slice | Temporary dual writes from Next and Nest | Prevents duplicated Purchase, Attendance, PackageUsageLedger, and Stripe webhook side effects. |
| First payment migration | Keep Stripe webhook and current checkout writes in Next until an explicit cutover | Move webhook plus Terminal writes immediately | Current write boundary is concentrated in `app/api/stripe/webhook/route.ts`; moving it early is high risk and likely exceeds review budget. |

## Data Flow

Phase-1 gateway:

```text
Browser/PWA/Kiosk shell -> Next /api/* -> Clerk or terminal/session guard -> Nest internal API -> Prisma/PostgreSQL
                         -> fallback to existing Next handler when feature flag is off or Nest is unavailable
```

Tap to Pay target flow:

```text
Native kiosk app -> Next kiosk API -> Nest Terminal orchestration -> Stripe Terminal/PaymentIntent
                                           |
                                           v
                         single writer records Purchase + Attendance side effects
```

QR identity flow:

```text
Customer web/PWA QR scan -> Next Clerk auth -> Nest/Next check-in decision -> package credit OR account drop-in path
```

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/nest-backend-integration/design.md` | Create | This design artifact. |
| `app/api/**/route.ts` | Modify later | Wrap selected routes with feature-flagged Next-to-Nest delegation while preserving request/response/status contracts. |
| `lib/nest-gateway/client.ts` | Create later | Internal Next server client for Nest, timeout, auth header, fallback classification. |
| `apps/backend/**` or `backend/**` | Create later | Minimal Nest app, modules, controllers, and service tests. Final path decided during tasks. |
| `app/api/stripe/webhook/route.ts` | Modify later | Remains Next-owned until payment-domain cutover; later delegates or transfers ownership in one slice. |
| `prisma/schema.prisma` | Modify later only if required | Add kiosk/Terminal session models only in a dedicated migration slice. |

## Interfaces / Contracts

Initial internal contracts are intentionally narrow:

- `GET /internal/health` returns `{ ok: true, service: "nest" }` for gateway readiness.
- `POST /internal/checkin/qr/decision` accepts Clerk-resolved `customerId`, class/time context, and request correlation; returns a server decision matching the current Next response envelope.
- `POST /internal/terminal/connection-token` creates Stripe Terminal connection tokens only for authenticated kiosk device/session requests.
- `POST /internal/terminal/payment-intents` creates anonymous drop-in PaymentIntents with class/time, reader/session, and idempotency metadata.
- `POST /internal/terminal/payment-confirmations` records only after the owning runtime for that slice is Nest.

Internal Next-to-Nest trust uses a server-only shared secret or signed service token, request IDs, short timeouts, and no direct public Nest exposure.

## Auth / Trust Boundaries

- Clerk/customer identity is validated in Next first for browser and PWA flows.
- Staff terminal cookie and kiosk session identity remain validated by existing Next helpers first.
- Nest receives already-admitted principal/device context plus an internal trust proof; it must still validate required fields and idempotency keys.
- Anonymous Tap to Pay is allowed only for class-scoped drop-in payment; account/package flows require Clerk-backed identity and server-side package eligibility decisions.

## Data Ownership Rules

- Next remains the writer for existing checkout, Stripe webhook, Purchase, Attendance, PackagePurchase, PackageUsageLedger, and points side effects until a cutover task says otherwise.
- Nest may read/orchestrate in pre-cutover slices but must not persist authoritative side effects for Next-owned domains.
- Payment/check-in cutover must move PaymentIntent confirmation, webhook/confirmation handling, Purchase creation, Attendance creation, and package credit consumption together or keep them all in Next.
- Prisma transactions must wrap attendance creation plus package credit decrement plus usage ledger creation.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Gateway fallback, internal auth header creation, ownership guards, package decision logic | Vitest, TDD first. |
| Integration | Next route preserves public contract while Nest is enabled/disabled | Existing `tests/api/**` patterns plus Nest client mocks. |
| E2E | QR identity and kiosk rollback paths | Playwright only after stable slices. |
| Contract | Internal DTOs and error mapping | Shared TypeScript types or schema tests before implementation. |

## Migration / Rollout

Use feature flags per route: `NEST_GATEWAY_ENABLED`, route-specific flags, and a short gateway timeout. Rollback disables the flag and returns traffic to the current Next handler. Recommended chained slices: (1) gateway client + Nest health check, (2) one read-only/decision endpoint, (3) QR identity decision extraction, (4) KMP bridge feasibility proof with native iOS + Android fallback decision, (5) Terminal connection-token slice, (6) anonymous drop-in PaymentIntent slice, (7) single-writer payment/check-in cutover.

## Open Questions

- [ ] Final Nest app directory: `apps/backend/**` vs `backend/**`.
- [ ] Final kiosk delivery path after KMP native SDK bridge spike or fallback to separate native iOS + Android apps.
