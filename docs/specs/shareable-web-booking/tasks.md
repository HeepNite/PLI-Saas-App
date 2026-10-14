# Shareable Web Booking — Tasks

## Phase 1 — Expanded Plan Acceptance Gate

- [x] Confirm the public reservation use case supersedes the today-only selector.
- [x] Confirm the next-90-days horizon.
- [x] Explicitly accept this implementation order before source edits.

## Phase 2 — Public Schedule Model (TDD)

- [x] Add failing tests for New York date generation, 90-day bounds, recurrence expansion, chronological ordering, recurrence end handling, malformed schedules, and past-slot exclusion.
- [x] Add failing tests for type classification and represented month/type options.
- [x] Extend the pure booking occurrence builder with the smallest implementation that satisfies those tests.
- [x] Expose optional catalog category through the existing public mapping only if needed; do not add an endpoint or migration.

## Phase 3 — Filtered Branded UI

- [x] Replace the today-classes request with one public catalog request.
- [x] Add month and class-type controls with current-month and all-class defaults.
- [x] Group filtered occurrences by date and render explicit no-results/error/loading states.
- [x] Center the logo/header content and add visible circular red `BOOK` actions.
- [x] Preserve exact-route chat/Home suppression and canonical QR navigation.

## Phase 4 — Integration And Regression

- [x] Prove future selections carry slug, date, time, and duration into `buildQrBookingUrl`.
- [x] Verify personal completion still activates the pending Clerk session and redirects to `/client-profile`.
- [x] Verify returning-user and kiosk behavior remain unchanged.

## Phase 5 — Validation

- [x] Run focused Vitest coverage for expansion, classification, filters, QR links, completion, and public catalog mapping.
- [x] Run the branded `/booking` Playwright scenario across month/type filtering and future handoff.
- [x] Run feature ESLint and `npm run typecheck`.
- [x] Inspect a mobile browser render.
- [x] Record the unrelated legacy `e2e/checkin.spec.ts` drift separately.

## Minimal Implementation Order

1. Lock the 90-day schedule and filter model with failing tests.
2. Implement the pure occurrence/classification layer.
3. Wire the existing branded page to catalog data and filters.
4. Prove future QR handoff and unchanged personal completion.
5. Run focused static, unit, integration, browser, and visual checks.

## Validation Evidence

- RED: 15 expected focused failures covered missing 90-day expansion, classification, filters, centered branding, and circular actions.
- GREEN: four focused Vitest suites passed 54 tests.
- Browser: the month/type filter and future QR handoff Playwright scenario passed.
- Static: typecheck passed; scoped ESLint exited successfully with one pre-existing unused-symbol warning in `lib/catalog-courses.ts`.
- Visual: a 390×844 live render showed centered PLI branding, compact filters, grouped dates, and circular `BOOK` actions; chat/Home remained absent.
- Discovery toolbar follow-up: normalized local search, 50/50 desktop composition, responsive mobile stacking, larger logo, and removed BOOK eyebrow verified with focused tests and Playwright.
- Browser geometry: at both 1280px and 390px, search/month/type remain on one 2:1:1 row; the 390px controls measure 173px/86.5px/86.5px at a compact 40px height.
- Class cards use three columns at mobile and desktop: image, three compact metadata rows, circular BOOK action.
- Month controls show only `Sep`, `Oct`, etc.; mobile filter text is 10px and card metadata uses title, time/duration, and instructor rows.
- External: four legacy `/checkin` E2Es remain separate contract drift.

## Phase 6 — Discovery Toolbar Follow-up

- [x] Add failing focused assertions for normalized class search, no-results behavior, 50/50 desktop toolbar composition, larger logo, and absence of the BOOK eyebrow.
- [x] Extend local occurrence filtering with the search query without adding a request or endpoint.
- [x] Compose search left and month/type filters right on desktop.
- [x] Keep the same 2:1:1 toolbar row on phone with compact controls.
- [x] Collapse class cards to photo, combined information, and BOOK columns.
- [x] Format month choices without a year and reduce filter typography.
- [x] Render title, time/duration, and instructor as three compact center rows.
- [x] Enlarge the centered PLI logo and remove the BOOK eyebrow.
- [x] Re-run focused tests, feature E2E, scoped ESLint, typecheck, and mobile/desktop browser inspection.

## Delivery Guardrails

- No new endpoint, schema migration, dependency, auth path, checkout path, or kiosk edit.
- Keep the public schedule bounded to 90 days.
- Stop and document a concrete contract gap before expanding beyond the files and contracts above.
