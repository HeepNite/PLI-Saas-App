# Shareable Web Booking — Design

## Intent

Turn the existing branded selector into a bounded public schedule browser. The page owns recurrence expansion, discovery filters, grouping, and navigation only; the established QR course flow owns booking and identity transitions.

## Reuse Strategy

| Existing contract | Reuse |
| --- | --- |
| `GET /api/catalog/courses` | Load active public courses, media, schedule fields, and recurrence rules once. |
| `lib/schedule-rules.ts` / `lib/class-schedule.ts` | Resolve day-specific times and New York past-slot semantics. |
| `lib/checkin/qr-booking-links.ts` | Build canonical booking URLs. |
| `CourseAsideRight` / `EnrollModal` | Preserve new/returning client behavior, checkout, session activation, and profile redirect. |
| Profile package booking services | Resolve an applicable owned package and create a scheduled attendance without a parallel identity flow. |
| Attendance status transitions | Finalize a held package credit only when scheduled attendance becomes attended; release the hold on cancellation. |
| `useHideFloatingChrome` | Keep chat and Home controls hidden only on `/booking`. |

## Affected Areas

- Extend the booking occurrence model from one API day to a deterministic 90-day window.
- Add an optional public course category field to the existing course mapping/type if useful for classification.
- Add month/type filter state and grouped rendering to the existing booking client.
- Extend focused unit/component and Playwright coverage.

## Architecture Constraints

- No migration or third-party dependency. A narrowly scoped authenticated package-booking endpoint MAY extend the existing profile booking service when the current API cannot represent a non-consuming hold.
- Keep recurrence expansion pure and capped at 90 days.
- Generate calendar date keys independently of the visitor's local timezone; all booking semantics use `America/New_York`.
- Respect `scheduleRules` day-specific times first and the catalog's Mon-based fallback schedule second.
- Exclude malformed schedules and past occurrences defensively.
- Use stable identifiers composed from slug, date, and time.

## Data Model

A monthly occurrence contains course display fields plus:

- `date` and `time`
- `monthKey` (`YYYY-MM`)
- normalized `classType`
- canonical `bookingUrl`

Filters are derived from the occurrence set:

- month: current month by default, represented months, and `all`
- type: `all` plus represented normalized types

The UI derives grouped dates after both filters are applied.

## Visual Notes

- Center the white PLI logo, `BOOK` eyebrow, heading, and supporting copy.
- Keep the existing near-black/red palette and compact occurrence cards.
- Add one responsive discovery toolbar above the first date group using a 2:1:1 grid: 50% search, 25% month, and 25% class type. Keep all three controls on one row at every supported width, with compact mobile text/padding.
- Search the already-expanded occurrence set locally across normalized title, category/style, class-type label, and slug.
- Enlarge the centered PLI logo and remove the redundant BOOK eyebrow below it.
- Use exactly three class-row columns: photo left, three compact center lines (title; time and duration; first instructor name), and one visible circular red `BOOK` action right.
- Keep filter typography compact on phone and format month choices with month names only; underlying values remain `YYYY-MM`.
- Retain optional course imagery and responsive truncation without hiding date/time context.

## Package Reservation Model

A public package booking uses authenticated identity plus the selected course/date/time. The server resolves the owned package; clients never authorize a package ID or remaining-credit count.

For a finite package, available capacity equals persisted remaining credits minus active scheduled holds. Booking creates a `scheduled` attendance and an idempotent zero-delta package usage row as the hold. Transitioning that attendance to an attended state atomically decrements the package and converts the hold to a consumed `-1` ledger entry. Pre-attendance cancellation removes the hold without changing remaining credits. Unlimited packages keep a zero-delta usage record.

## Security And Operational Notes

- Public catalog data is display input, not booking authority.
- Direct/stale QR links remain validated downstream.
- Package ownership, course applicability, expiry, status, class capacity, duplicate attendance, and effective available credits are revalidated transactionally.
- A 90-day client expansion is bounded and avoids repeated requests while filters change.
- Existing terminal, staff, auth, rate-limit, and audit behavior remains untouched outside package reservation transitions.
