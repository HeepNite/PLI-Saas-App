# Heritage Pin Campaign — Requirements

## Status

`ACCEPTED — IMPLEMENTATION AUTHORIZED`

## Objective

Convert public booking visitors during the Latin Heritage campaign by awarding one physical country pin after a qualifying card payment and recording its fulfillment against the identified student. The physical pin is independent from class pricing, customer eligibility, and package usage.

## Scope

### In scope

- Promote the campaign in the public `/booking` journey.
- Collect a country from a controlled selector before the campaign purchase handoff.
- Associate campaign state with the user identified by the existing phone/account flow.
- Create a pending country-pin entitlement only after a successful qualifying card payment.
- Let authorized staff mark the physical pin as delivered.
- Show campaign country and pending/delivered status in the staff student panel.
- Preserve the existing server-authoritative pricing contract: verified first-time customers receive the US$15 new-student price, existing customers receive the current regular price, and applicable package holders book against their package.
- Make campaign acquisition and benefit dates centrally configurable, initially October 2026 in `America/New_York`.
- Require card/wallet for remote public web booking while preserving cash for trusted in-studio kiosk flows.
- Preserve PLI branding and selected class context throughout the booking handoff without flashing the general course/home experience.

### Out of scope

- Inventory management for physical pins.
- Shipping pins or claiming delivery without a staff handoff.
- A new authentication, registration, checkout, or student identity flow.
- Reusing the authentication `StudentPinCredential` for the physical country pin.
- An admin campaign editor, coupon marketplace, or unbounded promotion engine.
- Changes to unrelated kiosk, consecutive-class, or staff cash behavior.

## Campaign Windows

1. All date and weekday decisions MUST use `America/New_York`.
2. Acquisition and benefit windows MUST be defined in one campaign configuration module.
3. Default acquisition dates MUST be `2026-10-01` through `2026-10-31`, inclusive.
4. An operator MUST be able to extend the acquisition end date through central configuration without changing campaign decision logic.
5. Invalid or missing overrides MUST fail closed to the documented defaults or disable the invalid override; they MUST NOT create an unbounded campaign.

## Acquisition Requirements

1. Any student without an existing Heritage country-pin entitlement MAY earn the benefit once.
2. The public booking campaign announcement MUST explain that a completed online payment earns a country pin. It MUST NOT imply that pin status changes class pricing.
3. The booking journey MUST request a country from a controlled country selector for a student attempting to earn the benefit. The campaign geography MUST be limited to Hispanic America and Spain: Argentina, Bolivia, Chile, Colombia, Costa Rica, Cuba, Dominican Republic, Ecuador, El Salvador, Guatemala, Honduras, Mexico, Nicaragua, Panama, Paraguay, Peru, Puerto Rico, Uruguay, Venezuela, and Spain.
4. Country input and campaign markers MUST be treated as untrusted until validated server-side. Every country outside the campaign geography MUST be rejected even when it is otherwise a valid ISO country code.
5. A qualifying acquisition MUST:
   - originate from the public campaign booking journey;
   - complete through Stripe card/wallet payment;
   - settle successfully during the configured acquisition window; and
   - include a valid normalized country code.
6. Cash, pending, failed, canceled, refunded, or incomplete payments MUST NOT create the entitlement.
7. A successful qualifying payment MUST create exactly one pending entitlement associated with the user and source purchase.
8. Replayed Stripe events or later qualifying purchases MUST NOT create duplicate entitlements.
9. A free-form note MAY expose the country for staff readability, but MUST NOT be the authorization source for delivery status or pricing.
10. Existing new-student, regular drop-in, and package pricing remain independent from the campaign and authoritative.

## Delivery Requirements

1. A newly earned pin MUST begin in `pending` state.
2. Only an authorized staff actor MAY mark a pending pin as `delivered`.
3. Delivery MUST record the delivery timestamp and staff actor while preserving all unrelated purchase metadata.
4. The staff action MUST be idempotent and audited.
5. Staff UI MUST distinguish the physical campaign benefit from the existing authentication PIN.
6. Staff UI MUST show at least:
   - `Country pin pending · <country>` before handoff; or
   - `Heritage pin · <country>` after handoff.
7. Pending or delivered pin state MUST NOT affect pricing or package eligibility.

## Pricing and Package Requirements

1. A verified customer with no successful purchase and no package history qualifies for the existing US$15 new-student price.
2. An existing customer without an applicable package receives the current server-authoritative regular price, presently US$20 for the applicable drop-in.
3. An existing customer with an active, unexpired package applicable to the selected course MUST be offered package booking instead of being forced through regular checkout.
4. Public package booking MUST create a scheduled booking against the selected package without treating the physical Heritage pin as authority.
5. Package capacity MUST be reserved so one credit cannot back multiple future bookings, while definitive credit consumption and usage reporting occur only when attendance transitions from scheduled to attended.
6. Canceling a scheduled package booking before attendance MUST release its reservation without consuming a credit.
7. Package, regular, and new-student decisions MUST be recalculated server-side from the authenticated user, selected class, purchase history, and package state.
8. Client flags, query parameters, pin status, notes, or displayed totals MUST NOT authorize a price or package credit.

## Payment-Channel Requirements

1. Remote public `/booking` purchases MUST offer card/Apple Pay/Google Pay only.
2. A user MUST NOT be able to restore pay-on-site by modifying client state or sending a direct remote cash request.
3. A trusted in-studio kiosk flow MUST retain its current cash option.
4. Kiosk trust MUST come from the existing validated terminal/session context, never from a caller-provided URL flag alone.
5. A customer using the actual in-studio kiosk context MAY receive the delivered-pin price and pay cash or card according to existing kiosk rules.
6. Staff cash and settlement tools MUST remain unchanged outside the campaign behavior explicitly described here.

## Branded Booking Journey Requirements

1. Public booking MUST display campaign messaging during the active acquisition window.
2. The booking header MUST remain compact: `¡Feliz Mes de la Herencia Latina!` followed only by `Your country. Your community.` above `Upcoming classes`, flanked by transparent PNG cutouts of the real Argentina and Mexico pins.
3. A subtle light sweep SHOULD travel left-to-right across the compact campaign heading, and MUST disable under reduced-motion preferences.
4. The richer campaign promotion MUST appear as a dismissible dialog after ten seconds, at most once per browser session, without UI copy announcing that a popup will appear.
5. The timed promotion MUST use a concise flag collage instead of the supplied real-pin photograph and MUST keep explanatory copy short enough to scan immediately.
6. The timed promotion MUST not open over the country-selection dialog or interrupt a booking already in progress.
7. Campaign-only treatment MUST disappear automatically outside the configured acquisition window.
8. Campaign copy MUST concisely communicate that online booking earns a selected-country pin and MUST NOT claim a pin-controlled class price.
9. Selecting `BOOK` MUST preserve the selected course, date, time, and country through the existing registration/checkout flow.
10. Navigation MUST immediately show a branded PLI transition instead of the general course/home page or its loading skeleton.
11. The compact form MUST retain the PLI logo, Heritage heading, and a concise summary of the selected class and campaign. The global announcement, catalog navigation, footer, home control, and assistant chrome MUST remain hidden for the entire public booking process.
12. Campaign styling MUST remain within the PLI near-black, institutional red, and white palette. Additional color comes only from the flags; campaign chrome MUST NOT introduce gold and MUST NOT reduce toolbar or class-list usability.
13. During the active campaign, eligible circular `BOOK` actions MUST resemble enamel pins through a dark graphite/silver rim, a full enamel-style flag face, depth, and a rotating set of different national flags.
14. Flag assignment to class buttons MUST be deterministic, decorative, and drawn only from a centralized Hispanic America and Spain display subset of the campaign country allowlist. Visible rows MUST cycle across the set instead of repeating one country because of hash collisions. Decorative flags MUST NOT preselect or claim the visitor's country.
15. Public booking layouts MUST NOT render standalone decorative flag rails or floating flag bubbles. Flags remain available only in campaign content, country selection, and eligible class booking actions.
16. On hover or keyboard focus, a flag-pin action SHOULD perform a short 3D turn from the flag face to a PLI-red `BOOK` face. Pointer activation MUST still book with one click.
17. Because touch devices have no hover, mobile flag pins MUST retain a visible `BOOK` badge and book on the first tap. With reduced-motion preferences, the control MUST use a non-rotating transition while keeping `BOOK` visible.
18. Every flag-pin action MUST retain its complete accessible booking name on desktop and phone.
19. After country selection, the wizard SHOULD render the visitor's selected flag as a circular pin preview with the confirmation `We’ll have your pin ready.`
20. Existing phone verification, Clerk account creation/sign-in, Stripe checkout, and `/client-profile` completion MUST remain authoritative.
21. Abandoning before successful payment MUST create no entitlement and the campaign may be offered again on a later attempt.
22. Once an entitlement exists, the system MUST not award another pin; known users should see their current pending/delivered status instead of a duplicate acquisition promise.
23. The inline public booking footer MUST render exactly two actions on one row: `Cancel | Continue` in the initial information phase and `Back | Continue` in later phases or steps. A context-equivalent final action MAY replace `Continue`, but a third profile/panel action MUST NOT appear.
24. Clerk's reserved `+1 555-555-0100…0199` test range MAY be accepted only when runtime evidence identifies the `codex/develop` Vercel preview and a Clerk test instance. Production and every environment that fails those guards MUST reject that range.
25. While the country-selection dialog is open, document scrolling MUST be locked and list-boundary wheel/touch input MUST NOT chain to the booking page. The dialog header, search, confirmation action, and explanatory copy MUST remain fixed; only the country list may scroll. Its scrollbar MUST use a narrow rounded campaign treatment, remain visually hidden at rest, appear while the list is scrolling, and fade after interaction.
26. During public campaign SMS access and verification, the complete active booking state—including its progress, information/contact content, entered contact summary, footer, PLI logo, Heritage campaign heading/tagline, and selected class—MUST remain visible, inert, and dimmed behind the verification card until the code is accepted or verification is canceled. The card MUST sit above a translucent near-black overlay with restrained blur; the booking state MUST NOT be replaced by a synthetic or opaque viewport. Kiosk verification presentation and all existing identity authority MUST remain unchanged.
27. A public campaign booking MUST include the information/contact step before packages, promotions, or payment even when Clerk already has a signed-in user. Existing contact-step shortcuts MAY remain only for their trusted profile and non-public QR contexts.
28. A public campaign booking MUST resolve the submitted phone before package selection, promotions, reservation, or payment. If the phone or submitted identity already belongs to an account, the flow MUST show a clear `This phone number already exists` account-access popup and MUST NOT start account-creation SMS. Only a genuinely new phone MAY start SMS verification, and it MUST do so at most once for that submission. An active Clerk session MAY satisfy the gate only when it owns that exact verified phone. Verification and account access MUST remain bound to the submitted phone; editing the phone MUST invalidate prior proof. Successful SMS or account access MUST preserve the mounted booking, entered contact data, selected class, and current progress. Kiosk and non-public enrollment behavior MUST remain unchanged.

## Security and Data Rules

- Store structured campaign fields in purchase metadata associated with the user; do not infer entitlement by parsing notes.
- Preserve unrelated metadata on webhook and staff updates.
- Validate country codes against the same centralized Hispanic America, Puerto Rico, and Spain allowlist used by the selector; UI filtering alone is insufficient.
- Keep payment, entitlement, and delivery transitions idempotent.
- Apply existing staff authorization, rate limiting, and audit conventions to delivery updates.
- Do not expose staff-only entitlement mutation through public endpoints.

## Acceptance Criteria

- [ ] A visitor can understand the campaign from the compact heading and timed flag promotion, then select a country from `/booking`.
- [ ] A successful qualifying Stripe payment creates one pending entitlement tied to the user and purchase.
- [ ] Non-card or unsuccessful payments create no entitlement.
- [ ] Staff can see the pending country and mark the pin delivered exactly once.
- [ ] Delivered status is visible as a distinct Heritage pin badge in the staff student panel.
- [ ] New verified customers receive the existing US$15 new-student price, existing customers receive the regular price, and applicable package holders can reserve with their package.
- [ ] Pin pending/delivered state produces no pricing or package-routing difference.
- [ ] Package reservations cannot oversubscribe credits; attendance completion consumes the credit and pre-attendance cancellation releases the reservation.
- [ ] Remote public booking is card/wallet only, while trusted kiosk cash remains available.
- [ ] Changing the bounded campaign end configuration extends eligibility without logic changes.
- [ ] The booking transition never flashes the general course/home experience and retains PLI/class context.
- [ ] Signed-in public campaign visitors still review the information/contact step before packages or payment.
- [ ] Booking-row flags are visibly varied and retain the enamel-pin treatment, while standalone decorative side rails and floating flag bubbles remain absent.
- [ ] Existing registration, sign-in, checkout, profile redirect, kiosk, and staff flows remain functional.

## Definition of Done

- [ ] Requirements, resolved decisions, design, and execution tasks agree.
- [ ] Unit/API/component tests cover campaign boundaries and security decisions.
- [ ] Browser coverage verifies messaging, country selection, branding, card-only remote UI, and no flash.
- [ ] Focused tests, typecheck, lint, and relevant integration/E2E checks pass.
- [ ] Every skipped or unrelated failing check is reported explicitly.
