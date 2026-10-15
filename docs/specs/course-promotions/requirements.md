# Course Promotions — Requirements

## Status

`ACCEPTED — IMPLEMENTATION AUTHORIZED`

## Objective

Let staff configure reusable course promotions in the course wizard while keeping price, identity, entitlement, package, and channel decisions authoritative on the server.

## Promotion Contract

1. A course MAY contain multiple bounded promotions.
2. Each promotion MUST define:
   - a stable identifier and public label;
   - active or inactive state;
   - fixed final price or percentage discount;
   - inclusive start and end dates;
   - whether the window uses class date or purchase date;
   - an audience;
   - one or more allowed channels.
3. Dates and weekdays MUST use `America/New_York`.
4. Initial audiences are `everyone` and `heritage_pin_delivered`.
5. Initial channels are public booking, authenticated profile, and trusted kiosk. Staff MUST select channels independently.
6. Medal audiences are out of scope until a separate specification defines how bronze, silver, gold, and platinum status is earned and verified.
7. A course MUST have at most 12 promotions. Invalid, unbounded, malformed, or unknown rules MUST fail closed.

## Authoring Requirements

1. The course wizard MUST contain a dedicated `Promotions` step.
2. Base drop-in and first-class prices MUST remain in `Prices`; campaign configuration MUST move out of that step.
3. Staff MUST be able to add, edit, activate, deactivate, and remove multiple promotions before saving the course.
4. The wizard MUST expose label, pricing mode/value, date basis/window, audience, and channels.
5. Preview MUST summarize configured promotions before publish.
6. Existing legacy `scheduleRules.specialDiscount` data MUST remain readable but MUST NOT silently become an active checkout discount. If encountered, it MUST be represented as an inactive draft requiring explicit staff activation.

## Pricing Requirements

1. The client MUST NOT authorize a promotion or final amount.
2. The server MUST load promotions from the authoritative course record and normalize them before evaluation.
3. Package reservation takes precedence over paid promotional checkout.
4. Without an applicable package, the server MUST compare all independently authorized price candidates and charge exactly one lowest price.
5. Promotions MUST NOT stack with each other, coupons, addons, or consecutive-class pricing.
6. Promotions apply only to one-participant drop-in bookings. Package purchases and unrelated services are ineligible.
7. A percentage discount MUST use the authoritative regular drop-in price as its base and round to the nearest cent.
8. Fixed or calculated paid prices MUST satisfy the payment processor minimum; this version does not create free checkouts.
9. Equal-price ties SHOULD preserve the existing non-promotional price reason rather than claiming an unnecessary promotion.
10. Checkout metadata MUST record the applied promotion identifier, label, price, pricing mode, audience, and date basis without trusting client metadata.

## Eligibility Requirements

1. Class-date promotions use the selected authoritative class occurrence date.
2. Purchase-date promotions use the server clock in New York.
3. `everyone` requires no customer entitlement.
4. `heritage_pin_delivered` requires a valid delivered Heritage entitlement resolved from the exact authenticated booking identity.
5. Pending, malformed, missing, or identity-mismatched Heritage entitlements are ineligible.
6. Public booking and profile promotions MUST preserve exact-phone ownership and existing identity gates.
7. Kiosk promotions MUST require the existing trusted terminal/session authority; a caller-provided channel flag is insufficient.

## Presentation Requirements

1. Public booking and profile class selection SHOULD show the public promotion label when an active promotion may apply to that occurrence and channel.
2. Restricted promotions MUST NOT display an unconditional promotional price before identity and entitlement validation.
3. The final promotional price MUST appear only after server-side eligibility resolution.
4. Inactive, expired, future, malformed, or channel-inapplicable promotions MUST NOT be advertised as currently available.

## Heritage Configuration

1. The Heritage benefit MUST be represented by course promotion data, not a separate client-controlled price path.
2. It charges a fixed US$15 for class dates from `2026-10-01` through `2026-10-31`.
3. It requires a delivered Heritage pin.
4. It is enabled for public booking and profile, not kiosk, unless staff later changes the promotion configuration.
5. It applies to:
   - `bachata-beginners`, Thursday at 21:10; and
   - `salsa-cubana-absolute-beginners`, Sunday at 17:00.
6. Purchases may occur on any day because the promotion uses class date.

## Acceptance Criteria

- [ ] Staff can configure multiple bounded promotions in a dedicated wizard step.
- [ ] Fixed-price and percentage promotions round-trip through the staff course API.
- [ ] Public labels are occurrence- and channel-aware without exposing an unverified restricted price.
- [ ] Package booking remains first priority.
- [ ] Checkout applies exactly one lowest authorized price and records server-generated metadata.
- [ ] Delivered Heritage holders receive US$15 for the two configured October classes from booking or profile.
- [ ] Pending or missing Heritage entitlements receive no Heritage price.
- [ ] Client payload changes cannot forge audience, channel, dates, or amount.
- [ ] Existing first-class, package, coupon, addon, consecutive, cash, and identity boundaries remain intact.
