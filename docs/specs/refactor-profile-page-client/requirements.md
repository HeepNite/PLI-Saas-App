# Refactor: ProfilePageClient.tsx

## Goal

Continue a behavior-preserving decomposition of `components/front/profile/ProfilePageClient.tsx` (current: **2125 LOC**) so the file becomes an orchestration layer and UI logic is moved into cohesive profile-scoped modules.

## Scope and Invariants (Non-Negotiable)

- **Behavior-preserving only**: no functional product change.
- **UI copy invariant**: no text/content rewrites; only move existing UI into extracted components.
- **No contract changes**: no endpoint additions/removals, no request/response schema changes, no auth/authorization/security changes.
- **No staff scope touches**: do not modify `components/front/staff/**`, `app/api/staff/**`, `docs/specs/batch-staff-admin-refactor/**`.
- **Profile-only refactor**: keep changes localized to `components/front/profile/**` and its spec artifacts.

## Current State (Post Previous Slices)

| Area | Status |
|---|---|
| Core profile modules extracted | ✅ `profile-types.ts`, `profile-constants.ts`, `profile-formatters.ts`, `mock-profile.ts` |
| Data/flow hooks extracted | ✅ `useProfileForm`, `useProfilePackages`, `usePointsHistory`, `useActionRequests`, `useStudentPinForm`, `useProfileBookings`, `useRescheduleFlow`, `useAssignClassesFlow`, `useActionRequestModal`, `useAgendaCalendar`, `useAnalyticsChartData`, sticky/footer/cache hooks |
| Presentational cards extracted | ✅ `ProfileLeftRail`, `StudentMomentsCard`, `PliCoinsCard`, `PointsHistoryCard`, `MedalsCard`, `GearCard` |
| Remaining in `ProfilePageClient.tsx` | ❗ Profile form card, Student PIN card, Analytics card, Agenda card, Assign Classes card, full right rail, and modals |

## Remaining Acceptance Criteria

1. Extract remaining center cards into `components/front/profile/sections/`:
   - `ProfileFormCard.tsx`
   - `StudentPinCard.tsx`
   - `AnalyticsCard.tsx`
   - `AgendaCard.tsx`
   - `AssignClassesCard.tsx`
2. Extract right rail into `components/front/profile/sections/ProfileRightRail.tsx` (book/change/check-in/suspend-cancel/recent requests).
3. Extract modal blocks into `components/front/profile/modals/`:
   - `RescheduleModal.tsx`
   - `ActionRequestModal.tsx`
   - `CoursePickerModal.tsx`
4. Preserve state ownership already established in hooks; extracted components remain presentational/composition-oriented.
5. No new profile behavior, copy, endpoint, schema, or security changes introduced by extraction.
6. Final structure keeps `ProfilePageClient.tsx` as thin orchestrator target (practical target: ~250–400 LOC after all remaining slices).
7. Validation commands (to be run in validate phase, not spec phase):
   - `npx tsc --noEmit`
   - `npx eslint components/front/profile/`
   - `npx vitest run`
   - `node scripts/run-playwright.mjs e2e/profile.spec.ts`
