# Heritage Pin Campaign — Implementation Tasks

## Status

`ACCEPTED — IN PROGRESS`

## Work Unit 1 — Campaign contract

- [x] Document requirements, current-system analysis, resolved product decisions, architecture, risks, and tests.
- [x] Verify spec files agree on acquisition, delivery, pricing, cash boundaries, dates, and branding.

## Work Unit 2 — Entitlement and staff delivery

- [x] Add deterministic campaign config/domain helpers and tests.
- [x] Admit country/source into hosted checkout metadata.
- [x] Award one pending entitlement after a qualifying paid Stripe event.
- [x] Load entitlement into staff student aggregates.
- [x] Render distinct pending/delivered country-pin badges.
- [x] Add authorized, audited, idempotent `Mark delivered` behavior.
- [x] Add focused domain/API/component tests.

## Work Unit 3 — Branded booking journey

- [ ] Add campaign announcement and country-selection interaction to `/booking`.
- [ ] Carry campaign context through the existing QR booking handoff.
- [ ] Replace generic QR-course transition/layout with a branded booking shell on every viewport.
- [ ] Keep logo, selected course, date, time, and campaign summary visible.
- [ ] Preserve registration, verification, Stripe, sign-in, cancel, and profile redirect behavior.
- [ ] Add component and browser coverage.

## Work Unit 4 — Payment and price enforcement

- [ ] Add server-authoritative delivered-entitlement lookup for checkout.
- [ ] Apply fixed US$15 pricing only to eligible Sunday/Monday drop-ins in the benefit window.
- [ ] Reject stacking with coupons/packages/new-student/consecutive offers.
- [ ] Hide onsite payment in remote public booking.
- [ ] Reject remote cash server-side.
- [ ] Preserve cash for validated in-studio kiosk terminal/session flows.
- [ ] Add focused pricing and payment-channel tests.

## Work Unit 5 — Validation

- [ ] Run all focused campaign/domain/API/component tests.
- [ ] Run booking and relevant check-in E2E/browser checks.
- [ ] Verify desktop and 390px branded flow.
- [ ] Run typecheck and scoped lint.
- [ ] Run the broader affected test suite required by observed risk.
- [ ] Record failures, skips, pre-existing drift, and final evidence.

## Delivery Notes

- Keep each work-unit commit reviewable and include tests with behavior.
- If a work unit exceeds 400 changed lines, split delivery into a Feature Branch Chain before opening a PR.
- Push, PR creation, and merge require separate user decisions.
