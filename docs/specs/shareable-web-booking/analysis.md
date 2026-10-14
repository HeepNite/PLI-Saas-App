# Analysis — Shareable Web Booking

## Observed Evidence

- `GET /api/catalog/courses` publicly returns active `CourseData` entries with course media, level, duration, Mon-based fallback weekdays/times, and raw `scheduleRules`.
- `scheduleRules.rules[].weekday` uses JS weekday numbering and supports day-specific times plus recurrence metadata.
- `lib/class-schedule.ts` already establishes `America/New_York` date/time and past-slot semantics.
- `lib/checkin/qr-booking-links.ts` builds the canonical `/courses/{slug}?enroll=1&qrBooking=1` handoff with date, time, and duration.
- `CourseAsideRight` detects `qrBooking=1`, enters `EnrollModal` personal completion, and preserves new/returning-user handling.
- Personal completion activates a pending Clerk session and redirects to `/client-profile`; kiosk station completion is separate.
- Database category values are currently sparse. Course titles and slugs contain usable dance-style terms such as Salsa, Timba, Rueda, and Bachata.
- Both global floating controls consume `useHideFloatingChrome`, whose exact `/booking` rule hides chat and Home without affecting unrelated routes.

## Intended Behavior

- `/booking` displays future scheduled occurrences for the next 90 days rather than only today's terminal classes.
- Visitors filter represented occurrences by month and normalized dance type, then select a visible circular `BOOK` action.
- Results remain grouped by date and chronological after filtering.
- The existing branded presentation, QR handoff, automatic sign-in, and profile redirect remain intact.

## Reuse And Change Surface

- Reuse the public catalog; do not add a public schedule endpoint or expose staff schedule data.
- Expand schedules in a pure booking helper using New York calendar date keys and a hard 90-day cap.
- Add a backward-compatible optional category field to public `CourseData` mapping while retaining title/slug fallback classification.
- Keep UI/filter state inside the existing booking client.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Infinite recurring schedules | Hard-cap expansion at 90 calendar days. |
| Visitor timezone shifts dates | Generate and compare New York date/time keys. |
| Sparse categories | Deterministic category + title + slug classification. |
| Stale/direct URL manipulation | Existing downstream QR/server validation remains authoritative. |
| Long mobile list | Default to current month and group compact rows by date. |
| Unrelated route regressions | Keep floating-chrome suppression exact to `/booking`; do not edit kiosk flow. |

## Residual External Issue

Four pre-existing `e2e/checkin.spec.ts` cases still expect the former `Student check-in` entry screen while current `/checkin` renders `Welcome!`. This drift is outside the accepted booking expansion and is tracked separately.
