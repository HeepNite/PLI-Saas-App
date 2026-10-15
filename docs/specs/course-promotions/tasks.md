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

- [ ] Derive trusted promotion channel.
- [ ] Resolve promotion eligibility from authoritative course, occurrence, identity, and entitlement data.
- [ ] Preserve package-first and non-stacking rules.
- [ ] Add server-generated promotion metadata.
- [ ] Show safe occurrence-aware labels in public booking and profile.
- [ ] Add checkout and presentation tests.

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
