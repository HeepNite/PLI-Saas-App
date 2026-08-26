# Special Salsa Class Landing

## Status

`IMPLEMENTED — VISUAL REFINEMENT IN PROGRESS`

## Objective

Launch a focused public landing page that lets one person reserve and pay for the special salsa caleña class without signing in. The flow must protect the server-authoritative timed USD 20/USD 25 price contract and 40-person capacity, associate the purchase with a customer account without authenticating the browser, and provide public payment outcomes.

## Event Contract

| Field | Contract value |
|---|---|
| Event | Special salsa caleña class |
| Customer-facing title | `Salsa de Cali` |
| Local start | Sunday, August 30, 2026 at 4:00 PM |
| Timezone | `America/New_York` |
| UTC start | `2026-08-30T20:00:00.000Z` |
| Duration | 60 minutes |
| Regular price | USD 25.00 (`2500` cents) |
| Promotional price | USD 20.00 (`2000` cents), exactly 20% off |
| Promotion deadline | Sunday, August 30, 2026 at 10:00:00 AM `America/New_York` |
| Promotion deadline instant | `2026-08-30T10:00:00-04:00` / `2026-08-30T14:00:00.000Z` |
| Capacity | 40 people/spots |
| Address | `54 Coles St, Jersey City` |
| Refund deadline | Friday, August 28, 2026 at 4:00 PM `America/New_York` |
| Refund deadline UTC | `2026-08-28T20:00:00.000Z` |
| Hero video | `/Videos/special-salsa.mp4` (H.264/AAC MP4 supplied final video) |

## Scope

### In scope

- A public page at `/special-salsa-class` with an isolated special-event header variant, promotional video, event facts, refund-policy copy, and a CTA-opened guest reservation dialog.
- A public confirmation page at `/special-salsa-class/confirmation` for successful payment returns.
- Guest checkout with `name`, `phone`, and `email`; no login prerequisite.
- Silent linking to an existing customer or automatic creation of a new Clerk customer and local `User` record, without creating an authenticated browser session.
- Server-authoritative event identity, price, currency, start instant, duration, capacity, address, and refund deadline.
- Concurrency-safe capacity holds, duplicate-submit protection, Stripe Hosted Checkout, webhook fulfillment, and public cancel/failure states.
- Reuse of the existing checkout route, Stripe webhook, `Purchase`, `ClassSession`, `Attendance`, Clerk helpers, rate limiting, and public UI primitives.
- Mobile and keyboard usability, semantic markup, focus behavior, and reduced-motion-aware video behavior.
- Operational verification of live Stripe configuration without reading, logging, or exposing secrets.

### Out of scope

- Automated refund approval or execution.
- A customer-facing refund endpoint.
- A general event-management, inventory, waitlist, coupon, package, or multi-participant system.
- Login, auto-login, or session creation during checkout.
- Prisma schema changes or migrations unless implementation evidence disproves the reuse plan.
- Changes to unrelated course, kiosk, profile, or staff flows.
- A new third-party dependency.

## Functional Requirements

### FR-01 — Public landing and navigation

The landing must be accessible without authentication. Its isolated header variant must show the PLI logo, existing course search, and mobile menu without changing the default public header. At mobile widths the logo is left-aligned, search remains usable in the center, and the menu trigger is right-aligned. The menu must retain the authentication action. An authenticated customer sees their real avatar when available and the exact label `My profile`, linking to `/client-profile`. A signed-out visitor sees the exact label `Log in`, invokes the existing sign-in entry point, and must not see a fake avatar or `My profile`. Authentication must not gate the purchase dialog. The special landing and its confirmation page must suppress the redundant global floating assistant and floating Home/back-to-top control; those controls must remain unchanged on default layouts.

### FR-02 — Event presentation and replaceable video

The landing must display the contractual event date, time, duration, price, capacity context, and address in one high-contrast dark course card with a visible one-pixel gray border, large radius, and hidden overflow. Raw IANA timezone identifiers are internal and must not appear in customer-facing copy. At 1024 CSS pixels and above, the media and information panels are joined without an exterior gap, aligned to the same card height, and use an approximately 40/60 width split. The video fills the media panel with professional cover cropping. Its overlay contains the exact `SPECIAL EVENT` badge, a bottom gradient, and real `60 min` and `40 spots` metadata. The information panel contains the exact `SALSA CLASS` eyebrow, the visible title `Salsa de Cali`, a short approved description, one compact two-column equal-size facts grid, then one full-width purchase row containing `$25` before the only hero action, `Reserve here`. The date fact is a non-interactive informational mini calendar with a legible `August 2026` header, English weekday initials `S M T W T F S`, and the correct Sunday-first month arrangement: August 1 is Saturday, days 1–31 appear once, and day 30 occupies the Sunday column as the only solid red/pink highlighted day. The month header, weekday initials, day numbers, approximately 20–24 CSS-pixel day-30 circle, and compact `Salsa de Cali`/`4:00 PM` footer must remain clearly legible at 375 CSS pixels. The decorative month grid is hidden from assistive technology and contains no buttons or interactive grid role. One `<time dateTime="2026-08-30T16:00:00-04:00">` exposes the unique accessible label `Sunday, August 30, 2026 at 4:00 PM`. The address fact remains one accessible Apple Maps link composed of the cache-busted local `/images/salsa-de-cali-map-v2.png` thumbnail above a 34–38 CSS-pixel solid caption strip containing a pin icon and `54 Coles St, Jersey City`; no address or attribution text overlays the street image. The obsolete `/images/salsa-de-cali-map.png` path must not remain in the candidate. Its persistent border remains neutral, hover feedback causes no layout shift, and the pink ring appears only for `focus-visible`. Immediately below the facts grid, outside both links/cards, one legible untruncated attribution line reads `OpenFreeMap · © OpenMapTiles · Data © OpenStreetMap contributors` with correct external links, new-tab targets, and `noopener noreferrer`. At both 1440 and 375 CSS pixels, calendar and address remain in one `minmax(0, 1fr)` two-column row with equal width and equal bounded height of approximately 204–224 CSS pixels, while the purchase row uses space-between and a compact non-growing CTA. Neither facts, caption, nor attribution may truncate or overflow, and the cards must remain within the details panel. Below 1024 CSS pixels, the same bordered card stacks media before details; at a 375 CSS-pixel viewport the media is 320–380 CSS pixels high. No rating, reviews, stars, instructor, level, popularity, or open-group claim may be rendered. The video initially uses `/videos/SalsaClass.mp4` from the single event configuration value.

The cache-busted map thumbnail is generated once as `/images/salsa-de-cali-coles-st-map.png` from OpenStreetMap data at longitude `-74.0473310`, latitude `40.7236280`, with a closer north-up neighborhood crop that keeps local street geometry and useful nearby labels legible. It must retain natural land/road/context separation without reverting to a gray building-footprint texture. Add exactly one high-contrast red/pink PLI marker with a clear halo, sized as a location indicator rather than a neighborhood-covering badge, and produce a valid approximately 1200×700 PNG without embedded address or attribution text. Required linked OpenStreetMap attribution is rendered in HTML immediately below the facts grid. No runtime map API, account, token, control, dependency, obsolete duplicate asset, or generator may remain in the repository.

The focused visual correction supersedes the earlier V2 path and split calendar footer wording in FR-02: the calendar footer uses larger text and keeps `Salsa de Cali`, a subtle separator, and `4:00 PM` on one unbroken line at 375 CSS pixels without clipping or horizontal overflow. The address card loads only `/images/salsa-de-cali-street-map.png`; `/images/salsa-de-cali-map-v2.png` is obsolete and must be absent.

The final compact-facts refinement supersedes the literal month grid and prior street-map filename. The 216 CSS-pixel date card is not a conventional calendar: it uses the available height for a small uppercase `AUGUST 2026`, a dominant `30`, a supporting `SUNDAY`, and the same accessible event/time text, with no weekday row, numbered grid, or unused lower region. The address card loads only `/images/salsa-de-cali-coles-st-map.png`; the superseded `/images/salsa-de-cali-street-map.png` must be absent. Its solid caption makes `54 Coles St, Jersey City` noticeably larger and keeps it on one line at 375 CSS pixels without document overflow.

The final mobile facts micro-refinement supersedes the bottom date-card footer in FR-02 and the prior compact-facts wording. The date card must not repeat `Salsa de Cali`. `AUGUST 2026` uses the same PLI red accent as the weekday label above the unchanged dominant `30`. Below the day, one centered semantic time group renders `SUNDAY AT` in PLI red on its first line and `4:00 PM` in white on its second line. All three visible hierarchy groups remain unclipped and vertically balanced inside the existing 216 CSS-pixel card. The map caption contains only a centered `54 Coles St, Jersey City` with no location-pin icon; its text remains approximately 13 CSS pixels on one centered line without clipping at 375 CSS pixels. The landing `Reserve here` CTA text remains 15 CSS pixels on mobile and 16 CSS pixels at the existing small breakpoint; button hierarchy, dimensions, dialog behavior, equal 216 CSS-pixel cards, map image/marker, Apple Maps link, attribution, and checkout behavior remain unchanged.

On mobile widths below 768 CSS pixels, the quote card must follow the special-event hero with only the landing section's intentional 32 CSS-pixel bottom spacing. The layout must not add the generic footer margin or quote-wrapper top padding that previously expanded this gap to 144 CSS pixels at 375 CSS pixels. At 768 CSS pixels and above, the established footer spacing remains unchanged. This correction must not use negative margins and must preserve the quote styling/content, footer, hero, popup, accessibility, and checkout behavior without overlap or horizontal overflow.

The existing close street-map image must use a map-only 82% brightness treatment so it integrates with the dark PLI facts card while retaining its original colors, recognizable roads, street labels, neighborhood context, and small PLI marker. The filter must apply only to the rendered image: the centered address caption, attribution, date card, surrounding content, Apple Maps link behavior, accessibility, 216 CSS-pixel card dimensions, responsive layout, popup, and checkout behavior remain unchanged.

The final map-footer correction supersedes the earlier detached-attribution placement. `Map data © OpenStreetMap contributors` appears directly below the centered `54 Coles St, Jersey City` address inside the 216 CSS-pixel map card. The map image and address remain one accessible Apple Maps destination, while the OpenStreetMap attribution remains a distinct accessible external link and must not be nested inside the Apple Maps anchor. Exactly one attribution is rendered. The address remains prominent, centered, and on one line at 375 CSS pixels when feasible; the subordinate attribution may wrap only when narrower space requires it. The map image/footer heights may be rebalanced only enough to prevent clipping while preserving the close zoom, small marker, image-only `brightness(0.82)`, equal fact-card height, responsive layout, popup, promotion, and checkout behavior.

The final portrait-video presentation supersedes the earlier cover-cropping instruction: the complete accessible foreground uses `object-contain` and is never cropped, while a separate inaccessible, muted, blurred, enlarged `object-cover` instance of the same video fills the media panel as decoration. Existing autoplay, play/pause, sound-toggle, keyboard, and reduced-motion behavior remain unchanged.

### FR-03 — Direct guest purchase

The closed landing must render no inline reservation form or duplicate reservation controls after the hero card. The only hero action must use the exact label `Reserve here` and open one accessible reservation dialog containing the existing purchase form. The form collects only `name`, `phone`, and `email`; all three fields remain required and retain the existing validation, authentication-aware defaults, guest checkout payload, submission-progress state, API/error/sold-out behavior, Stripe redirect, and `Reserve for $25` submit action. Closing and reopening the dialog must preserve entered values. Validation and API errors must keep the dialog open and preserve values. Active submission must continue preventing duplicate submission and must prevent Escape, backdrop, or close-button dismissal until the existing request completes.

The dialog must have an accessible name and description, a visible close button, initial focus on the name field, keyboard focus containment, safe Escape/backdrop dismissal, focus return to the `Reserve here` CTA, and document scroll protection while open. On phones it must fit within the viewport with bounded outer height, an internal vertical scroll region, reachable close and submit controls, and no horizontal overflow. On desktop it must be centered and appropriately sized in the existing high-contrast dark PLI visual language. No second reservation implementation or checkout contract may be introduced.

### FR-04 — Account association without authentication

Checkout must resolve the submitted email and phone against Clerk and the local `User` table without disclosing whether an account exists.

- If the identifiers resolve unambiguously to an existing customer, the hold, purchase, and attendance must link to that customer.
- If no customer exists, the server must create the Clerk customer and local `User` record automatically.
- If email and phone resolve to different customers or identity linkage is otherwise ambiguous, checkout must stop with a generic contact-details error that does not identify which account or identifier matched.
- No branch may create a Clerk session, sign the browser in, or return account-existence metadata.

### FR-05 — Server-authoritative checkout

The browser must identify the special-class checkout intent and submit contact fields plus an opaque checkout-attempt identifier. The server must ignore or reject client attempts to override event facts, price, discount, or deadline. For a newly admitted attempt, Stripe must receive exactly one server-priced USD line item for one spot: 2000 cents strictly before the promotion deadline and 2500 cents at the exact deadline or afterward.

### FR-06 — Capacity and duplicate-submit behavior

Capacity is 40 paid spots plus unexpired payment holds. Capacity admission must be atomic under concurrent requests.

- A successful checkout attempt creates one 30-minute pending hold.
- Repeating the same attempt returns the same open Stripe Checkout Session rather than creating another hold or charge opportunity.
- A different attempt for a customer who already has an active hold must reuse that hold when safely recoverable or return a generic checkout-in-progress response.
- A customer with a completed reservation must not receive a second spot.
- Failed, expired, or otherwise released holds must not count toward capacity.
- The request that loses the final-spot race must receive `409 SOLD_OUT` and must not receive a payable Checkout URL.

### FR-07 — Payment outcomes

- Successful Stripe payment must return to the public confirmation page, not require `/client-profile`, and show a safe confirmation or finalization-in-progress state.
- Choosing Stripe's cancel action must return to the public landing with a clear non-success message and an available retry path.
- A failed or expired payment must not produce confirmed attendance and must release capacity no later than the configured hold expiry.
- Public outcome pages must not put name, phone, or email in URLs and must not reveal account existence.
- Only the durable confirmed state must expose an accessible `Add to calendar` download. It must download an interoperable `.ics` event named `Salsa de Cali`, starting Sunday, August 30, 2026 at 4:00 PM in `America/New_York`, lasting 60 minutes, and located at `54 Coles St, Jersey City`. Finalizing and non-confirmed states must not offer this action.

### FR-08 — Fulfillment and persistence

The signed Stripe webhook remains the source of truth for paid fulfillment. A completed payment must idempotently produce or update the linked `Purchase`, preserve a `ClassSession` with the contractual start, duration, capacity, and location, and create one `Attendance` for the customer and session. Special-class fulfillment must validate the paid amount against the amount locked on the existing Session/Purchase attempt, not against a price recomputed from webhook processing time. A legitimate 2000-cent Session created before the deadline remains fulfillable through its existing bounded Stripe Session expiry even when completion or webhook delivery occurs at or after the deadline; mismatched Session/Purchase amounts or tampered metadata remain rejected.

### FR-09 — Cancellation and refund communication

The landing and confirmation page must state that cancellation and refund are permitted through Friday, August 28, 2026 at 4:00 PM without exposing the raw IANA timezone identifier. For this MVP, staff may validate and process an eligible refund manually in Stripe/backoffice. Automated refund execution is explicitly out of scope.

### FR-10 — Timezone correctness

All business decisions and formatting calculations must use `America/New_York`, but customer copy must not print that raw identifier. Persistence must use the fixed UTC start `2026-08-30T20:00:00.000Z` and fixed refund deadline `2026-08-28T20:00:00.000Z`; server-local timezone construction is not allowed.

### FR-11 — Accessibility and mobile behavior

The page must be usable without horizontal scrolling at 375, 768, 1024, and 1440 CSS pixels. Dialog form controls require associated labels, errors must be announced, focus must move to the first invalid field or outcome message, and all interactive controls must be keyboard reachable with visible focus. Focus must not escape an open reservation dialog, and the background page must not scroll beneath it. No global floating control may overlap the special landing's dialog inputs or purchase actions. The foreground video must have an accessible name, poster/fallback, inline playback, and default to muted, looping autoplay unless reduced motion is requested. The complete portrait foreground must use `object-contain`, while an inaccessible, muted, blurred, enlarged `object-cover` backdrop of the same video fills the media panel decoratively. A clearly visible in-page button above the video overlays must toggle play/pause, remain keyboard operable with visible focus, and announce its current action and pressed state. An adjacent always-visible sound button must start in the muted state, unmute or mute the same video only after user interaction, and announce its current action and pressed state. If autoplay is rejected, the button must remain available to start playback. Hover and focus states must not shift layout. Information required to purchase must also exist as text and must not depend on video audio.

### FR-12 — Operational readiness

Production release is blocked until the deployed live environment is verified to have the existing Stripe secret, webhook secret, canonical site URL, and required webhook event subscriptions. Verification must use redacted status/evidence only; secrets must never be read into the spec, logs, screenshots, or issue text.

### FR-13 — Timed promotion and route-scoped announcement

The canonical pricing policy uses regular amount 2500 cents, promotional amount 2000 cents, exact discount 20%, and deadline instant `2026-08-30T14:00:00.000Z` (`2026-08-30T10:00:00-04:00`). The promotion is active only when the authoritative instant is strictly less than the deadline. One millisecond before the deadline resolves to 2000 cents; the exact deadline and every later instant resolve to 2500 cents.

Before the deadline, `/special-salsa-class` replaces the generic announcement with the English message `Get your spot for $20 — save 20% until Sunday at 10:00 AM.`, an absolute countdown to the confirmed deadline, and a `Reserve now` CTA that opens the one existing reservation dialog without cloning or rendering another form. The special countdown is a compact text label without a clock icon or digital `HH:MM:SS` presentation. It expresses remaining whole days, hours, and minutes in English; uses correct singular/plural forms; omits zero-valued leading units; shows `Less than 1 min` below one minute; and never shows seconds. The display rounds down partial minutes and refreshes at the next minute boundary rather than every second. The landing price and any visible dialog/submit price must show `$20`. At the deadline, the special promotional announcement/countdown disappears, the live landing/dialog price changes to `$25`, and new Checkout Sessions use 2500 cents. No expired discount claim or zeroed promotional countdown may remain visible. Other routes keep their existing generic announcement, rolling digital countdown with clock icon, CTA, and pricing behavior exactly as before.

The banner preserves the direct URL contract `/special-salsa-class?reserve=1`. That query value is a transient open intent: opening focuses Name, consumes only `reserve=1` with a same-route replace that preserves every unrelated query parameter, and prevents refresh from reopening unexpectedly. Closing returns focus to the actual opener when the dialog was opened from the banner or landing CTA. Direct URL entry may fall back to the landing CTA because no focused opener exists. Repeated opens from either CTA, Back/Forward navigation, Escape/backdrop dismissal, and close-button dismissal must never create duplicate dialogs, stale query state, page reloads, or lost form behavior.

FR-13 supersedes every earlier static `$25` or `Reserve for $25` presentation statement in this document: those surfaces are price-aware and render `$20`/`Reserve for $20` only while the promotion is active, then `$25`/`Reserve for $25` at and after the deadline. Historical visual-refinement descriptions remain evidence of their completed work, not a conflicting current price contract.

The client-safe presentation and server checkout must resolve from one canonical deadline/price policy. Server-rendered initial state must be passed into client countdown/price state so hydration does not depend on a second browser-locale interpretation or render-time `Date.now()`. The browser may display the server-defined policy but cannot submit or override price, discount, deadline, currency, or locked amount.

A Checkout Session/Purchase amount becomes immutable when the attempt is first admitted. Same-attempt recovery after the deadline returns the still-open pre-deadline Session and preserves 2000 cents. A different new attempt admitted at or after the deadline uses 2500 cents. Existing capacity, hold expiry, Stripe Session expiry, idempotency, customer linking, cancellation URL, and receipt behavior remain unchanged.

## Security Rules

- Preserve the existing checkout IP rate limit or apply an equally strict event-specific limit.
- Normalize and validate name, email, phone, and attempt identifier on the server.
- Treat the attempt identifier as an idempotency key, not as authentication.
- Never accept amount, currency, capacity, date, time, duration, address, success URL, cancel URL, or refund deadline from the browser for this flow.
- Never accept promotion status, discount percentage, deadline, or locked attempt amount from the browser; derive a new attempt's amount from the server clock and preserve an existing attempt's persisted amount.
- Verify Stripe webhook signatures before processing and retain existing event-level idempotency.
- Return only event/payment state from public confirmation; never return contact data, Clerk identifiers, local user identifiers, or account-existence signals.
- Do not place PII in query strings or structured logs.
- Keep profile authentication separate from guest checkout.

## Acceptance Criteria

### Scenario: Public visitor sees the fixed event

```gherkin
Given the visitor is not signed in
When they open /special-salsa-class
Then the landing is available without an authentication redirect
And the header exposes the logo, course search, and mobile menu without changing the default public header
And the menu shows Log in without a fake avatar or My profile
And the page shows Sunday, August 30, 2026 with 4:00 PM on the next line
And the page shows 60 minutes, the current server-authoritative USD price, and 54 Coles St, Jersey City
And the hero action reads Reserve here and opens the named reservation dialog with focus inside
```

### Scenario: Hero video is configured once

```gherkin
Given the event video configuration is /Videos/special-salsa.mp4
When the landing renders
Then the hero uses that source
And replacing the single configuration value replaces the rendered source
And checkout behavior is unchanged
```

### Scenario: Confirmed reservation can be added to a calendar

```gherkin
Given a paid Stripe Session has a durable successful Purchase
When the visitor views the public confirmation page
Then an accessible Add to calendar action downloads an iCalendar file for Salsa de Cali
And the event starts August 30, 2026 at 4:00 PM America/New_York for 60 minutes at 54 Coles St, Jersey City
But a finalizing or non-confirmed outcome does not offer the action
```

### Scenario: Existing customer completes guest checkout

```gherkin
Given the submitted email and phone resolve unambiguously to one existing customer
And the visitor has no authenticated session
When the visitor submits valid contact data and pays USD 25
Then the purchase and attendance are linked to the existing customer
And no authenticated session is created
And the response never states that the account already existed
```

### Scenario: New customer completes guest checkout

```gherkin
Given the submitted email and phone do not resolve to a customer
When the visitor submits valid contact data and pays USD 25
Then a Clerk customer and local User are created
And the purchase and attendance are linked to that customer
And the browser remains signed out
And the customer can later use Profile with their email or phone
```

### Scenario: Conflicting identity is not disclosed

```gherkin
Given the submitted email and phone resolve to different customers
When checkout is submitted
Then no account is linked or created
And no Stripe Checkout URL is returned
And the visitor receives a generic contact-details error
And the response does not identify either existing account
```

### Scenario: Duplicate submission is idempotent

```gherkin
Given a valid checkout attempt has an open Stripe Checkout Session
When the same attempt is submitted again
Then the server returns the same open session
And only one pending hold exists
And at most one confirmed reservation can result
```

### Scenario: Final spot is concurrency safe

```gherkin
Given 39 spots are paid or held
When two distinct customers submit valid checkout attempts concurrently
Then exactly one attempt receives a payable Checkout URL for the final spot
And the other receives 409 SOLD_OUT
And the counted capacity never exceeds 40
```

### Scenario: Sold-out landing

```gherkin
Given all 40 spots are paid or held
When a visitor opens or submits the landing
Then the page presents a sold-out state
And the purchase action is disabled when availability is known
And the server rejects any raced submission with 409 SOLD_OUT
```

### Scenario: Payment succeeds publicly

```gherkin
Given the visitor completes the hosted payment
When Stripe redirects to the configured success URL
Then the visitor sees /special-salsa-class/confirmation
And the page shows payment received or reservation confirmed without requiring login
And no contact data appears in the URL or response
And webhook redelivery cannot create a duplicate Purchase or Attendance
```

### Scenario: Payment is cancelled

```gherkin
Given the visitor is on Stripe Hosted Checkout
When they choose the cancel action
Then they return to /special-salsa-class with a non-success message
And no confirmed attendance is created
And they may retry the same open attempt until it expires
```

### Scenario: Payment fails or expires

```gherkin
Given a pending hold exists
When Stripe reports payment failure or session expiry
Then the Purchase is not marked paid
And no confirmed attendance is created
And the hold no longer counts toward the 40 spots
```

### Scenario: Refund policy is communicated

```gherkin
Given a visitor views the landing or payment confirmation
Then the page states the Friday, August 28, 2026 at 4:00 PM deadline without a raw IANA timezone identifier
And it states that eligible refunds are handled by PLI staff
And it does not claim that an automated refund is available
```

### Scenario: Timezone is independent of server locale

```gherkin
Given the application runs on a host outside America/New_York
When the event session and refund deadline are evaluated
Then the session start persists as 2026-08-30T20:00:00.000Z
And the refund deadline evaluates as 2026-08-28T20:00:00.000Z
And customer copy still shows 4:00 PM without printing the raw IANA timezone identifier
```

### Scenario: Mobile and keyboard purchase

```gherkin
Given a visitor uses a mobile viewport or keyboard-only navigation
When they review the video and submit the form
Then all required event information is available as text
And the logo, search, and menu remain usable without horizontal overflow
And the video, details, and purchase action stack on mobile
And controls remain visible, labeled, and operable
And validation and outcome messages receive accessible focus or announcement
And reduced-motion preference prevents forced video autoplay
```

### Scenario: Authenticated visitor opens the special landing

```gherkin
Given the visitor is signed in
When they open /special-salsa-class
Then the authentication action shows their real avatar when available
And the exact label is My profile
And the action links to /client-profile
And guest checkout remains available
```

### Scenario: Promotion boundary is exact

```gherkin
Given the promotion deadline is 2026-08-30T14:00:00.000Z
When pricing is resolved at 2026-08-30T13:59:59.999Z
Then the amount is 2000 cents and the discount is active
When pricing is resolved at 2026-08-30T14:00:00.000Z
Then the amount is 2500 cents and the discount is inactive
When pricing is resolved after 2026-08-30T14:00:00.000Z
Then the amount remains 2500 cents and the discount is inactive
```

### Scenario: Existing attempt keeps its locked promotional amount

```gherkin
Given a valid attempt created a 2000-cent open Checkout Session before the deadline
When the same attempt is recovered at or after the deadline but before its existing bounded Session expiry
Then checkout returns the same Session URL
And the Purchase and Session amount remain 2000 cents
And no second hold or Session is created
```

### Scenario: Webhook validates the locked amount

```gherkin
Given a legitimate pre-deadline special Session and linked Purchase both lock 2000 cents
When the signed paid webhook is processed after the promotion deadline but before the Session's bounded expiry
Then fulfillment accepts 2000 cents and remains idempotent
But when the paid Session amount differs from the linked Purchase's locked amount
Then fulfillment rejects the mismatch without creating Attendance
```

### Scenario: Special promotion announcement expires accurately

```gherkin
Given the visitor opens /special-salsa-class before the deadline
Then the banner says Get your spot for $20 — save 20% until Sunday at 10:00 AM.
And its iconless countdown targets the fixed promotion deadline
And it shows whole days, hours, and minutes with correct English singular/plural forms and no seconds
And below one minute it shows Less than 1 min
And its CTA opens the existing reservation flow
And exactly one reservation dialog is present with initial focus on Name
And closing returns focus to the banner CTA
And the transient reserve query is removed while unrelated query parameters remain
And visible special-class price surfaces show $20
When the authoritative time reaches the deadline
Then the promotional banner and countdown are absent
And live special-class price surfaces show $25
And a new checkout uses 2500 cents
But another public route retains its existing generic announcement and pricing behavior
```

### Scenario: Reservation intent supports direct and repeated entry

```gherkin
Given the visitor opens /special-salsa-class?campaign=social&reserve=1
Then exactly one existing reservation dialog opens and Name receives focus
And the URL becomes /special-salsa-class?campaign=social without reloading
When the visitor closes and reopens from Reserve here
Then the same dialog opens once and focus returns to Reserve here on close
When the visitor later uses Back or Forward
Then the route remains usable without a trapped or duplicate dialog
```

## Definition Of Done

- [ ] Every acceptance scenario has focused automated coverage at the lowest practical layer.
- [ ] A controlled concurrent-capacity test proves no more than 40 active paid/held spots.
- [ ] Existing checkout, kiosk, and webhook tests remain green.
- [ ] No Prisma migration or new dependency is introduced without returning to `resolve.md`.
- [ ] The temporary video asset is present at the configured deployed path and is replaceable from one value.
- [ ] Live Stripe operational gates are recorded as pass/fail without secret values.
- [ ] Mobile, keyboard, reduced-motion, cancel, failure, sold-out, existing-customer, new-customer, and public-success flows are verified.

## Open Questions

No product-contract questions remain. Live Stripe readiness and availability of the temporary video file are implementation/release gates, not behavioral ambiguities.
