# Course toggle data wipe (hotfix)

## Problem
`toggleCourseActive` (components/front/staff/useStaffCoursesCRUD.ts) POSTed `{ slug, title, kind, active }`
to `/api/staff/school/courses`. The POST handler treated every request as a full save and its upsert
`update` overwrote every absent field with `null` / `[]` / `JsonNull`.

## Evidence (production)
- `salsa-timba-in-new-york-2`: activated 2026-10-23T17:09Z; description, cover, video, prices, level,
  duration, location, room, weekdays, times and scheduleRules wiped.
- `salsa-timba-in-new-york`: wiped the same way on 2026-10-07.

## Fix
- [x] Server: existing courses update only keys present in the body (`Object.hasOwn`); create unchanged.
- [x] Server: title required on create; an explicitly blank title on update is rejected.
- [x] Server: room conflict checks use the effective merged row (stored values for absent keys), and also
      run when activating a course that keeps its stored room (no room re-validation, no false 404).
- [x] Client: toggle sends only `{ slug, active }`.
- No activation prerequisites (required prices/schedule) exist in the route, so none were added.

Commit: 6d53a0c9 (branch `hotfix/course-toggle-data-wipe`).

## Tests
- tests/api/staff-school.test.ts: toggle updates only `active`; legacy toggle shape cannot wipe; full form
  save still writes every field; blank title rejected; create requires title; activation 409 on stored-room
  conflict; deactivation skips conflict checks.
- components/front/staff/__tests__/useStaffCoursesAdmin.test.tsx: toggle body is exactly `{ slug, active }`.
- RED observed as assertion failures before the fix; GREEN after.

## Affected rows / next step
- `salsa-timba-in-new-york-2`, `salsa-timba-in-new-york`: data restore pending owner decision
  (backup/PITR or manual re-entry). No DB or production change made by this hotfix.
