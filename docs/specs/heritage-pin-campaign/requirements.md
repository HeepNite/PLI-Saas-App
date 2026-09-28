# Heritage Pin Campaign — Requirements

## Status

`ACCEPTED — IMPLEMENTATION AUTHORIZED`

## Objective

Convert public booking visitors during the Latin Heritage campaign by awarding one physical country pin after a qualifying card payment, recording the benefit against the identified student, and charging delivered pin holders a fixed US$15 price for eligible Sunday and Monday classes.

## Scope

### In scope

- Promote the campaign in the public `/booking` journey.
- Collect a country from a controlled selector before the campaign purchase handoff.
- Associate campaign state with the user identified by the existing phone/account flow.
- Create a pending country-pin entitlement only after a successful qualifying card payment.
- Let authorized staff mark the physical pin as delivered.
- Show campaign country and pending/delivered status in the staff student panel.
- Apply a server-authoritative US$15 price to eligible Sunday/Monday classes after delivery.
- Make campaign acquisition and benefit dates centrally configurable, initially October 2026 in `America/New_York`.
- Require card/wallet for remote public web booking while preserving cash for trusted in-studio kiosk flows.
- Preserve PLI branding and selected class context throughout the booking handoff without flashing the general course/home experience.

### Out of scope

- Inventory management for physical pins.
- Shipping pins or claiming delivery without a staff handoff.
- A new authentication, registration, checkout, or student identity flow.
- Reusing the authentication `StudentPinCredential` for the physical country pin.
- An admin campaign editor, coupon marketplace, or unbounded promotion engine.
- Changes to unrelated kiosk, package, consecutive-class, or staff cash behavior.

## Campaign Windows

1. All date and weekday decisions MUST use `America/New_York`.
2. Acquisition and benefit windows MUST be defined in one campaign configuration module.
3. Default acquisition dates MUST be `2026-10-01` through `2026-10-31`, inclusive.
4. Default benefit dates MUST be `2026-10-01` through `2026-10-31`, inclusive.
5. An operator MUST be able to extend an end date, such as through the first week of November, through central configuration without changing campaign decision logic.
6. Invalid or missing overrides MUST fail closed to the documented defaults or disable the invalid override; they MUST NOT create an unbounded campaign.

## Acquisition Requirements

1. Any student without an existing Heritage country-pin entitlement MAY earn the benefit once.
2. The public booking campaign announcement MUST explain that a completed online payment earns a country pin and that delivered pin holders receive eligible classes for US$15.
3. The booking journey MUST request a country from a controlled country selector for a student attempting to earn the benefit.
4. Country input and campaign markers MUST be treated as untrusted until validated server-side.
5. A qualifying acquisition MUST:
   - originate from the public campaign booking journey;
   - complete through Stripe card/wallet payment;
   - settle successfully during the configured acquisition window; and
   - include a valid normalized country code.
6. Cash, pending, failed, canceled, refunded, or incomplete payments MUST NOT create the entitlement.
7. A successful qualifying payment MUST create exactly one pending entitlement associated with the user and source purchase.
8. Replayed Stripe events or later qualifying purchases MUST NOT create duplicate entitlements.
9. A free-form note MAY expose the country for staff readability, but MUST NOT be the authorization source for delivery status or pricing.
10. Existing new-student pricing remains independent. The campaign does not add a pre-delivery discount and does not stack with the new-student offer.

## Delivery Requirements

1. A newly earned pin MUST begin in `pending` state.
2. Only an authorized staff actor MAY mark a pending pin as `delivered`.
3. Delivery MUST record the delivery timestamp and staff actor while preserving all unrelated purchase metadata.
4. The staff action MUST be idempotent and audited.
5. Staff UI MUST distinguish the physical campaign benefit from the existing authentication PIN.
6. Staff UI MUST show at least:
   - `Country pin pending · <country>` before handoff; or
   - `Heritage pin · <country>` after handoff.
7. Pricing eligibility MUST remain inactive while the pin is pending.

## Benefit and Pricing Requirements

1. A student qualifies for the pin price only when a delivered entitlement is found for the identified user.
2. An eligible class occurrence MUST fall within the configured benefit window and occur on Sunday or Monday in `America/New_York`.
3. The eligible class price MUST be exactly US$15 for one drop-in participant.
4. The pin price MUST NOT stack with coupons, packages, new-student pricing, or another promotion.
5. When more than one price rule could apply, the checkout MUST present and charge one server-authorized price; it MUST NOT combine reductions.
6. The server MUST derive entitlement and final amount from persisted user/purchase data. Client flags, query parameters, notes, or displayed totals MUST NOT authorize the price.
7. Direct checkout requests with a forged pin claim or amount MUST fail validation or be normalized to the server-authorized amount.
8. Extending the configured benefit end date MUST automatically extend Sunday/Monday eligibility only within that bounded interval.

## Payment-Channel Requirements

1. Remote public `/booking` purchases MUST offer card/Apple Pay/Google Pay only.
2. A user MUST NOT be able to restore pay-on-site by modifying client state or sending a direct remote cash request.
3. A trusted in-studio kiosk flow MUST retain its current cash option.
4. Kiosk trust MUST come from the existing validated terminal/session context, never from a caller-provided URL flag alone.
5. A customer using the actual in-studio kiosk context MAY receive the delivered-pin price and pay cash or card according to existing kiosk rules.
6. Staff cash and settlement tools MUST remain unchanged outside the campaign behavior explicitly described here.

## Branded Booking Journey Requirements

1. Public booking MUST display campaign messaging during the active acquisition window.
2. The booking header MUST show a restrained PLI-red campaign capsule reading `¡Feliz Mes de la Herencia Latina!` above `Upcoming classes`, followed by the supporting line `Your country. Your pin. Your community.`
3. Campaign-only header treatment MUST disappear automatically outside the configured acquisition window.
4. The campaign copy MUST communicate:
   - successful online payment earns a pin representing the selected country;
   - the benefit activates after physical delivery; and
   - eligible Sunday/Monday classes cost US$15 during the configured benefit window.
3. Selecting `BOOK` MUST preserve the selected course, date, time, and country through the existing registration/checkout flow.
4. Navigation MUST immediately show a branded PLI transition instead of the general course/home page.
5. The compact form MUST retain the PLI logo and a concise summary of the selected class and campaign.
6. The campaign presentation MUST use the supplied real-pin photograph as an optimized product visual, with accessible alternative text and a caption clarifying that the Argentina and Mexico pins shown are examples.
7. Campaign styling MUST remain within the PLI near-black, institutional red, and white palette. Additional color comes only from the flags; campaign chrome MUST NOT introduce gold and MUST NOT reduce toolbar or class-list usability.
8. During the active campaign, eligible circular `BOOK` actions MUST resemble enamel pins through a dark graphite/silver rim, depth, and a rotating set of different national flags.
9. Flag assignment to class buttons MUST be deterministic, decorative, and drawn from a centralized Latin American/Caribbean display set. It MUST NOT preselect or claim the visitor's country.
10. On hover or keyboard focus, a flag-pin action SHOULD perform a short 3D turn from the flag face to a PLI-red `BOOK` face. Pointer activation MUST still book with one click.
11. Because touch devices have no hover, mobile flag pins MUST retain a visible `BOOK` badge and book on the first tap. With reduced-motion preferences, the control MUST use a non-rotating transition while keeping `BOOK` visible.
12. Every flag-pin action MUST retain its complete accessible booking name on desktop and phone.
13. After country selection, the wizard SHOULD render the visitor's selected flag as a circular pin preview with the confirmation `We’ll have your pin ready.`
12. The primary campaign message SHOULD use the direction `Your country. Your pin. Your community.` and identify the delivered-pin Sunday/Monday US$15 benefit without implying the photographed countries are the only options.
9. Existing phone verification, Clerk account creation/sign-in, Stripe checkout, and `/client-profile` completion MUST remain authoritative.
10. Abandoning before successful payment MUST create no entitlement and the campaign may be offered again on a later attempt.
11. Once an entitlement exists, the system MUST not award another pin; known users should see their current pending/delivered status instead of a duplicate acquisition promise.

## Security and Data Rules

- Store structured campaign fields in purchase metadata associated with the user; do not infer entitlement by parsing notes.
- Preserve unrelated metadata on webhook and staff updates.
- Validate country codes against the campaign country list.
- Keep payment, entitlement, and delivery transitions idempotent.
- Apply existing staff authorization, rate limiting, and audit conventions to delivery updates.
- Do not expose staff-only entitlement mutation through public endpoints.

## Acceptance Criteria

- [ ] A visitor can understand the campaign, see the optimized real-pin visual, and select a country from `/booking`.
- [ ] A successful qualifying Stripe payment creates one pending entitlement tied to the user and purchase.
- [ ] Non-card or unsuccessful payments create no entitlement.
- [ ] Staff can see the pending country and mark the pin delivered exactly once.
- [ ] Delivered status is visible as a distinct Heritage pin badge in the staff student panel.
- [ ] A delivered holder is charged US$15 for eligible Sunday/Monday classes inside the benefit window.
- [ ] Pending/non-holder users and ineligible dates receive normal authoritative pricing.
- [ ] Discounts do not stack.
- [ ] Remote public booking is card/wallet only, while trusted kiosk cash remains available.
- [ ] Changing the bounded campaign end configuration extends eligibility without logic changes.
- [ ] The booking transition never flashes the general course/home experience and retains PLI/class context.
- [ ] Existing registration, sign-in, checkout, profile redirect, kiosk, and staff flows remain functional.

## Definition of Done

- [ ] Requirements, resolved decisions, design, and execution tasks agree.
- [ ] Unit/API/component tests cover campaign boundaries and security decisions.
- [ ] Browser coverage verifies messaging, country selection, branding, card-only remote UI, and no flash.
- [ ] Focused tests, typecheck, lint, and relevant integration/E2E checks pass.
- [ ] Every skipped or unrelated failing check is reported explicitly.
