# Shareable Web Booking — Requirements

## Status

`IMPLEMENTED — PROMOTIONAL LINK EXTENSION IN PROGRESS`

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
- Provide the short promotional route `/monday-salsa-beginner` for future Monday occurrences of the existing `salsa-night-beginner` course.

### Out of scope

- New database tables, third-party dependencies, alternate authentication/checkout flows, capacity management, or changes to kiosk behavior.
- An unbounded recurring calendar or reservations beyond the 90-day window.
- Staff-side schedule/category cleanup; the public filter must work with current sparse metadata.
- Staff creation or management of promotional aliases; a dashboard is deferred to a later feature.

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
17. The global assistant/chat and floating Home controls MUST remain hidden on `/booking`, the exact promotional route `/monday-salsa-beginner`, and the existing campaign handoff; behavior elsewhere MUST remain unchanged.
18. Loading, API-error, malformed schedule, invalid selection, and duplicate-submit behavior MUST fail safely.
19. `/monday-salsa-beginner` MUST derive its occurrences from the existing public catalog course `salsa-night-beginner` and show only its future Monday schedule inside the same 90-day horizon; it MUST NOT duplicate or hard-code bookable dates.
20. The focused promotional route MUST omit broad catalog discovery controls and fail safely when the course is inactive, missing, malformed, or has no future Monday occurrence.
21. Selecting a promoted occurrence MUST preserve course, date, time, duration, `bookingSource`, and the explicitly selected Heritage country through the canonical QR booking URL.
22. After country selection, the existing course enrollment flow MUST load the selected class context and personal-data form before checkout; the promotional route MUST NOT introduce a parallel identity or payment flow.
23. After identity resolution, a verified customer with no successful purchase or package history MUST retain the existing US$15 new-student price.
24. An existing customer without an applicable package MUST receive the regular server-authoritative price.
25. An existing customer with an active, unexpired package applicable to the selected course MUST be able to reserve that occurrence against the package instead of entering paid checkout.
26. Package booking MUST create one scheduled attendance and hold package capacity without final credit consumption. Attendance completion consumes the credit; cancellation before attendance releases the hold.
27. The server MUST prevent package holds from exceeding available credits and MUST reject forged package ownership, stale package state, duplicate booking, full class, invalid schedule, or mismatched course claims.
28. Physical Heritage pin state MUST NOT affect new-student, regular, or package routing.

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
- [ ] `/monday-salsa-beginner` shows only future Monday occurrences of `salsa-night-beginner` and omits broad discovery controls.
- [ ] Country selection from the promotional route loads the existing personal-data form with complete class/date/time/duration/source/country context for checkout.
- [ ] New verified customers receive US$15, existing customers receive the regular price, and applicable package holders reserve without paid checkout.
- [ ] A package reservation holds capacity, cannot oversubscribe credits, consumes on attended completion, and releases on pre-attendance cancellation.
- [ ] Heritage pin state does not affect pricing or package routing.
- [ ] Missing or inactive promotional course data fails safely without exposing another class.

## Definition Of Done

- [ ] Expanded implementation matches the accepted behavior.
- [ ] Focused schedule expansion, classification, filtering, rendering, and handoff tests pass.
- [ ] Feature E2E, ESLint, and typecheck pass.
- [ ] Existing unrelated check-in E2E drift remains documented separately.

## Open Questions

- none
