# Resolution — Shareable Web Booking

## Contract Decisions

1. `/booking` is a general public reservation link, not a today-only terminal derivative.
2. The booking horizon is the next 90 days in `America/New_York`; recurring schedules are never rendered without a bound.
3. `GET /api/catalog/courses` is the source because it already publishes active courses and recurrence rules. The staff schedule API remains private and the today-classes endpoint remains unchanged for terminal use.
4. The page expands public course schedules locally through a pure tested occurrence builder. Past slots are omitted.
5. The default month is the current New York month. The selector also offers every represented month in the horizon and `All dates`.
6. Type filters are derived from represented occurrences. Sparse category metadata is supplemented deterministically by title and slug classification.
7. Classification priority is Bachata, Salsa On2 (`on2` or `mambo`), Salsa Cubana (`salsa`, `timba`, `rueda`, `cuban`, `cubana`), then Other.
8. Filtered results remain grouped by date and chronological within each date.
9. The existing QR course/`EnrollModal` personal flow remains the sole owner of identity, booking, checkout, session activation, and profile redirect.
10. The centered PLI header, circular red `BOOK` action, dark brand palette, and `/booking` floating-chrome suppression are presentation requirements.

## Contract Reconciliation

- The previous today-only requirement is superseded by the 90-day contract above.
- `/api/checkin/terminal/today-classes` remains valid for terminal operations but is no longer the `/booking` list source.
- `CourseData` currently omits the database category. A backward-compatible optional `category` field may be exposed through the existing catalog mapping; classification still works when it is absent.
- No database migration or new public endpoint is required.

## Implementation Preconditions

1. The user accepted the 90-day horizon.
2. The expanded implementation order in `tasks.md` requires explicit acceptance before source edits.
3. If catalog recurrence data cannot represent a course safely, omit that occurrence and preserve an observable empty/error state rather than inventing a schedule.
