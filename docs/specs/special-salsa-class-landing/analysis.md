# Special Salsa Class Landing — Codebase Analysis

## Baseline And Method

- Worktree: `special-salsa-class-landing`
- Branch: `feat/special-salsa-class-landing`
- `HEAD`, `origin/main`, and merge base: `d101a3c1ffcb96616bc942f939bb26f52128a11a`
- CodeGraph was consulted before targeted source reads. Targeted reads were used where overloaded route symbols prevented CodeGraph from returning the requested file body and for non-indexed Markdown/config surfaces.
- This analysis describes the baseline only; no application code, test, config, asset, or Prisma file was changed.

## Existing Implementation Map

| Area | Existing path/symbol | Factual behavior | Reuse assessment |
|---|---|---|---|
| Public shell | `components/layouts/PublicLayout.tsx` — `PublicLayout` | Composes `NotificationBar`, `Header`, content, and `FooterQuote`. | Reusable with a compact-header variant; current fixed header does not meet the special landing contract exactly. |
| Header | `components/front/Header.tsx` — `Header`; `components/front/ui/HeaderLogo.tsx`; `components/front/ui/HeaderActions.tsx` | Current desktop header includes explore, search, language, theme, cart, courses, and profile/sign-in actions. `HeaderLogo` and the Clerk-aware profile/sign-in branches are reusable. | Reuse primitives, not the current full arrangement unchanged. |
| Video | `components/front/courses/CourseSections.tsx` — `toEmbedVideoUrl`, `isEmbedVideoUrl`, hero rendering | Supports YouTube/Vimeo embeds and local `<video>` sources from `course.heroMedia.video`; local video uses autoplay, loop, muted, inline playback, and metadata preload. | Reuse the source-selection pattern. The course component is too broad for the focused landing and does not itself provide reduced-motion behavior. |
| Checkout API | `app/api/checkout/session/route.ts` — `POST` | Publicly accepts JSON, applies IP rate limiting, validates checkout data, prepares an account, creates a Stripe Hosted Checkout Session, and returns URL/session metadata. | Primary endpoint to extend with a fixed-event branch. |
| Checkout validation | `lib/checkout/validation.ts` — `validateCheckoutPayload` | Recomputes price from catalog service/package/add-on data and rejects amount mismatch. It returns browser-supplied `courseTitle`, `currency`, `date`, and `time` after little or no event-specific authorization. | Existing generic pricing is useful, but the special event must bypass browser authority and resolve all event facts from fixed server configuration. |
| Account preparation | `lib/checkout.ts` — `prepareCheckoutAccount`, `ensureGuestClerkUser`, `resolveCheckoutPreparation` | External web checkout defaults to `allowExistingAccountLookup: false`; an unauthenticated existing account therefore returns `409 ACCOUNT_EXISTS`. Existing-account lookup is already supported when explicitly allowed. Account creation uses Clerk with `skipPasswordRequirement: true` and does not create a session. | Reuse with special-flow lookup enabled and an ambiguity/non-enumeration guard. |
| Clerk identity | `lib/clerk-users.ts` — `findClerkUserByIdentifiers`, `ensureClerkUser` | Looks up email and E.164 phone; email is preferred when both match. Concurrent create is recovered by a second lookup. | Reusable, but email and phone resolving to different users is not explicitly rejected. |
| Local identity | `lib/users.ts` — `upsertUserByIdentifiers` | Resolves by Clerk ID, email, phone, or Stripe Customer and fills missing identifiers; `User` supports unique Clerk, email, phone, and Stripe Customer IDs. | Reusable for durable linking. Conflicting linked identities must not be silently merged. |
| Stripe success/cancel | `app/api/checkout/session/route.ts` lines 83–103 | Generic web success redirects to `/client-profile?status=success`; cancel redirects to `/courses/{slug}?status=cancel`. | Both URLs conflict with the required public special-class outcomes. |
| Checkout status | `app/api/checkout/session/status/route.ts` — `GET` | Requires a staff terminal session before retrieving Stripe or `Purchase` state. | Not directly reusable by a public confirmation page. |
| Stripe webhook | `app/api/stripe/webhook/route.ts` — `POST`, `handleCheckoutSession`, `processPaidStripeEvent` | Verifies signatures, claims events idempotently, upserts `Purchase`, resolves/upserts the user, and schedules attendance for paid events. Unique Stripe session/payment-intent fields and `StripeWebhookEvent.eventId` protect replay paths. | Strong reuse surface for fulfillment. |
| Stripe Customer | `app/api/checkout/session/route.ts` lines 144–197; webhook lines 435–455 | Checkout passes `customer_email`, not an existing `customer` and not `customer_creation: "always"`. The webhook persists `session.customer` only when Stripe returns one. | Durable Stripe Customer linkage is not guaranteed by the current hosted-checkout request. |
| Booking sync | `lib/bookings.ts` — `syncScheduledAttendanceFromPurchase` | Builds `startsAt` from date/time, upserts `ClassSession`, and creates/reuses `Attendance`. | Reusable after correcting fixed-event time and capacity behavior. |
| Capacity | `lib/bookings.ts` lines 87–105 | Both create and update set `durationMinutes` to 60 and `capacity` to `DEFAULT_CLASS_CAPACITY` (12). No availability count or capacity rejection occurs before payment. | Conflicts with 40 spots and can overwrite an existing 40-capacity session. |
| Time construction | `lib/class-schedule.ts` — `buildSessionStartsAt` | Parses `YYYY-MM-DD` with `new Date(...T00:00:00)` and uses `setHours`, so the persisted instant depends on the server timezone. The same module has New York formatting helpers but no fixed event-local-to-UTC constructor used by booking sync. | Must not be used to derive this event instant. |
| Data model | `prisma/schema.prisma` — `User`, `Purchase`, `ClassSession`, `Attendance` | `User` has `stripeCustomerId`; `Purchase` has unique Stripe IDs and unique `idempotencyKey`; `ClassSession` has capacity/duration/location and unique `(courseSlug, startsAt)`; `Attendance` is unique `(userId, sessionId)`. | Existing schema is sufficient for the MVP hold, fulfillment, and idempotency design. |
| Serializable precedent | `app/api/staff/students/fast-class-action/route.ts` — `runSerializableTransaction` | Uses Prisma PostgreSQL `Serializable` transactions and bounded `P2034` retries. | Reusable concurrency pattern for final-spot admission. |
| Refund automation | Repository search for refund API and `stripe.refunds` | No refund API or Stripe refund creation call exists in the baseline. `PURCHASE_STATUS.REFUNDED` and staff display copy exist, but no safe customer refund workflow was found. | Manual Stripe/backoffice processing is the only evidence-backed MVP policy. |
| Tests | `tests/api/checkout-session.test.ts`, `checkout-session-status.test.ts`, `stripe-webhook-checkout-session.test.ts`, `tests/lib/bookings.test.ts`, `tests/checkout.test.ts` | Existing focused suites cover generic session creation, terminal-only status, webhook persistence/idempotency, booking reuse, and price validation. | Extend these suites and add special-flow policy/UI coverage. |

## Verified Conflicts And Gaps

### 1. Existing external-web account behavior blocks approved guest checkout

`app/api/checkout/session/route.ts` enables existing-account lookup only for `kiosk_terminal`. In `lib/checkout.ts`, `ensureGuestClerkUser` returns `409` with `ACCOUNT_EXISTS` for an unauthenticated existing customer. The approved contract requires silent linking without sign-in and without account enumeration.

### 2. Success and cancellation are routed to generic authenticated/course surfaces

The generic success URL is `/client-profile?status=success`, and generic cancel returns to `/courses/{slug}?status=cancel`. Neither is the special public outcome surface.

### 3. Public status polling is unavailable

`GET /api/checkout/session/status` authorizes a staff terminal before reading the opaque Stripe session ID. A public landing cannot poll it without weakening the terminal boundary or introducing a separately constrained branch.

### 4. Capacity is not admitted before payment

The current checkout creates Stripe sessions without checking `ClassSession.capacity` or attendance/purchase counts. Fulfillment happens only after payment. Two or more customers can therefore pay for the same last spot.

### 5. Booking sync overwrites capacity to 12

`syncScheduledAttendanceFromPurchase` updates every matched `ClassSession` to `DEFAULT_CLASS_CAPACITY` (12). Even a correctly pre-created 40-person special session would be reduced by webhook fulfillment.

### 6. Session time depends on server locale

`buildSessionStartsAt` uses local `Date` construction and `setHours`. For the contractual `America/New_York` event, a host running in UTC or another timezone can persist the wrong instant. The verified correct instant is `2026-08-30T20:00:00.000Z`; the refund deadline is `2026-08-28T20:00:00.000Z`.

### 7. Some checkout event fields remain browser-controlled

Generic validation protects catalog-derived amount but returns submitted title, currency, date, and time. A fixed one-off event needs a server-side discriminator and immutable configuration rather than a client-assembled generic course payload.

### 8. Stripe Customer persistence is conditional

The hosted Checkout request sends only `customer_email`. The webhook can save a Stripe Customer ID if `session.customer` exists, but the request does not ensure that a Customer is created or reuse `User.stripeCustomerId`.

### 9. Existing identity lookup has an ambiguity edge case

`findClerkUserByIdentifiers` performs both lookups and prefers the email result. It does not prove that an independently matching phone belongs to the same Clerk user. The special guest flow needs an explicit conflict outcome before linking.

### 10. The requested temporary video already exists in this baseline

`public/videos/SalsaClass.mp4` is already tracked in baseline `d101a3c` with the same content hash used by this change. The approved temporary URL therefore requires no asset addition; release verification still needs to confirm the deployed media response and playback behavior.

### 11. Live Stripe readiness cannot be established from source

Source proves only that the app expects `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_SITE_URL`, and that the webhook handles completion, success, failure, and expiry events. It cannot prove the deployed values, account mode, endpoint registration, event subscriptions, or delivery health. Secret values must not be inspected or copied into documentation.

## Architecture Constraints

- Preserve the generic checkout behavior for existing courses, kiosk, and QR-phone flows.
- Keep `GET /api/checkout/session/status` terminal-only unless a separate public authorization rule is proven necessary; a server-rendered public confirmation avoids that change.
- Use the existing PostgreSQL/Prisma serializable-retry precedent for capacity admission.
- Use existing unique fields (`Purchase.idempotencyKey`, Stripe IDs, session/user uniqueness) rather than a migration.
- Keep signed webhook fulfillment authoritative; the success redirect is informational and must not create paid records.
- Keep account preparation sessionless and anti-enumerating.
- Avoid coupling the one-off event to course administration or package pricing unless explicitly requested later.

## Recommended Next Focus

Implement the resolved fixed-event configuration and concurrency policy first, under focused tests. Do not begin the visual landing until server-authoritative pricing, identity resolution, and final-spot behavior are executable contracts.
