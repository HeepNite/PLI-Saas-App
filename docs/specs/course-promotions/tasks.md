# Course Promotions — Tasks

## Slice 1 — Domain and API

- [ ] Add bounded promotion types and normalization.
- [ ] Preserve legacy `specialDiscount` only as an inactive editor migration source.
- [ ] Round-trip promotions through the staff course API.
- [ ] Add resolver coverage for dates, channels, audiences, percentages, fixed prices, malformed rules, and lowest-price selection.

## Slice 2 — Wizard

- [ ] Remove campaign fields from the Prices step.
- [ ] Add Promotions to course wizard navigation.
- [ ] Support multiple add/edit/activate/deactivate/remove operations.
- [ ] Summarize promotions in preview.
- [ ] Add focused component and state tests.

## Slice 3 — Checkout and Presentation

- [ ] Derive the public-booking channel only from a dedicated server route/context; preserve profile and trusted-kiosk contexts.
- [ ] Add a read-only ordinary-public-booking quote: permit anonymous `everyone` quotes and require exact authenticated identity and entitlement only for restricted audiences, with no Stripe intent/session, purchase, reservation, or payment state; preserve profile's existing authenticated authoritative checkout-session path.
- [ ] Resolve promotion eligibility from authoritative course, occurrence, restricted-audience identity and entitlement, package, and booking-shape data.
- [ ] Re-evaluate that authoritative state when creating the final PaymentIntent; never accept client quote or amount authority, and prove that entitlement, promotion, date, package, or booking-shape changes after a quote use the fresh result.
- [ ] Preserve package-first and non-stacking rules without ownership probing or automatic paid-route diversion; explicit packages use the existing reservation flow and its endpoint retains auto-detection.
- [ ] Reject remote public cash server-side while preserving trusted kiosk cash.
- [ ] Add server-generated promotion metadata.
- [ ] Show safe occurrence-aware labels in public booking and profile; in ordinary public booking, show a restricted final price only from the validated quote.
- [ ] Add checkout and presentation tests for anonymous `everyone` pricing, eligible delivered-pin October pricing, anonymous/ineligible Heritage regular pricing without reason details, submitted-contact non-substitution, quote non-mutation, out-of-window, strict public USD/date/time/scheduled-occurrence rejection, package precedence, and intent revalidation after entitlement, promotion, date, package, or booking-shape changes.
- [ ] Add UI and server tests proving ordinary remote public cash is hidden and rejected, while trusted kiosk cash remains available under its existing authority.

## Slice 4 — Heritage Rollout

- [ ] Create `bachata-beginners` for Thursday 21:10.
- [ ] Create `salsa-cubana-absolute-beginners` for Sunday 17:00.
- [ ] Add both slugs to applicable package plans.
- [ ] Add the October delivered-Heritage US$15 promotion to both courses.
- [ ] Retire the replaced Rueda course slots without deleting history.
- [ ] Require remote backup, dry-run, environment proof, transaction, rollback material, and explicit authorization.

## Validation

- [ ] Focused unit, API, and component tests pass.
- [ ] Typecheck and scoped lint pass.
- [ ] `git diff --check` passes.
- [ ] Native review closes when enabled.
- [ ] Every PR stays below 400 changed lines.
- [ ] Live booking/profile/catalog checks confirm the configured behavior.
