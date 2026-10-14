# Heritage Pin Campaign — Analysis

## Existing Contracts

### Public booking

- `components/front/booking/ShareableBookingPage.tsx` builds a 90-day occurrence list and routes `BOOK` through each occurrence's canonical QR booking URL.
- `lib/checkin/shareable-booking.ts` owns occurrence dates in `America/New_York` and calls `buildQrBookingUrl`.
- The handoff currently lands on `/courses/[slug]?enroll=1&qrBooking=1...`.

### Booking form and flash

- `CoursePageClient` recognizes `qrBooking=1`, but the root boot overlay is injected only when viewport width is below 1024px.
- Desktop QR booking renders the full course page behind an inline `EnrollModal`; route loading also uses a generic course skeleton.
- `CourseAsideRight` waits for Clerk and existing-customer eligibility before opening the modal. This wait explains the visible intermediate page.
- The fix should provide one branded QR-booking shell for every viewport rather than exposing the general course layout.

### Identity and payment

- The existing flow resolves users from verified phone/account data and enforces new-student eligibility server-side.
- Hosted Stripe checkout persists session metadata into `Purchase.metadata` in `app/api/stripe/webhook/route.ts`.
- Webhook handling is already idempotent around Stripe session/payment-intent identifiers and preserves existing metadata.
- `Purchase.metadata` can hold campaign acquisition, country, and delivery fields without a schema migration.

### Pricing

- `lib/checkout/validation.ts` recalculates catalog prices and currently recognizes PLI10/PLI20 coupons.
- The campaign needs a separate fixed-price rule because US$15 is not one of those percentage outcomes for a US$20 class.
- Identity is resolved after initial payload validation in checkout routes, so campaign pricing needs an explicit server-side second-stage decision based on the resolved user.
- The client may display a campaign total, but the server must calculate the final amount independently.

### Cash boundaries

- `StepPayments` currently offers both `onsite` and `stripe` for personal QR check-in flows.
- `/api/checkout/cash` accepts the same general checkout payload family.
- Trusted kiosk requests already carry validated terminal/session context through `flowContext=kiosk_terminal` and `kioskSessionToken`.
- UI hiding is insufficient: remote cash must also be rejected server-side unless trusted kiosk context is established.

### Staff student panel

- `app/api/staff/students/search/route.ts` builds `StudentProfileCard` values from users, purchases, packages, attendance, and authentication PIN credentials.
- `ProfileStudentCard` renders badges from `resolveProfileCardBadges`.
- The existing `pinStatus` means authentication PIN enrollment. The campaign must add a separately named country-pin field to avoid semantic and visual confusion.
- Staff routes already provide authorization, rate limiting, metadata-preserving updates, and audit patterns that can be reused for delivery confirmation.

## Risks

1. **Authorization by note** — parsing free text would let edits accidentally grant pricing. Use structured metadata.
2. **Duplicate awards** — Stripe may deliver multiple event types/retries. Resolve one entitlement per user and update idempotently.
3. **Metadata clobbering** — delivery updates and webhook merges must preserve unrelated payment/failure/package data.
4. **Client price spoofing** — final US$15 must come from a server entitlement lookup and class-date decision.
5. **Cash bypass** — removing the button without guarding `/api/checkout/cash` leaves a direct-request bypass.
6. **Kiosk regression** — a blanket cash removal would break legitimate in-studio behavior. Keep the existing trusted terminal/session path.
7. **Timezone drift** — purchase timestamps and class weekdays must use New York calendar dates, not server UTC dates.
8. **Promotion overlap** — pin pricing must not combine with coupons, package credits, new-student service, or consecutive offers.
9. **Badge collision** — “PIN” already refers to authentication credentials. User-facing labels must say “Heritage pin” or “Country pin.”
10. **Campaign expiry** — scattered hard-coded dates would be costly to extend or remove. Centralize every boundary.

## Reuse Opportunities

- Existing booking occurrence timezone helpers and QR handoff.
- Existing phone/account preparation and eligibility flow.
- Existing Stripe metadata propagation and purchase upsert.
- Existing staff student-card aggregation and badge renderer.
- Existing staff authorization/audit conventions.
- Existing kiosk terminal/session verification for trusted cash.

## Minimum Change Surfaces

- New centralized campaign domain/config module and tests.
- Public booking occurrence/handoff and campaign UI.
- Enrollment props/state/payload wiring for source and country.
- Checkout validation/session/cash and webhook metadata admission.
- Staff student search types/presentation plus one delivery mutation.
- Focused API/domain/component/E2E coverage.

## Investigation Constraint

The configured subagent could not register an alternate worktree in this session (`Select an existing worktree in the same Git clone as this session`). Exploration therefore continued inline against the clean feature worktree; verification must remain independently routed where the runtime permits.
