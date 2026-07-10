## Exploration: Nest backend integration

### Current State
The backend surface is currently implemented inside the Next.js app through Route Handlers under `app/api/**`, backed by shared domain helpers in `lib/**` and a single Prisma/PostgreSQL schema in `prisma/schema.prisma`. The booking and payment flows are tightly coupled to Next server runtime concerns: Clerk session resolution (`auth()`, `clerkClient()`), middleware-based staff API protection, terminal cookie auth (`StaffTerminalSession`), kiosk identification sessions, Stripe Checkout/PaymentIntent creation, Stripe webhook persistence, and staff/kiosk polling endpoints. Client components call these `/api/*` routes directly with `fetch`, and no relevant server actions were found in this surface. There is no existing Stripe Terminal / Tap to Pay backend capability yet: no connection-token, reader, or Stripe Terminal orchestration code exists.

### Affected Areas
- `app/api/checkout/session/route.ts` — creates Stripe Checkout Sessions and embeds payment metadata used downstream.
- `app/api/checkout/intent/route.ts` — creates PaymentIntents for embedded card flows.
- `app/api/checkout/cash/route.ts` — writes pending cash purchases and carries kiosk/web source semantics.
- `app/api/checkout/finalize/route.ts` — finalizes PaymentIntent-based purchases in-app.
- `app/api/stripe/webhook/route.ts` — persists paid purchases, package purchases, and attendance side effects; this is the main payment write boundary today.
- `app/api/checkin/qr/bootstrap/route.ts` — large kiosk/client bootstrap contract with prepared checkout context and session branching.
- `app/api/checkin/qr/client-phone/route.ts` — client self-check-in boundary already separated from kiosk logic.
- `app/api/profile/bookings/checkin/route.ts` — authenticated profile-side attendance transition and points logic.
- `app/api/staff/terminal/session/route.ts` + `lib/security/staff-terminal.ts` — terminal cookie/session auth that does not use Clerk.
- `app/api/staff/checkin/route.ts` + `app/api/staff/checkin/web-cash-arrivals/route.ts` — staff-operated attendance and kiosk-adjacent alerts.
- `app/api/staff/payments/route.ts` + `app/api/staff/payments/shared.ts` — staff payment board contract derived from purchase metadata.
- `lib/checkout.ts` + `lib/checkout/prepared-context.ts` — cross-route orchestration for kiosk-aware account resolution and prepared checkout caching.
- `lib/users.ts` + `lib/clerk-users.ts` — user merge/link rules that any external backend must preserve exactly.
- `middleware.ts` — Clerk-backed staff API guard plus explicit bypass for terminal/check-in token routes.
- `components/front/courses/enroll/effects/checkout-api.ts` — front-end adapter that calls current Next `/api/*` endpoints directly.
- `components/front/checkin/CheckInPageRouter.tsx` + `components/front/checkin/hooks/useClientPhoneCheckIn.ts` — client-side routing/fetch assumptions around current API shape.
- `components/front/staff/useStaffStudentsBoardAdmin.ts` — polling against current staff endpoints.
- `prisma/schema.prisma` — single shared schema for users, purchases, attendances, packages, staff accounts, terminals, kiosk sessions, and prepared checkout contexts.
- `tests/api/checkout-session.test.ts`, `tests/api/checkout-cash.test.ts`, `tests/api/checkin-qr-bootstrap.test.ts`, `tests/api/checkin-qr-client-phone.test.ts`, `tests/api/profile-bookings-checkin.test.ts`, `tests/middleware.test.ts` — current contract tests that constrain migration.

### Approaches
1. **Keep Next API routes as the real backend** — Continue using Route Handlers for auth, payments, kiosk, and staff flows; defer Nest until a dedicated Tap to Pay initiative.
   - Pros: Lowest short-term risk; no auth/session split; no duplicated runtime.
   - Cons: Does not create a real extraction path; payment and kiosk complexity stay embedded in the UI app; weak foundation for future device-facing payment services.
   - Effort: Low

2. **Gradual Nest extraction behind a Next BFF (recommended)** — Keep Next as the edge/BFF for Clerk cookies, middleware, and terminal cookies at first, but introduce Nest as a separate internal service and migrate domain endpoints slice by slice behind stable Next route contracts.
   - Pros: Preserves current UI contracts; supports chained PR delivery; lets Nest become the long-term home for payment orchestration and future Tap to Pay flows; reduces blast radius.
   - Cons: Temporary duplication; Next and Nest may both access the same database during migration; requires strict ownership rules so only one runtime writes a migrated domain at a time.
   - Effort: Medium

3. **Full Nest backend extraction with direct client consumption** — Move auth-aware API contracts, payment orchestration, and domain logic wholesale into Nest and turn Next into mostly UI.
   - Pros: Cleanest target architecture; clearer backend ownership; easiest long-term place for Tap to Pay reader/token orchestration.
   - Cons: Highest risk; Clerk session handling, terminal auth, Stripe webhook side effects, and all front-end fetch contracts must change together; not reviewable under the 400-line budget.
   - Effort: High

### Recommendation
Use **Approach 2**. Keep Next as the public BFF initially, and introduce Nest as an internal service with explicit domain ownership. Do **not** start by moving Stripe write flows or Clerk session validation into Nest. The first migration should prove the integration pattern, not the hardest domain. Recommended first slice for chained delivery: add a minimal backend client/gateway in Next plus one low-risk read-only Nest-backed endpoint, then preserve the existing `/api/*` response shape. After that, migrate one terminal-adjacent read path before any payment writes. For payments, the long-term rule should be: once a payment/check-in subdomain is migrated, Nest becomes the only writer for that subdomain’s `Purchase`/`Attendance` side effects. This is the safest path toward future Tap to Pay, where connection-token issuance, reader orchestration, and payment intent lifecycle belong in a dedicated backend service rather than in the Next UI runtime.

### Risks
- Clerk auth is currently deeply coupled to Next route handlers and middleware; direct extraction would break cookie/session assumptions.
- Terminal auth is a separate cookie/token system from Clerk; Nest integration must preserve both boundaries.
- `lib/checkout.ts` centralizes kiosk-aware account resolution and prepared checkout fallback behavior; splitting it incorrectly will create subtle regressions.
- Stripe purchase persistence and attendance/package side effects are currently concentrated in `app/api/stripe/webhook/route.ts`; dual-writer behavior is a major risk.
- Shared DB access from both Next and Nest is acceptable only temporarily; per-domain write ownership must be explicit.
- Staff payment UI derives meaning from `Purchase.metadata`; changing persistence semantics without preserving metadata contracts will break the board.
- There is no Tap to Pay/Stripe Terminal implementation yet, so proposal work must define reader lifecycle, connection-token ownership, and whether the future client is web, native, or terminal-device driven.
- Adding a full Nest app skeleton plus a first migrated domain can easily exceed the 400-line review budget if not split into infrastructure-first chained PRs.

### Ready for Proposal
Yes — with the proposal explicitly deciding: (1) Next-as-BFF vs direct client-to-Nest calls, (2) temporary shared-DB policy and domain write ownership, (3) whether Clerk verification stays in Next for phase 1, (4) which first read-only route proves the integration pattern, and (5) that Stripe/Tap to Pay is a later payment-domain slice, not the bootstrap slice.
