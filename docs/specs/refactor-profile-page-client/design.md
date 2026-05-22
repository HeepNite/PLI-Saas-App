# Design: ProfilePageClient Refactor

## Target Structure

```
components/front/profile/
  ProfilePageClient.tsx          # Thin orchestrator (~250 LOC)
  profile-types.ts               # All type definitions (~100 LOC)
  profile-constants.ts           # Constants + config objects (~60 LOC)
  profile-formatters.ts          # Pure helper functions (~150 LOC)
  mock-profile.ts                # Mock/demo data (~40 LOC)
  profile-utils.ts               # Existing — keep as-is
  hooks/
    useProfileForm.ts            # Form state + save + avatar (~200 LOC)
    useProfilePackages.ts        # Packages + activity stats (~80 LOC)
    usePointsHistory.ts          # Points balance + entries (~50 LOC)
    useActionRequests.ts         # Load + state (~40 LOC)
    useStudentPinForm.ts         # PIN state + submit (~100 LOC)
    useStickyRails.ts            # DOM scroll/resize (~90 LOC)
    useFloatingFooterOffset.ts   # CSS var sync (~20 LOC)
    useAvailabilityCache.ts      # Shared cache (~50 LOC)
    useBookings.ts               # Bookings + check-in (~80 LOC)
    useRescheduleFlow.ts         # 3-step modal machine (~200 LOC)
    useAssignClassesFlow.ts      # Assign-to-package flow (~150 LOC)
    useActionRequestModal.ts     # Suspend/cancel modal (~150 LOC)
    useAgendaCalendar.ts         # Calendar derived values (~120 LOC)
    useAnalyticsChartData.ts     # Chart math + hover (~120 LOC)
  sections/
    ProfileLeftRail.tsx          # Identity + activity + packages
    ProfileFormCard.tsx          # Name/contact/emergency/billing form
    StudentPinCard.tsx           # PIN management card
    AnalyticsCard.tsx            # Metric tabs + SVG chart + donut
    AgendaCard.tsx               # Month nav + calendar + mobile popup
    AssignClassesCard.tsx        # Package picker + slot grid
    ProfileRightRail.tsx         # Book/change/checkin/suspend/cancel
    MedalsCard.tsx               # Medals display
    PliCoinsCard.tsx             # Coins progress
    PointsHistoryCard.tsx        # Points entries list
    GearCard.tsx                 # Shoe tracking
    StudentMomentsCard.tsx       # Photo gallery
  modals/
    RescheduleModal.tsx          # 3-step reschedule flow
    ActionRequestModal.tsx       # Suspend/cancel union form
    CoursePickerModal.tsx        # Course selection grid
```

## Extraction Principles

1. **Types first** — move to `profile-types.ts`, re-export from there.
2. **Pure functions** — no state deps, testable in isolation.
3. **Hooks by domain** — each hook owns its state + effects + handlers. Returns a typed interface.
4. **Components by card** — each `<GlassyCard>` block becomes a component receiving hook output as props.
5. **No prop-drilling chains** — if a hook's output goes to exactly one component, pass directly. If shared, lift to orchestrator.

## Cross-Cutting Concerns

- `useAvailabilityCache` is shared between `useRescheduleFlow` and `useAssignClassesFlow` — extract first, inject via params.
- `loadPointsHistory` is called from `useProfileForm` after save — pass as callback param.
- `loadBookings` refresh is needed by both reschedule and assign flows — pass as callback.
- `canLoadProtectedData` derived from `clerkUser` + `e2eAuthBypass` — compute in orchestrator, pass to hooks.

## Validation Strategy

After each slice:
1. `npx tsc --noEmit` — no new type errors
2. `npx vitest run` — all tests pass
3. `npx eslint components/front/profile/` — no new warnings
4. Visual: dev server renders profile page identically
