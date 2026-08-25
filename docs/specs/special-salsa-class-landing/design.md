# Special Salsa Class Landing — Design

## Intent

Implement one narrow public purchase slice around the existing Clerk, Stripe, Purchase, ClassSession, Attendance, and public-layout contracts. The design separates fixed event policy, UI composition, checkout orchestration, capacity admission, and webhook fulfillment so the urgent launch does not turn into a generic event platform.

## End-To-End Flow

1. `/special-salsa-class` captures one server-render instant, resolves the fixed promotion policy, and renders a compact public header, route-scoped promotion announcement when active, video, event facts, refund message, and one CTA-opened three-field reservation dialog.
2. The client creates one UUID attempt ID per form attempt, disables duplicate clicks, and posts only the attempt ID plus name, phone, and email to `POST /api/checkout/session` with `checkoutKind: "special-salsa-class"`.
3. The route selects the special branch, validates contact fields, resolves or creates the customer without login, and upserts the local `User`.
4. A reservation service uses a bounded-retry serializable transaction to configure the fixed `ClassSession`, reject duplicate enrollment, admit one of 40 spots, and create/recover one pending `Purchase` hold. A new hold stores the server-resolved amount; a recovered hold keeps its existing amount.
5. The route creates or recovers one Stripe Hosted Checkout Session using the persisted Purchase amount and the namespaced attempt ID as Stripe and database idempotency key, links the session to the pending Purchase, and returns its URL.
6. Stripe redirects success to the public confirmation page and cancel back to the landing. Neither URL contains PII.
7. The signed webhook updates the pending Purchase and creates/reuses Attendance for paid sessions. Failure/expiry makes the hold non-counting.
8. The public confirmation page reads Stripe and Purchase state server-side and presents a safe confirmed, finalizing, or non-confirmed state. It performs no fulfillment write.

## Responsibility Map

| Responsibility | Probable path | Notes |
|---|---|---|
| Fixed event and promotion policy | `lib/special-salsa-class/config.ts` | Single value source for video, contractual facts, regular/promotional amounts, discount, UTC deadline, and strict boundary resolver. No environment-dependent business values. |
| Event/time/capacity policy tests | `tests/lib/special-salsa-class.test.ts` | Prove UTC values, New York display, hold cutoff, countable statuses, and fixed price/capacity. |
| Landing route | `app/special-salsa-class/page.tsx` | Force-dynamic server shell/metadata plus one initial server time/pricing snapshot shared by announcement and landing. |
| Confirmation route | `app/special-salsa-class/confirmation/page.tsx` | Server-only Stripe/Purchase read; no PII output and no writes. |
| Focused landing UI | `components/front/special-salsa-class/*` | Video, event summary, reservation dialog/form, sold-out/cancel/error states. |
| Special-event public shell | `components/layouts/PublicLayout.tsx`, `components/front/ui/NotificationBar.tsx`, `components/front/Header.tsx`, `components/front/ui/HeaderActions.tsx` | Additive promotion announcement plus existing logo/search/menu/auth behavior; default announcement and header output remain unchanged. |
| Checkout branch | `app/api/checkout/session/route.ts` | Discriminate before generic catalog validation and derive fixed values server-side. |
| Identity policy | `lib/checkout.ts`, `lib/clerk-users.ts`, or a focused `lib/checkout/special-class-identity.ts` | Reuse lookup/create/upsert primitives; add conflict detection and non-enumerating outcome. |
| Hold/capacity orchestration | `lib/checkout/special-class-reservation.ts` | Serializable transaction, bounded retries, Purchase idempotency, one active hold per user. |
| Stripe metadata parsing | `lib/stripe-metadata.ts` | Add only the stable event marker, attempt data, and locked-amount echo needed for signed consistency checks. |
| Fulfillment | `app/api/stripe/webhook/route.ts`, `lib/bookings.ts` | Update pending Purchase, preserve fixed ClassSession values, create one Attendance. |
| Focused route/webhook tests | Existing checkout/webhook/booking suites plus special-flow cases | Keep regression evidence beside each changed boundary. |
| Browser acceptance | `e2e/special-salsa-class.spec.ts` | Public, mobile, keyboard, cancel, success, and sold-out presentation with Stripe boundary stubbed or controlled. |

Exact file splits may be reduced during implementation, but responsibilities and boundaries must remain.

## Reuse Strategy

### Reused unchanged where possible

- `HeaderLogo` rendering and theme-aware logo selection.
- Clerk `SignedIn`/`SignedOut` profile entry behavior.
- IP rate-limit helpers.
- Contact normalization and Clerk create/update primitives.
- `upsertUserByIdentifiers` for the local customer mirror.
- Stripe Hosted Checkout and the existing signed webhook endpoint.
- Webhook event claim/completion semantics.
- `Purchase`, `ClassSession`, `Attendance`, and their existing uniqueness constraints.
- Prisma serializable transaction plus `P2034` retry pattern.
- Purchase-to-attendance synchronization after its capacity-preservation correction.

### Reused through additive variants

- `PublicLayout`/`Header` receive a special-event variant; default callers see no change.
- `HeaderActions` receives a special-event auth variant; default quick actions remain intact.
- The local/embedded video selection pattern is reused in a smaller, accessible component.

### Intentionally not reused

- Full `CourseSections`, because it includes unrelated schedules, maps, reviews, course content, and hard-coded course-page assumptions.
- Generic client-authored course checkout payload for event facts.
- Terminal-only checkout status polling.
- Any refund automation, because none exists in the baseline.

## Fixed Event Configuration

The configuration should expose typed fields equivalent to:

```ts
{
  key: "special-salsa-class-2026-08-30",
  checkoutKind: "special-salsa-class",
  courseSlug: "special-salsa-calena-2026-08-30",
  title: "Special Salsa Caleña Class",
  displayTitle: "Salsa de Cali",
  videoSrc: "/videos/SalsaClass.mp4",
  timeZone: "America/New_York",
  localDate: "2026-08-30",
  localTime: "16:00",
  startsAtUtc: "2026-08-30T20:00:00.000Z",
  refundDeadlineUtc: "2026-08-28T20:00:00.000Z",
  durationMinutes: 60,
  regularAmountCents: 2500,
  promotion: {
    amountCents: 2000,
    discountPercent: 20,
    deadlineUtc: "2026-08-30T14:00:00.000Z"
  },
  currency: "usd",
  capacity: 40,
  address: "54 Coles St, Jersey City",
  holdMinutes: 30
}
```

The implementation may use readonly constants or a frozen object. The important contract is one importable source, not the exact syntax. A pure resolver receives an explicit instant and returns the promotional amount only when `now < deadline`; exact deadline and later instants return the regular amount.

## API Contract

### Request

`POST /api/checkout/session`

```json
{
  "checkoutKind": "special-salsa-class",
  "attemptId": "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2",
  "name": "Customer Name",
  "phone": "+12015550123",
  "email": "customer@example.com"
}
```

Validation:

- `checkoutKind` must match the fixed branch exactly.
- `attemptId` must be a UUID and is stable across retries of the same attempt.
- `name` is trimmed, bounded, and non-empty.
- `email` is normalized and validated.
- `phone` must normalize to a supported E.164 value.
- Unexpected event/payment overrides are rejected or ignored before Stripe parameters are assembled.

### Success response

Reuse the current response shape:

```json
{
  "url": "https://checkout.stripe.com/...",
  "sessionId": "cs_...",
  "expiresAt": "2026-08-23T21:00:00.000Z"
}
```

No user/account fields are returned.

### Error responses

| Status/code | Meaning | Public message rule |
|---|---|---|
| `400 INVALID_CONTACT` | Invalid required contact/attempt data | Field-safe validation only; no account lookup detail. |
| `409 CONTACT_DETAILS_UNAVAILABLE` | Conflicting or ambiguous identity | Generic; never identify the matched field/account. |
| `409 CHECKOUT_IN_PROGRESS` | Another active attempt cannot yet be safely recovered | Invite retry; do not expose customer state. |
| `409 ALREADY_REGISTERED` | The resolved customer already has a paid spot | State that the submitted contact details already have a reservation, without exposing other account data. |
| `409 SOLD_OUT` | Capacity is 40 | Show sold-out state and disable purchase. |
| `429` | Existing rate limit exceeded | Preserve `Retry-After`. |
| `500/502` | Stripe, Clerk, or persistence failure | Generic retry message; log only redacted correlation data. |

## Identity Design

The identity resolver returns an internal result only:

```ts
type SpecialClassIdentityResult =
  | { ok: true; clerkUserId: string; dbUserId: string; stripeCustomerId: string | null }
  | { ok: false; code: "INVALID_CONTACT" | "CONTACT_DETAILS_UNAVAILABLE" }
```

It must compare independent email and phone lookup results before choosing a user. Creation remains sessionless. The local upsert occurs before a hold because `Purchase.userId` is required. Logs may include a generated correlation ID and branch outcome, never raw contact values.

## Capacity And Idempotency Design

### Counted spots

One spot is counted for each event Purchase in:

- durable paid statuses (`paid`, `succeeded`, `completed`); or
- `pending` with `createdAt` inside the 30-minute hold window.

`failed`, `expired`, `refunded`, and stale `pending` rows do not count. A customer/event uniqueness check is enforced transactionally by querying active/paid purchases before creating a hold. Database uniqueness on the namespaced `idempotencyKey` protects same-attempt duplication.

### Transaction outline

```text
run serializable transaction with bounded P2034 retry
  upsert fixed ClassSession by (courseSlug, startsAtUtc)
    create/update exact title, duration=60, capacity=40, location
  find same idempotency key
    return it when it belongs to the same customer/event
  find paid or unexpired-pending Purchase for customer/event
    return completed/in-progress outcome
  count all paid plus unexpired-pending Purchase rows for event
  if count >= 40: return SOLD_OUT
  create pending Purchase with one spot and namespaced idempotency key
    amount = promotion policy resolved from the captured server instant
commit
```

The Stripe call then uses the same namespaced key and the persisted `Purchase.amount`. A post-Stripe update stores `stripeCheckoutSessionId`. On failure, mark the hold failed. On an interrupted update, same-attempt retry uses the same persisted amount, retrieves/reuses the Stripe session, and completes the link even after the promotion deadline. Do not keep a database transaction open across a network call.

### Stripe Session parameters

- `mode: "payment"`
- one line item, quantity 1, unit amount equal to the admitted Purchase's immutable 2000- or 2500-cent value, currency `usd`
- stable special event title/description from configuration
- `client_reference_id` and metadata from server-resolved identity only
- existing Stripe Customer via `customer`, otherwise Customer creation requested
- `success_url` with literal `{CHECKOUT_SESSION_ID}`
- `cancel_url` with opaque attempt ID only
- `expires_at` exactly 30 minutes after creation
- Stripe request idempotency option derived from event key plus attempt ID

Stripe documents Checkout expiry as 30 minutes to 24 hours and supports server-side expiry of an open Session. The design uses the minimum 30-minute expiry to match the hold policy.

## Webhook And Persistence Design

Special metadata includes a stable event marker, attempt ID, locked-amount echo, and server-derived course/date/time values required by the current webhook. Metadata is signed transport evidence, not a new source of business truth. The webhook must load the Purchase linked by Checkout Session ID before special fulfillment and require the signed Session amount/currency and locked-amount echo to agree with `Purchase.amount` and the fixed USD policy. It must not recompute price from wall-clock time.

Paid flow:

1. Verify signature and claim the Stripe event using existing logic.
2. Load the pre-created Purchase by `stripeCheckoutSessionId` and validate special marker, allowed amount, USD currency, and locked amount before any fulfillment mutation.
3. Resolve the user with server-origin Clerk/contact metadata.
4. Upsert by `stripeCheckoutSessionId`; this updates the pre-created pending Purchase without changing its locked amount to a different value.
5. Persist Stripe Customer ID when present.
6. Schedule attendance for the fixed UTC ClassSession.
7. Preserve capacity 40, duration 60, and location; never reset capacity to 12.
8. Complete the webhook event claim.

Failed/expired flow updates the linked pending Purchase terminally. It never creates attendance. Existing guards must continue to prevent downgrading a paid Purchase.

## Public Outcome Design

### Confirmation

The server component accepts `session_id`, retrieves the Checkout Session with the server Stripe client, validates its special event marker, and looks up `Purchase.stripeCheckoutSessionId`.

| Stripe/Purchase state | UI state |
|---|---|
| Paid + durable paid Purchase | Reservation confirmed |
| Paid + Purchase pending/missing during webhook lag | Payment received; reservation is being finalized |
| Open/unpaid | Payment not completed; return to landing |
| Expired/failed/mismatched/not found | Generic unable-to-confirm state; return to landing |

No state includes contact data, account IDs, Stripe Customer IDs, or raw metadata. The page does not call fulfillment code.

### Cancel

The landing reads only `checkout=cancelled` and the opaque attempt ID, announces that payment was not completed, and keeps the form available. A retry with the same attempt and contact fields reuses the open Session; abandoned holds stop counting after 30 minutes.

## Timezone Design

- Persist the explicitly reviewed UTC timestamps from configuration.
- Render local copy with `Intl.DateTimeFormat(..., { timeZone: "America/New_York" })` without appending the raw IANA identifier.
- Derive refund eligibility from the UTC deadline, comparing instants, not server-local strings.
- Unit tests set a non-New-York process timezone and prove UTC and display invariants.
- Do not call `buildSessionStartsAt` for this event.

## Accessibility And Responsive Design

- Semantic `header`, `main`, sections, heading order, address, dialog, and form.
- Dark-cinema palette: black page/card surfaces, `#F8FAFC` primary text, `#E11D48` purchase actions, and visible neutral borders.
- The hero has one outer `border: 1px`, one large radius, and one overflow-hidden surface; media, details, and the CTA remain inside that single card while the reservation form stays unmounted until its dialog opens.
- At 1024 CSS pixels and above, direct sibling panels use an approximately 40/60 grid with no gap and aligned height. Below that breakpoint, the same card stacks media before details.
- At 375 CSS pixels, the media panel is 320–380 CSS pixels high. The video uses `object-cover` to fill it and retains poster/fallback behavior.
- Media overlays: `SPECIAL EVENT` at top-left, bottom readability gradient, and icon-backed `60 min`/`40 spots` metadata at the bottom.
- Details hierarchy: `SALSA CLASS`, `Salsa de Cali`, short approved description, one compact equal-size date/address facts grid, then one full-width purchase row with the live `$20`/`$25` policy price before `Reserve here`.
- The facts container is a two-column `minmax(0, 1fr)` grid at desktop and 375 CSS pixels. Both blocks use the same approximately 216 CSS-pixel height, stay within the 204–224 CSS-pixel target, keep wrapped text inside their bounds, and never exceed the details panel.
- The date fact is a non-interactive compact date poster rather than a month calendar. It uses flex balance across the 216 CSS-pixel card, with a tracked 13 CSS-pixel `AUGUST 2026` in the same PLI red accent used by the weekday label, an unchanged 84 CSS-pixel `30` as the dominant element, and one centered 13 CSS-pixel `<time dateTime="2026-08-30T16:00:00-04:00" aria-label="Sunday, August 30, 2026 at 4:00 PM">` arranged as a compact vertical group. The time renders `SUNDAY AT` in PLI red on its first line and `4:00 PM` in white on its second line. Decorative month/day text is hidden from assistive technology, the event name is not repeated, and there is no middle dot, bottom footer, weekday row, numbered-day grid, button, hover, pointer cursor, or interactive grid role. The hierarchy must remain centered, vertically balanced, unclipped, and overflow-free at 375 CSS pixels.
- `PublicLayout` passes an explicit compact-mobile-top-spacing flag to `FooterQuote` only for the `special-event` variant. Below 768 CSS pixels, that variant removes the footer's top margin and quote wrapper's top padding while retaining its bottom padding; the special landing section's existing 32 CSS-pixel bottom padding becomes the complete hero-to-quote gap. At the medium breakpoint, the original footer margin and quote wrapper vertical padding return unchanged. Default and compact layouts keep the existing `FooterQuote` spacing. No negative margin, absolute positioning, or overlap is introduced.
- The static map `<Image>` alone receives Tailwind's arbitrary `brightness-[0.82]` filter in addition to its existing object-cover and hover-opacity behavior. No wrapper, address caption, attribution, date card, or surrounding content receives a filter or overlay. The local 1200×700 asset remains unchanged, preserving the close zoom and baked small PLI marker while keeping the presentation adjustment easy to inspect and revert.
- The address fact is an accessible external Apple Maps link. It stacks `/images/salsa-de-cali-coles-st-map.png` above an approximately 44 CSS-pixel solid neutral caption strip containing only centered 13 CSS-pixel `54 Coles St, Jersey City` text with sufficiently tight tracking for one-line 375 CSS-pixel fit. No caption icon remains. The obsolete V2, wider street-map, and unversioned assets are deleted. The image contains no text overlays. Its default border stays neutral, hover changes color/opacity without geometry changes, and the pink ring is limited to `focus-visible`.
- The linked attribution line sits immediately below the facts grid, outside both cards, reads `Map data © OpenStreetMap contributors`, remains legible and untruncated at 375 CSS pixels, and opens the source in a new tab with `noopener noreferrer`.
- The cache-busted map asset is rendered once at approximately 1200×700 from OpenStreetMap data outside the repository. A closer neighborhood crop keeps streets around `[-74.0473310, 40.7236280]` identifiable while preserving natural map color separation. One substantially smaller haloed PLI marker identifies the address without covering nearby blocks. The PNG contains no address or attribution text. Runtime ships no map SDK, token, account, controls, generator, obsolete duplicate asset, or network map request.
- The purchase row uses space-between. Its `Reserve here` CTA is compact, inline-flex, and non-growing, with text increased from 12 to 15 CSS pixels on mobile and from 14 to 16 CSS pixels at the existing small breakpoint. Button height/padding remain unchanged so price and action stay on one line without overflow at 375 CSS pixels.
- At 375 and 768 CSS pixels, the special header keeps the PLI logo left, course search centered, and menu trigger right without horizontal overflow.
- The menu contains the special auth action: real avatar plus `My profile` for signed-in visitors, or `Log in` with no fake avatar for signed-out visitors.
- `PublicLayout` declares whether global floating chrome is visible. The special landing and confirmation register suppression through a shared client context; default layouts retain the existing assistant and Home/back-to-top controls.
- Suppression is declarative and lifecycle-scoped, with no special-route pathname checks and no global CSS visibility hacks.
- The hero `Reserve here` action opens one portal-backed reservation dialog and moves initial focus to the existing name field.
- The dialog is labeled by a visible title and described by visible supporting copy, uses `role="dialog"` with `aria-modal="true"`, and provides a visible close button with at least a 44 CSS-pixel target.
- One landing-local dialog shell wraps the existing form once. Existing feature-private staff modals are not extracted or reused because they do not satisfy the complete focus-trap, focus-return, submission-lock, and background-scroll contract.
- While open, Tab and Shift+Tab wrap among enabled dialog controls, the document body is scroll-locked, and focus returns to the hero CTA after safe dismissal.
- Escape, backdrop, and close-button dismissal are allowed only while no checkout request is active. Validation and API errors keep the dialog mounted and preserve field values.
- The mobile surface uses `max-height` derived from the dynamic viewport, a non-scrolling header/close affordance, and an internal vertical scroll region containing the form and submit action. The surface and controls remain within 375 CSS pixels without horizontal overflow. Desktop uses a centered, constrained-width dark surface with neutral borders and the existing pink CTA/focus language.
- Explicit labels and autocomplete hints (`name`, `email`, `tel`).
- `inputMode="tel"` and mobile-friendly controls.
- Error summary with `role="alert"`/live announcement and focus management.
- Submit button disabled and labeled during network/redirect work.
- Video has an accessible title, poster/fallback, controls or pause control, inline playback, and reduced-motion handling.
- Essential facts and refund policy are text outside the video.
- Sold-out, cancel, failure, and success states do not rely on color alone.
- Test narrow mobile width and keyboard-only navigation.
- Verify layout and overflow at 375, 768, 1024, and 1440 CSS pixels.
- The special route replaces the generic announcement only while the promotion is active. Its exact message, iconless human-readable countdown pill, and CTA all use the canonical fixed deadline and existing reservation path. The compact responsive hierarchy keeps offer copy first, remaining time second, and CTA third without materially increasing header height at 375 or 1440 CSS pixels. Default routes retain their rolling generic announcement, digital countdown, clock icon, and CTA unchanged.
- The server passes one initial instant into the client announcement and landing. Special-route countdown ticks derive from that value and the fixed UTC deadline, format floor-rounded whole days/hours/minutes with zero leading units omitted, schedule only the next visible minute boundary plus the exact deadline, and update all visible special-class price surfaces together without parsing a browser-local date string. Remaining time below one minute reads `Less than 1 min`; the entire special announcement unmounts at the deadline.
- The banner CTA keeps the baseline href `/special-salsa-class?reserve=1` and appends it to existing non-reservation query parameters. A special-route client experience coordinates the sibling banner and landing: the click records the actual anchor and opens the landing's one existing portal dialog immediately, while the Link navigation preserves direct-entry and history semantics. The landing also treats an observed `reserve=1` as an idempotent transient command and uses Next.js same-route replacement on close to remove only that query value while retaining unrelated parameters and scroll position. Landing CTA clicks bypass query mutation and store their own button as opener. Dialog close returns focus to the stored connected opener; if navigation replaced that anchor node, it resolves the current equivalent banner anchor before falling back to the landing CTA. No global event bus, duplicate form, or reload is introduced.

## Security And Privacy

- Existing IP rate limiting remains before expensive Clerk/Stripe work.
- Fixed server policy plus the persisted Purchase amount defeat amount/discount/deadline/date/capacity tampering.
- UUID attempt ID prevents accidental duplication but grants no account access.
- Stripe session ID is treated as an opaque capability and only yields minimal event/payment state.
- Clerk/local identity conflict produces a generic response.
- PII is excluded from URLs, public responses, and logs.
- Webhook signature verification remains before event persistence.
- Profile authentication remains a separate user action.

## Operational Gates

Without reading or exposing values, release ownership must verify:

1. The deployed environment reports configured `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and canonical `NEXT_PUBLIC_SITE_URL` through approved platform status controls.
2. The Stripe endpoint points to `/api/stripe/webhook` in live mode and subscribes to `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.expired`, and `checkout.session.async_payment_failed`.
3. A controlled live purchase at the currently applicable USD 20 or USD 25 amount reaches the public confirmation page and produces one paid Purchase with the same locked amount, a 40-capacity ClassSession, and one Attendance; any cleanup/refund is performed manually by authorized staff.
4. Webhook delivery is successful and replay does not duplicate fulfillment.
5. `/videos/SalsaClass.mp4` returns the intended media with the correct content type from the deployed site.
6. Cancel and expired Session behavior releases capacity according to the 30-minute policy.

## Rollout And Rollback

- The new route is isolated and can be removed without changing generic course checkout.
- The special checkout branch is gated by an exact discriminator; disabling that branch stops new holds while preserving webhook fulfillment for already-created sessions.
- Do not remove webhook recognition until all open special Checkout Sessions have expired and all paid events are fulfilled.
- Disabling the promotional presentation or moving the deadline forward must stop only new promotional admissions. It must not remove 2000-cent webhook recognition while any bounded pre-deadline Session can still complete.
- Rollback must preserve existing paid Purchase, ClassSession, Attendance, User, and Stripe Customer records.
- The video source can be replaced independently through the single configuration value.
