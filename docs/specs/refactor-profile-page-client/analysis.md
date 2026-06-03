# Analysis: ProfilePageClient Remaining Decomposition

## Snapshot

- Active file: `components/front/profile/ProfilePageClient.tsx` (**2125 LOC**).
- Existing decomposition is real and in use (types/constants/formatters/mock, hooks, simple cards, left rail).
- Remaining work is concentrated in large JSX blocks and three modal trees still embedded in the page component.

## Extracted vs Remaining Map

### Already extracted

- Foundation modules:
  - `profile-types.ts`, `profile-constants.ts`, `profile-formatters.ts`, `mock-profile.ts`, `profile-utils.ts`
- Hooks:
  - `hooks/useProfileForm.ts`
  - `hooks/useProfilePackages.ts`
  - `hooks/usePointsHistory.ts`
  - `hooks/useActionRequests.ts`
  - `hooks/useStudentPinForm.ts`
  - `hooks/useStickyRails.ts`
  - `hooks/useFloatingFooterOffset.ts`
  - `hooks/useAvailabilityCache.ts`
  - `hooks/useProfileBookings.ts`
  - `hooks/useRescheduleFlow.ts`
  - `hooks/useAssignClassesFlow.ts`
  - `hooks/useActionRequestModal.ts`
  - `hooks/useAgendaCalendar.ts`
  - `hooks/useAnalyticsChartData.ts`
- Sections:
  - `sections/ProfileLeftRail.tsx`
  - `sections/StudentMomentsCard.tsx`
  - `sections/PliCoinsCard.tsx`
  - `sections/PointsHistoryCard.tsx`
  - `sections/MedalsCard.tsx`
  - `sections/GearCard.tsx`

### Remaining inside `ProfilePageClient.tsx`

- Center rail cards:
  - Profile form card (`GlassyCard`, lines ~435–618)
  - Student PIN card (lines ~622–725)
  - Analytics card (lines ~729–990)
  - Agenda card (starts line ~1009)
  - Assign classes card (starts line ~1233)
- Right rail:
  - Book / Change / Check-in / Suspend-Cancel / Recent requests (lines ~1442–1589)
- Modal trees:
  - Reschedule modal (`changeModalOpen`, lines ~1594–1876)
  - Action request modal (`requestModalType`, lines ~1878–2044)
  - Course picker modal (`coursePickerOpen`, lines ~2046–2111)

## Dependency Map (Remaining Blocks)

### ProfileFormCard
- Depends on: `useProfileForm`, `usePointsHistory` output, Clerk `user` read-only fields.
- Side effects: `handleProfileSave`, `setProfileForm`, `setShowProfileForm`.

### StudentPinCard
- Depends on: `useStudentPinStatus` + `useStudentPinForm` state/handlers.
- Side effects: `submitStudentPin`, local PIN field mutations, recovery toggles.

### AnalyticsCard
- Depends on: `useAnalyticsChartData`, `useProfilePackages.activityStats`, `analyticsMetricConfig`.
- Side effects: hover/tabs local state dispatch (`setActiveMetric`, `setHoverPoint`).

### AgendaCard
- Depends on: `useAgendaCalendar` output + formatter/tone helpers.
- Side effects: month/year/day toggles only (already owned in orchestrator/hook).

### AssignClassesCard
- Depends on: `useAssignClassesFlow`, `useProfileBookings.assignablePackages`, selected package/course derived state.
- Side effects: add/remove slot, submit assign request.

### ProfileRightRail
- Depends on: booking/action-request slices, check-in state, request modal openers, course picker opener.
- Side effects: opens modals, submits check-in.

### RescheduleModal
- Depends on: `useRescheduleFlow`, selected booking state, booking collections, course catalog map.
- Side effects: step transitions, reschedule submit, optional scroll-to-assign section.

### ActionRequestModal
- Depends on: `useActionRequestModal`, visible bookings, suspendable package list.
- Side effects: request submission; in cancel+reassign branch can trigger change-class flow.

### CoursePickerModal
- Depends on: ordered course list, preferred set, enroll state setters.
- Side effects: select course and open existing `EnrollModal`.

## Validation Baseline (Current)

- Test surfaces already present:
  - Vitest API/unit: profile endpoints and utils are covered (`tests/api/profile*.test.ts`, `tests/profile-utils.test.ts`).
  - Playwright profile flow: `e2e/profile.spec.ts` (371 LOC) with route-based API mocks.
- Previous slices in `tasks.md` indicate local validation loops were already executed through complex hooks extraction.
- This spec phase does **not** execute tests; baseline here is documentary/inventory only.

## Known Playwright Blocker

- Repository-level blocker (not specific to profile) exists in `e2e/staff-terminal-latency.spec.ts`:
  - test is marked `test.fixme(...)` because deterministic `/staff/terminal` server-auth setup is currently not reliably achievable in Playwright.
  - Reason text is embedded in-file (`unsupportedAuthFixtureReason`) and should be treated as an existing E2E environment limitation during global suite interpretation.
