# Special Salsa Class Landing — Resolution

## Resolution Status

`RESOLVED — READY FOR PLAN EXECUTION`

The approved behavior can be implemented without a Prisma migration or a new dependency. Existing generic checkout behavior remains unchanged outside a discriminated special-class branch.

## Contract Decisions

### D-01 — Public routes

- Landing: `/special-salsa-class`
- Successful return: `/special-salsa-class/confirmation?session_id={CHECKOUT_SESSION_ID}`
- Cancel return: `/special-salsa-class?checkout=cancelled&attempt=<opaque-attempt-id>`

The success page is public and server-rendered. It validates the opaque Stripe session against the special event before displaying payment state. It never renders PII or account-existence information.

### D-02 — One server-side event configuration

One immutable module is the source of truth for:

- stable event key and course slug;
- stable internal title plus customer-facing `Salsa de Cali` display copy;
- `/videos/SalsaClass.mp4`;
- `America/New_York` date/time calculations without printing the raw identifier in customer copy;
- UTC start `2026-08-30T20:00:00.000Z`;
- UTC refund deadline `2026-08-28T20:00:00.000Z`;
- 60-minute duration;
- regular 2500-cent USD price, promotional 2000-cent USD price, exact 20% discount, and promotion deadline `2026-08-30T14:00:00.000Z`;
- 40-person capacity;
- `54 Coles St, Jersey City`.

The page, checkout branch, capacity policy, webhook booking policy, and confirmation page read this configuration. A pure policy resolves 2000 cents only for instants strictly before the deadline and 2500 cents at or after it. Replacing the promotional video changes one value only.

### D-03 — Existing checkout endpoint, discriminated request

Reuse `POST /api/checkout/session` with a special request shape:

```json
{
  "checkoutKind": "special-salsa-class",
  "attemptId": "<client-generated UUID>",
  "name": "Customer Name",
  "phone": "+12015550123",
  "email": "customer@example.com"
}
```

For this branch, the server derives every event/payment field from D-02. Client-supplied amount, currency, event date/time, duration, capacity, address, title, or redirect URL is ignored or rejected. Generic course checkout keeps its current payload and validation path.

### D-04 — Guest account linking is silent and sessionless

The special branch enables identifier lookup without requiring terminal authorization or user login.

1. Normalize email and E.164 phone.
2. Resolve both identifiers independently.
3. If both resolve, require the same Clerk customer.
4. If exactly one resolves, reuse that customer only when the other submitted identifier does not belong to a different customer; fill only missing safe profile fields through existing helpers.
5. If neither resolves, create a Clerk customer with no password requirement and upsert the local `User`.
6. If identifiers conflict or a unique-identity write is ambiguous, return a generic `CONTACT_DETAILS_UNAVAILABLE` response.

No branch creates a Clerk session. The API does not return `ACCOUNT_EXISTS`, `created`, Clerk ID, local user ID, or any equivalent existence signal.

### D-05 — Capacity uses a pending `Purchase` hold and existing `ClassSession`

No schema change is required.

- Ensure the fixed `ClassSession` exists at `2026-08-30T20:00:00.000Z` with capacity 40, duration 60, and the contractual location.
- Use a Prisma `Serializable` transaction with bounded `P2034` retries, following the existing repository pattern.
- Within that transaction, reject an existing completed reservation, recover an existing active hold when possible, count paid reservations plus unexpired pending holds for the event, and create at most one pending `Purchase` hold.
- Namespace `Purchase.idempotencyKey` with the event key and attempt UUID.
- Pending holds count for 30 minutes. Stale, failed, expired, or refunded purchases do not count.
- Each purchase represents exactly one spot; this MVP has no participant selector.
- A transaction that observes 40 active spots returns `409` with `SOLD_OUT` before a payable URL is returned.

The server creates the pending hold before creating/recovering the Stripe Session. Stripe session creation uses the same idempotency key. If Stripe creation fails, the hold is marked failed. If persistence after Stripe creation is interrupted, retrying the same attempt recovers the Stripe Session and completes the link.

### D-06 — Duplicate attempts do not create duplicate sessions or spots

- Repeating the same `attemptId` resolves the same pending `Purchase` and Stripe idempotency key.
- A second browser submission with the same attempt returns the existing open session URL.
- A different attempt for the same customer/event cannot create a second active hold.
- A completed purchase blocks a second reservation for that customer/event.
- The UI also disables submission while the first request is pending, but server idempotency is authoritative.

### D-07 — Stripe Customer linkage becomes durable

If `User.stripeCustomerId` exists, pass it as the Checkout Session `customer`. Otherwise request Stripe Customer creation for the Hosted Checkout Session and let the signed webhook persist `session.customer` through the existing user upsert. This flow must not expose the Stripe Customer ID publicly.

### D-08 — Webhook remains fulfillment authority

The existing signature verification, event claim, Purchase upsert, payment-intent reconciliation, and unique constraints remain in force. Special metadata is written only from D-02. On paid fulfillment:

- update the pending `Purchase` rather than create a second record;
- link the resolved local customer;
- preserve the fixed `ClassSession` values;
- create/reuse one scheduled `Attendance`;
- keep webhook replay idempotent.

`syncScheduledAttendanceFromPurchase` must stop overwriting an existing fixed session's capacity to 12. Special-session values come from D-02, not Stripe metadata supplied by a browser.

### D-09 — Public confirmation does not reuse terminal polling

`GET /api/checkout/session/status` remains terminal-authorized. The confirmation page performs a server-only Stripe retrieval using `session_id`, verifies the special event marker, and reads the linked `Purchase` when available.

- Paid Stripe state plus durable Purchase: show reservation confirmed.
- Paid Stripe state before webhook persistence: show payment received and reservation finalizing.
- Unknown, mismatched, unpaid, or expired session: show a generic non-confirmed state and return path.

The success page is informational; it never writes fulfillment records.

### D-10 — Cancel and failure policy

Stripe Checkout expires after 30 minutes, matching the hold window.

- Cancel returns to the landing with no PII and may retry the same still-open attempt.
- `checkout.session.expired` or payment failure marks the linked pending Purchase terminal through the existing webhook path.
- Capacity counting also excludes stale pending holds by age, so delayed webhook delivery cannot hold capacity indefinitely.
- No confirmed attendance is created for unpaid outcomes.

### D-11 — Fixed UTC instants, New York presentation

Do not use server-local `buildSessionStartsAt` for this event. Persist the fixed UTC instant from D-02. Format customer-facing date/time with `Intl.DateTimeFormat` and explicit internal `timeZone: "America/New_York"`, but do not append the raw identifier to visible output. Tests must run with at least one non-New-York process timezone and still prove the same UTC values and display.

### D-12 — Isolated special-event reuse of public UI

Reuse `PublicLayout`, `HeaderLogo`, `SearchInput`, the existing mobile menu primitive, and Clerk sign-in/profile behavior through additive special-event variants. The default public header must remain unchanged. The special variant keeps logo, course search, and menu available at mobile widths. Signed-in rendering uses the real Clerk avatar when available, the exact `My profile` label, and `/client-profile`; signed-out rendering uses the exact `Log in` label with no fake avatar.

`PublicLayout` exposes an explicit floating-chrome policy. The special landing and confirmation select the hidden policy, which registers suppression through the root floating-chrome provider. Default layouts keep the default policy. The shared assistant and Home/back-to-top components consume that policy; they must not add special-route pathname checks or global CSS hiding rules.

Use the established local/embedded video source pattern, but implement focused landing markup with visible playback control and reduced-motion behavior rather than mounting the entire `CourseSections` experience. The hero is exactly one bordered, radius-clipped dark card. Its media and details panels are direct siblings: an approximately 40/60 joined split at 1024 CSS pixels and above, and media-first stacking below it. The media owns the `SPECIAL EVENT` badge, gradient, and real duration/capacity overlay. The details panel owns `SALSA CLASS`, customer-facing `Salsa de Cali`, approved description, a compact two-column equal-size calendar/address grid, one attribution line immediately below that grid, and a subsequent full-width space-between purchase row containing `$25` before the only hero CTA. The calendar is informational rather than a date selector: a decorative, assistive-technology-hidden August 2026 grid preserves the correct Sunday-first arrangement and highlights only Sunday the 30th, while one semantic time element exposes the complete event date/time and visible class information. Increase the calendar typography, cells, highlight, and footer proportionally for the enlarged card. The complete address block remains an accessible Apple Maps link, separates the versioned local static OpenFreeMap image from a 36 CSS-pixel solid pin-and-address caption, and never overlays address or attribution on the image. The neutral border is persistent, while pink focus treatment is keyboard-only through `focus-visible`. Both facts remain equal, approximately 216 CSS pixels high, and side by side at desktop and 375 CSS pixels without escaping the details panel. The compact `Reserve here` CTA does not grow or span the row and focuses the existing guest form outside the card. No runtime map, secondary details action, raw IANA timezone copy, reference-only social proof, or course attributes are copied.

Generate the cache-busted map PNG once outside the repository with temporary MapLibre/Playwright rendering against OpenFreeMap `liberty`. Preserve road/street labels while hiding non-navigation POI/business/shop/school/church/transit/place labels, use a slightly closer crop, and add exactly one centered PLI marker that resolves to approximately 64–72 CSS pixels in the desktop thumbnail with a light halo. Validate the approximately 1200×700 PNG, ensure it contains no baked address or attribution text, remove the temporary renderer, and delete the obsolete unversioned asset. Runtime code loads only `/images/salsa-de-cali-map-v2.png`; required linked attribution is HTML below the facts grid, and no token, account, map SDK, dependency, generator, or network map request is admitted.

The bounded visual correction replaces that gray V2 render with `/images/salsa-de-cali-street-map.png`, generated once from OpenStreetMap data at a wider neighborhood scale so road hierarchy, street geometry, useful labels, light land, and truthful green/blue context are immediately recognizable. Runtime still performs no map request. Keep the existing linked caption, use linked OpenStreetMap attribution below the facts, and remove only the obsolete V2 asset. In the calendar footer, enlarge the event label and render `Salsa de Cali · 4:00 PM` on one line at 375 CSS pixels without changing the 216 CSS-pixel cards or calendar semantics.

The final refinement replaces the conventional month grid with a compact date poster inside the same 216 CSS-pixel card: `AUGUST 2026` establishes context, `30` dominates, `SUNDAY` supports it, and the accessible `Salsa de Cali · 4:00 PM` line balances the bottom edge with no unused lower region. Regenerate only the map as `/images/salsa-de-cali-coles-st-map.png` at a closer neighborhood zoom, reduce the PLI marker substantially, enlarge the one-line address caption, and remove only the superseded street-map PNG. Keep the Apple Maps link, linked OpenStreetMap attribution, equal cards, dark styling, responsive desktop layout, and all non-visual behavior unchanged.

The final reference-matching refinement keeps the redundant date-card footer removed and keeps one unique semantic event time. Render `AUGUST 2026` in the same PLI red accent as the weekday label, preserve the unchanged dominant `30`, and replace the single-line `SUNDAY · 4:00 PM` treatment with a centered two-line group: `SUNDAY AT` in PLI red, then `4:00 PM` in white. Preserve balanced vertical spacing without clipping or overflow inside the 216 CSS-pixel card. Keep the iconless centered 13 CSS-pixel address, close map, small PLI marker, Apple Maps link, attribution, 15/16 CSS-pixel landing CTA, accessible popup, equal cards, and all reservation/Stripe behavior unchanged.

The mobile dead band comes from three positive spacing sources accumulating between the hero and quote card: 32 CSS pixels of landing-section bottom padding, 32 CSS pixels of generic footer margin, and 80 CSS pixels of quote-wrapper top padding. For the special-event layout only and below the medium breakpoint, preserve the intentional 32 CSS-pixel landing-section padding while suppressing the latter two sources through explicit responsive footer spacing. Restore the existing generic footer margin and quote padding at the medium breakpoint so desktop composition and all default/compact layouts remain unchanged. Do not mask the issue with negative margins.

Darken the existing static map at presentation time rather than generating another asset. Apply a single `brightness(0.82)` filter to the `<Image>` element only; do not add grayscale, desaturation, opacity reduction, or a caption-level overlay. This bounded value is visibly darker while preserving map color differentiation, road/label readability, neighborhood context, and marker prominence. Keep the existing image source, zoom, crop, marker, link, caption, attribution, geometry, and all non-map behavior unchanged.

### D-12A — One landing-local reservation dialog, one existing form

The closed landing renders no reservation form beneath the hero. The existing compact `Reserve here` CTA opens one portal-backed dialog and the current three-field form is moved into that dialog without duplicating its state, validation, submission, API payload, Stripe redirect, authentication-aware defaults, sold-out handling, cancellation copy, or error behavior. Existing repository modals are feature-private implementations and do not provide a reusable primitive with the complete focus-containment and scroll-lock contract required here, so the smallest safe solution remains local to the special-event landing and adds no dependency.

The dialog uses an accessible title and description, a visible close button, initial name-field focus, Tab/Shift+Tab containment, safe Escape/backdrop dismissal, focus return to the CTA, and body scroll locking. Dismissal is disabled while checkout submission is active. Validation and API errors keep the same dialog and field state mounted. Mobile uses a viewport-bounded dark surface with an internal scroll region and sticky/reachable controls; desktop uses a centered constrained-width surface. The price and cancellation policy remain visible in the landing and dialog flow without changing checkout semantics.

### D-13 — Refunds are informed and manual for the MVP

The customer-facing contract states the exact deadline and that eligible refunds are handled by PLI staff. Staff validates the request against `2026-08-28T20:00:00.000Z` and processes it manually in Stripe/backoffice.

Automated refund eligibility, Stripe refund creation, refund webhooks, customer self-service, and a refund endpoint are out of scope. No refund endpoint may be added under this spec.

### D-14 — Timed price is locked by the admitted Purchase

- `lib/special-salsa-class/config.ts` owns the regular amount, promotional amount, discount percentage, and fixed UTC deadline. Its pure policy accepts an explicit instant and uses the strict `now < deadline` boundary.
- The checkout route captures one server instant for a new admission. The client cannot submit or override promotion state, amount, discount, or deadline.
- The serializable admission transaction writes the resolved amount to the new pending `Purchase.amount`. That persisted amount is the immutable source for Stripe Session creation, same-attempt recovery, and later webhook validation.
- Same-attempt recovery always uses the existing Purchase amount and existing Stripe Session. It never recalculates against the current clock and never rewrites the locked amount.
- No Prisma migration is required because `Purchase.amount` already stores the monetary amount. Special metadata may echo the locked amount for signed-event consistency checks, but metadata never overrides the Purchase.
- A special Checkout Session paid after the deadline remains valid when its signed amount, currency, event marker, and linked Purchase agree. A mismatch fails closed before fulfillment mutation.

### D-15 — Promotion presentation shares server-initialized state

`/special-salsa-class` captures the server render instant and passes it into both the special announcement and landing presentation. Before the deadline, the special route replaces the generic announcement with the exact promotion message, an iconless fixed-deadline label using whole English days/hours/minutes, and a link into the existing reservation-dialog flow. The label floors partial minutes, omits zero units, reads `Less than 1 min` below one minute, and wakes only when the visible minute can change. The client experience opens its one existing dialog immediately from the banner click and still navigates through the `reserve=1` URL contract for direct entry and history semantics. The landing observes that query when available, while close replaces only that entry and preserves unrelated parameters. Landing-button opens remain local and capture that button directly. At the deadline the banner and its entry point disappear while the regular-price landing dialog remains available. Other routes keep the generic digital announcement, clock icon, and one-second behavior unchanged.

Client ticking starts from the server-provided instant and targets the canonical UTC deadline. It may update presentation only; checkout remains server-authoritative. A deadline timer removes stale promotion copy and synchronizes the hero and open dialog price without relying on browser timezone parsing or producing a hydration mismatch.

## Minimal Architectural Changes

1. Add one special-event configuration/policy module and focused tests.
2. Add the special landing and confirmation routes plus focused UI components.
3. Add compact variants to existing public header composition without changing defaults.
4. Add a discriminated special branch to the existing checkout session route.
5. Add a small reservation/hold service using existing models and serializable retry precedent.
6. Extend webhook metadata/booking handling only enough to fulfill and preserve this fixed session.
7. Add focused API, policy, webhook, booking, component, and acceptance tests.
8. Extend the fixed policy, Purchase hold, webhook validation, and special-route announcement only enough to support the timed promotion; add no pricing framework, endpoint, schema, or dependency.

## Explicit Non-Decisions

- No Prisma migration.
- No new API endpoint.
- No refund endpoint or automatic refund.
- No generic event inventory framework.
- No waitlist.
- No login requirement or auto-login.
- No change to generic course prices, packages, coupons, or participant behavior.
- No relaxation of terminal status-route authorization.
- No live Stripe secret inspection.

## Implementation Preconditions

- The implementation plan in `tasks.md` is accepted and executed in order.
- The tracked baseline file at `/videos/SalsaClass.mp4` remains the approved temporary promotional asset; release verification confirms its deployed response and playback behavior.
- The event owner approves the exact customer-facing refund wording without changing the deadline.
- Live Stripe configuration is verified operationally with redacted evidence before traffic is sent to the page.
- If implementation proves the existing schema cannot enforce the resolved hold contract, stop and update this resolution before creating a migration.
