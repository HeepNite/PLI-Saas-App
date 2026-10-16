# Client Profile Stabilization — Analysis

## Verified current state

| Area | Current `codex/develop` behavior | Evidence |
| --- | --- | --- |
| Session timestamp | A Development checkout labeled 2026-10-16 7:00 PM produced `startsAt=2026-10-16T19:00:00.000Z`; the profile formatted it as 3:00 PM New York. | Controlled `PLI Kiosk Smoke` fixture; `lib/class-schedule.ts` constructs date/time with host-local setters. |
| Booked-class visibility | `/api/profile/bookings` returns the scheduled attendance and the profile next-class summary shows it. The assignment calendar does not render booked-event maps. | `useAgendaCalendar.ts`, `AssignClassesCard.tsx`. |
| Empty state | Before the fixture, the profile displayed a generic “Next class: Tuesday 7:00 PM” while the bookings API returned an empty array. | Live Development smoke. |
| Profile completion | The accepted completion modal exists only on the stale profile-polish branch. | Reference commits `818e8416`, `6335fdd8`; absent from current composition. |
| Removed sections | Student Moments, Analytics, and Gear remain imported and rendered. | `ProfilePageClient.tsx`. |
| Public phone entry | Booking contact input uses US-specific formatting and completeness checks. | `EnrollModal.tsx`, `EnrollInfoStep.tsx`, enrollment validation/navigation. |
| International assets | Shared phone parsing and an international field exist in historical work, but are not fully wired into this public-booking target. | `lib/phone`, prior international-phone worktrees and tests. |
| Wizard | Existing form state, mapping, hook, validation, and API can be reused; no accepted wizard interaction contract exists yet. | `profile-utils.ts`, `useProfileForm.ts`, `ProfileFormCard.tsx`, `/api/profile`. |

## Root causes

### Incorrect class times

`buildSessionStartsAt` creates a JavaScript `Date` from a date-only value and applies host-local hours. The business input is a New York wall-clock slot, so a UTC runtime stores 19:00Z instead of the correct New York instant. Downstream profile formatting is behaving correctly when it shows that bad instant as 3:00 PM.

### Missing calendar events

`useAgendaCalendar` builds booked and pending event maps, but `AssignClassesCard` does not consume them in its visible calendar presentation. Its month/day calculations also use host-local date methods while labels use New York formatting.

### Stale profile branch

The prior profile-polish branch is hundreds of commits away from current `codex/develop` and includes unrelated history. Its valid UX decisions must be reconstructed as bounded changes instead of merged.

### US-only booking phone

The UI state stores only one formatted phone string and validates it with US-specific helpers. International behavior requires explicit country state, national input validation, canonical E.164 output, and safe propagation through existing verification and checkout boundaries.

## Risk assessment

- Timestamp conversion affects assignment, reschedule, public package booking, duplicate detection, and capacity keys.
- Phone changes affect identity ownership and must remain fail-closed.
- Profile composition is low-risk when restricted to imports, exclusive state, and rendering.
- Wizard work is presentation-heavy but can accidentally change completion or persistence semantics if it forks existing state.

## Test gaps

- No deterministic DST and cross-timezone tests for New York wall-clock conversion.
- No profile calendar assertion that an API booking appears on its day.
- Existing assignment-card coverage uses empty booking maps.
- No current profile-level absence assertions for the three removed sections.
- Public booking lacks all-country E.164 coverage across UI, verification, and checkout.
- Wizard step behavior is not yet specified or tested.
