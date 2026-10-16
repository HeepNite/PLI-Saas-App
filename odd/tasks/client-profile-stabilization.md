# Client Profile Stabilization

## Goal

Stabilize the authenticated client profile and public booking flow on `codex/develop` before production: restore the verified profile-completion prompt and simplified profile surface, correct New York booking timestamps and calendar visibility, support the approved international phone list, and redesign profile data entry as a wizard without replacing existing server contracts.

## Target

- Base: `origin/codex/develop` at `335b894ef9060ae49b500f2cb7fcaf4976afb72d`
- Branch: `fix/client-profile-stabilization-dev`
- Environment: `https://dev.palladiumlatin.art`
- Production is out of scope until Development verification and explicit delivery authorization.

## Confirmed defects

- A Development checkout sold `salsa-timba-in-new-york-2` for 2026-10-16 at 7:00 PM, but `/api/profile/bookings` returned `2026-10-16T19:00:00.000Z`; the profile displayed 3:00 PM in `America/New_York`.
- Booked events reach the profile API and next-class summary, but are not rendered as events in the assignment calendar.
- Development still mounts Student Moments, Analytics, and Gear.
- The verified mobile “Complete your information” modal remains isolated on a stale branch and is not in `codex/develop`.
- Public booking still validates and formats phone input as US-only.

## Constraints

- Use `America/New_York` as the authoritative class wall-clock timezone.
- Reuse current booking, profile, Clerk, checkout, and persistence contracts.
- International phone scope: United States, Puerto Rico, Argentina, Peru, Mexico, Chile, Ecuador, Brazil, Dominican Republic, Colombia, and Canada.
- Persist canonical new phone values as E.164; reject ambiguous legacy identity matches.
- Do not merge the stale `feat/client-profile-ui-polish` or international-phone branches wholesale.
- Preserve reusable removed-section components; remove only their profile composition.
- Keep the authorized Development fixture until validation, then remove its test records:
  - user: `PLI Kiosk Smoke`
  - attendance: `cmvbaj77q0005jx06l9vsde0w`
  - session: `cmvbaj7790003jx06lvuo40dv`

## Tasks

- [x] T1 — Define and reconcile the active profile stabilization specification against current `codex/develop`.
  - Status: done.
  - Evidence: `bb09becba94cdb7f738b938bc4de5c7956bd4927` (`docs(profile): define stabilization contract`).
- [ ] T2 — Correct New York session timestamp construction and render booked classes in the profile calendar.
  - Status: in progress.
  - Verification: RED/GREEN timezone boundary tests, profile booking API tests, calendar component tests, live Development fixture.
  - Evidence: pending.
- [ ] T3 — Restore the mobile completion prompt and remove Student Moments, Analytics, and Gear from profile composition.
  - Status: pending.
  - Verification: focused component tests, profile E2E, responsive visual checks.
  - Evidence: pending.
- [ ] T4 — Add approved-country international phone entry to public booking and identity boundaries.
  - Status: pending.
  - Verification: E.164 tests for all eleven countries, Clerk identity routing, checkout validation, live non-destructive Development smoke.
  - Evidence: pending.
- [ ] T5 — Specify and implement the profile information wizard over existing fields and APIs.
  - Status: pending; step structure requires a focused user decision after field inventory.
  - Verification: step validation, persistence, resume/edit behavior, mobile and desktop E2E.
  - Evidence: pending.
- [ ] T6 — Run integrated Development verification, remove controlled test records, and prepare bounded delivery slices.
  - Status: pending.
  - Verification: focused suites, TypeScript, ESLint, full applicable tests, independent verification, live Development smoke.
  - Evidence: pending.

## Risks

- Item 1: Development test records and cleanup.
- Item 2: Clerk identity verification and phone ownership.
- Item 3: Existing booking/profile API and timestamp contracts.
- Item 4: Package reservation concurrency and duplicate holds.
- Item 5: Development deployment and later production promotion.
