# Shareable Web Booking — Requirements

## Status

`IMPLEMENTED — FEATURE CHECKS PASSED`

## Objective

Provide a public, shareable booking page where a visitor can discover and reserve any future scheduled class within the next 90 days, then complete the existing QR web registration and booking flow.

## Scope

### In scope

- Load active public catalog courses from the existing `GET /api/catalog/courses` contract.
- Expand recurring course schedules into concrete bookable occurrences from now through the next 90 days in `America/New_York`.
- Offer month and class-type filters above the list.
- Group filtered occurrences by date and order dates and times chronologically.
- Hand valid selections to the existing QR booking URL and preserve automatic sign-in plus `/client-profile` completion.
- Preserve the accepted PLI visual identity and route-scoped floating-chrome suppression.

### Out of scope

- New database tables, third-party dependencies, alternate authentication/checkout flows, capacity management, or changes to kiosk behavior.
- An unbounded recurring calendar or reservations beyond the 90-day window.
- Staff-side schedule/category cleanup; the public filter must work with current sparse metadata.

## Functional Requirements

1. The page MUST represent future scheduled occurrences beginning at the current New York time and ending at the 90-day horizon.
2. The page MUST derive occurrences from the existing public catalog schedule and `scheduleRules` data; it MUST NOT duplicate registration, verification, checkout, or account bootstrap.
3. Past occurrences MUST NOT appear as bookable options.
4. Occurrences MUST be ordered by date and time and grouped under human-readable date headings.
5. The month filter MUST include only months represented inside the 90-day window, plus an `All dates` option. The current month is the default, and visible option labels MUST show only the month name without a year.
6. The class-type filter MUST include `All classes` and dynamically include represented types.
7. Type classification MUST normalize course category, title, and slug. `Bachata` maps to Bachata; `On2` or `Mambo` maps to Salsa On2; `Salsa`, `Timba`, `Rueda`, `Cuban`, or `Cubana` maps to Salsa Cubana; unmatched courses map to Other.
8. Changing either filter MUST update the visible grouped occurrences without another account or booking flow.
9. A no-results filter state MUST preserve the filters and explain that no matching classes exist.
10. Selecting a valid occurrence MUST navigate through `buildQrBookingUrl` with slug, date, time, and duration.
11. Successful personal completion MUST activate any pending Clerk session and redirect to `/client-profile`.
12. The PLI logo and introductory information MUST be centered.
13. Every available occurrence MUST use a three-column row: course photo on the left, three compact center rows (class title; time plus duration; instructor name), and a visible circular red `BOOK` action on the right.
14. A search field MUST filter occurrences by class title, category/style, normalized class type, or slug without another network request.
15. The search field MUST occupy the left half of one discovery-toolbar row while the month and class-type filters each occupy one quarter. All three controls MUST remain on that same row on desktop and phone, using compact mobile sizing.
16. The centered PLI logo MUST be visually larger, and the redundant `BOOK` eyebrow beneath it MUST be removed.
17. The global assistant/chat and floating Home controls MUST remain hidden on exact `/booking` and unchanged elsewhere.
18. Loading, API-error, malformed schedule, invalid selection, and duplicate-submit behavior MUST fail safely.

## Constraints

- Reuse `/api/catalog/courses`, `scheduleRules`, existing date/time helpers, `buildQrBookingUrl`, and the course/`EnrollModal` personal flow.
- Use `America/New_York` for horizon, grouping, ordering, and past evaluation.
- Keep the implementation bounded to 90 days and localized to the booking feature plus a backward-compatible public course category field if required.
- Source implementation begins only after explicit acceptance of the expanded plan.

## Security Rules

- Treat public catalog and query data as untrusted at the UI boundary.
- Keep server-side QR booking validation authoritative for direct or stale URLs.
- Do not expose staff-only schedule or attendance APIs.
- Do not move auth, account creation, payment, or booking authorization into the list page.

## Acceptance Criteria

- [ ] A visitor can choose any represented month within the next 90 days.
- [ ] A visitor can filter by All classes, Salsa Cubana, Salsa On2, Bachata, or Other when represented.
- [ ] Future occurrences are grouped and globally chronological; past occurrences are absent.
- [ ] A visible circular `BOOK` action produces the canonical QR booking handoff.
- [ ] Centered PLI branding and route-scoped chat/Home suppression remain intact.
- [ ] Search and filters compose one 2:1:1 toolbar row on desktop and phone, with compact controls and smaller mobile text.
- [ ] Month options omit the year, and every card shows title, time/duration, and instructor as three compact metadata rows.
- [ ] Search matches title, category/style, normalized type, and slug; the larger logo renders without the BOOK eyebrow.
- [ ] New-client automatic sign-in/profile redirect, returning-user behavior, and kiosk behavior remain unchanged.
- [ ] No migration, new dependency, staff-only API exposure, or parallel booking/auth implementation is introduced.

## Definition Of Done

- [ ] Expanded implementation matches the accepted behavior.
- [ ] Focused schedule expansion, classification, filtering, rendering, and handoff tests pass.
- [ ] Feature E2E, ESLint, and typecheck pass.
- [ ] Existing unrelated check-in E2E drift remains documented separately.

## Open Questions

- none
