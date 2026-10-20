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
- The historical Development fixture was retained through the initial integrated smoke and its controlled attendance/session/purchase records were then removed. Any fresh T7 smoke must use isolated records and clean them immediately:
  - retained test identity: `PLI Kiosk Smoke`
  - removed attendance: `cmvbaj77q0005jx06l9vsde0w`
  - removed session: `cmvbaj7790003jx06lvuo40dv`

## Tasks

- [x] T1 — Define and reconcile the active profile stabilization specification against current `codex/develop`.
  - Status: done.
  - Evidence: `bb09becba94cdb7f738b938bc4de5c7956bd4927` (`docs(profile): define stabilization contract`).
- [x] T2 — Correct New York session timestamp construction and render booked classes in the profile calendar.
  - Status: done.
  - Verification: RED/GREEN timezone, host-independence, calendar visibility, pending interaction, profile booking API, and component tests. Live Development fixture remains for T6.
  - Evidence: `16eb6c65` (New York instants), `9e78a3e3` (agenda projection), `a8f021f4` (scheduled calendar rendering); 69/69 focused tests, typecheck, ESLint, diff check, and independent verification approved. Full suite: 3,681 tests passed; seven integration files unavailable without `DATABASE_URL`.
- [x] T3 — Restore the mobile completion prompt and remove Student Moments, Analytics, and Gear from profile composition.
  - Status: done.
  - Verification: 7/7 focused component tests, typecheck, ESLint (four inherited hook warnings), diff check, and three new responsive Playwright scenarios passed on an isolated worktree server. The full profile E2E file retains five unrelated baseline failures.
  - Evidence: `3c86f5b1` (`fix(profile): restore mobile completion prompt`).
- [x] T4 — Add approved-country international phone entry to public booking and identity boundaries.
  - Status: done; live Development smoke remains intentionally grouped with T6 deployment verification.
  - Verification: RED/GREEN coverage for the exact eleven-country catalog, E.164 UI propagation, country-change re-entry, Clerk identity routing, exact legacy candidates, recovery, public checkout intent/session fail-closed boundaries, and environment-gated Clerk test phones. 143/143 focused tests, typecheck, ESLint, and diff check passed. Independent verification initially found two boundary defects; correction `63e282fd` closed both and re-verification approved with 202/202 verifier checks. Full suite: 3,718 tests passed and 41 skipped; seven integration files (eight test failures) remain unavailable without `DATABASE_URL`.
  - Evidence: `31cdeff3` (country catalog and field), `d06f926a` (booking UI and E.164 propagation), `224cef73` (server allowlist boundaries), `63e282fd` (strict checkout and Clerk test-host guards).
- [x] T5 — Specify and implement the profile information wizard over existing fields and APIs.
  - Status: done with the accepted three-step responsive contract: Personal information, Emergency contact, and optional Billing address; linear navigation, one final save, and reopen at Personal with in-memory edits retained.
  - Verification: RED/GREEN wizard navigation, shared server validation semantics, partial billing, read-only identity fields, accessibility, final-save timing, and reopen behavior. 23/23 focused tests, typecheck, ESLint, diff check, and an isolated desktop/mobile Playwright scenario passed. Independent verification initially found validation and accessibility defects; `043ff59b` closed both and re-verification approved. Full suite: 3,730 tests passed and 41 skipped; seven integration files (eight test failures) remain unavailable without `DATABASE_URL`. Native review inspection remained unavailable with `package-local-binary-missing` and created no lineage.
  - Evidence: `9b43a89d` (resolved interaction contract), `ac107464` (wizard), `64272a23` (validation/reopen tests), `9ab7438c` (responsive E2E), `043ff59b` (shared validation and accessibility).
- [ ] T6 — Decouple public web booking fulfillment from kiosk semantics and repair signed-in package fallback.
  - Status: implemented and independently approved; work-unit commit and Development deployment await explicit authorization.
  - Observed evidence: a successful `/friday` public booking created `2026-10-23T23:00:00.000Z` for 7:00 PM New York, but persisted `flowContext: qr_phone`, `purchaseSource: kiosk`, and `checked_in_no_package`; `/api/profile/bookings` therefore returned no booking until the controlled attendance was normalized to `scheduled`. An existing signed-in customer without a package was blocked by static schedule validation before checkout fallback.
  - Required correction: keep compact QR-shaped presentation only; preserve server-owned `public_booking` channel metadata, scheduled attendance, profile visibility, and DB-backed catalog validation while leaving kiosk behavior unchanged.
  - Verification: focused payload/session/webhook/profile/package tests, TypeScript, ESLint, diff check, independent verification, and a fresh Development paid-booking smoke.
  - Cleanup already completed: the historical controlled attendance/session/purchases and the temporary `PLI Web Smoke` DB/Clerk identity, attendance, session, purchase, and counter were removed with exact post-delete zero-count verification. Stripe test artifacts remain pending because the preview secret is provider-protected and the local Stripe CLI is authenticated to a different account.
  - Evidence: RED established five original boundary failures plus two verifier regressions. GREEN: 126/126 focused tests, TypeScript, diff check, and changed-file ESLint with three inherited warnings. Full suite: 3,735 passed and 41 skipped; the same seven integration files remain unavailable without `DATABASE_URL`. Independent re-verification: `APPROVED`. Native review remained unavailable with `package-local-binary-missing` and created no lineage. Current slice: 236 changed lines, below the 400-line PR limit.
- [ ] T7 — Redeploy, rerun integrated Development verification, finish controlled Stripe cleanup, and prepare the final delivery slice.
  - Status: pending.
  - Verification: exact deployment SHA, public web booking, authenticated profile/calendar, modal/wizard responsive walkthrough, unsupported-phone rejection, and post-cleanup DB/Clerk/Stripe evidence.
  - Evidence: pending.

## Risks

- Item 1: Development test records and cleanup.
- Item 2: Clerk identity verification and phone ownership.
- Item 3: Existing booking/profile API and timestamp contracts.
- Item 4: Package reservation concurrency and duplicate holds.
- Item 5: Development deployment and later production promotion.
- Item 3: Public web booking currently reaches kiosk-derived metadata/status through shared QR presentation plumbing; correction must preserve server-owned channel authority and kiosk behavior.
