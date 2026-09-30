# Class Promotion Links — Organic Task Tracker

## Outcome

Provide short, campaign-ready public links that focus the existing booking journey on one promoted class schedule without duplicating catalog, enrollment, identity, or checkout behavior.

## Current Slice

The first approved link is `/monday-salsa-beginner` for the existing `salsa-night-beginner` course, limited to its future Monday 9:10 PM occurrences inside the existing 90-day booking horizon.

A staff dashboard for creating and managing promotional aliases is explicitly deferred to a later feature.

## Tasks

- [x] 1. Extend the shareable-booking contract.
  - Record the exact short URL, course slug, Monday-only scope, canonical handoff, fail-closed behavior, and deferred dashboard.
  - Require the Heritage country step to continue into the existing preloaded personal-data and purchase flow.
  - Evidence: `docs/specs/shareable-web-booking/requirements.md` defines the exact route, course/day focus, route-owned filtering, canonical country-to-form handoff, safe empty state, chrome suppression, and deferred dashboard.

- [x] 2. Add reusable focused-occurrence behavior.
  - Let the existing booking page accept a trusted route-owned course/day focus.
  - Filter the catalog-derived occurrences without introducing a new endpoint or trusting public query parameters.
  - Hide broad discovery controls in focused mode while preserving the campaign presentation and 90-day policy.
  - Evidence: `BookingPromotionFocus` and `focusBookingOccurrences` filter the existing catalog-derived 90-day occurrences by exact course slug and New York schedule date; `ShareableBookingPage` hides the discovery toolbar only in route-owned focused mode.

- [x] 3. Add the short promotional route.
  - Serve `/monday-salsa-beginner` with only future Monday occurrences of `salsa-night-beginner`.
  - Preserve country selection and the canonical booking URL with class, date, time, duration, source, and country.
  - Preserve route-scoped floating chrome suppression and fail safely if the course or Monday occurrences disappear.
  - Evidence: `app/monday-salsa-beginner/page.tsx` binds the exact slug to weekday 1; focused empty state inherits safe catalog behavior; floating chrome suppression includes the exact route. 30 focused booking/campaign handoff tests, typecheck, diff check, and scoped ESLint pass.

- [ ] 4. Verify and deliver the slice.
  - Cover focused filtering, rendering, route behavior, and country-to-form handoff.
  - Run focused tests, typecheck, scoped lint, diff check, and production build where needed.
  - Deliver to `codex/develop` and verify the short URL only with explicit publishing authorization.
  - Evidence: 30 focused booking/campaign handoff tests, typecheck, scoped ESLint, diff check, and the production build pass; the build emits `/monday-salsa-beginner`. Remote delivery and live route verification remain pending.

## Decisions

- Public URL: `/monday-salsa-beginner`.
- Existing course: `salsa-night-beginner` (`Salsa Beginner / Open Level`).
- Schedule focus: Monday at 9:10 PM, derived from the current public catalog rather than duplicated as a bookable schedule.
- Personal and payment data flow: reuse the existing course `EnrollModal` handoff after country selection.
- Dashboard/alias management: deferred; this slice must not add database schema or staff administration.
