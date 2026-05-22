# Tasks: ProfilePageClient Refactor

## Slice 1 — Types + Constants + Formatters + Mock Data

- [ ] Create `profile-types.ts` — move all type defs from ProfilePageClient (~100 LOC)
- [ ] Create `profile-constants.ts` — move constants + config objects (~60 LOC)
- [ ] Create `profile-formatters.ts` — move 12 pure helper functions (~150 LOC)
- [ ] Create `mock-profile.ts` — move mockProfile, drop dead keys with grep evidence (~40 LOC)
- [ ] Update ProfilePageClient imports to use new modules
- [ ] Add unit tests for extracted formatters (`tests/profile-formatters.test.ts`)
- [ ] Validate: tsc + vitest + eslint

## Slice 2 — Simple Data Hooks

- [ ] Create `hooks/useProfileForm.ts` — form state + save + avatar (~200 LOC)
- [ ] Create `hooks/useProfilePackages.ts` — packages + activity stats (~80 LOC)
- [ ] Create `hooks/usePointsHistory.ts` — points + balance (~50 LOC)
- [ ] Create `hooks/useActionRequests.ts` — load + state (~40 LOC)
- [ ] Create `hooks/useStudentPinForm.ts` — PIN rotation (~100 LOC)
- [ ] Update ProfilePageClient to consume hooks
- [ ] Validate: tsc + vitest + eslint

## Slice 3 — Complex Hooks + DOM Hooks

- [ ] Create `hooks/useAvailabilityCache.ts` — shared cache (~50 LOC)
- [ ] Create `hooks/useStickyRails.ts` — scroll/resize observer (~90 LOC)
- [ ] Create `hooks/useFloatingFooterOffset.ts` — CSS var (~20 LOC)
- [ ] Create `hooks/useBookings.ts` — bookings + check-in (~80 LOC)
- [ ] Create `hooks/useRescheduleFlow.ts` — 3-step machine (~200 LOC)
- [ ] Create `hooks/useAssignClassesFlow.ts` — assign flow (~150 LOC)
- [ ] Create `hooks/useActionRequestModal.ts` — suspend/cancel (~150 LOC)
- [ ] Create `hooks/useAgendaCalendar.ts` — calendar derivations (~120 LOC)
- [ ] Create `hooks/useAnalyticsChartData.ts` — chart math (~120 LOC)
- [ ] Update ProfilePageClient to consume hooks
- [ ] Validate: tsc + vitest + eslint

## Slice 4 — Presentational Components

- [ ] Create `sections/` directory with card components
- [ ] Create `modals/` directory with modal components
- [ ] Extract each GlassyCard block into its own component
- [ ] Extract each modal into its own component
- [ ] Update ProfilePageClient JSX to compose sections + modals
- [ ] Validate: tsc + vitest + eslint + Playwright E2E

## Slice 5 — Consolidation + Dead Code + Final Audit

- [ ] Verify ProfilePageClient is thin orchestrator (<300 LOC)
- [ ] Audit: no file >800 LOC
- [ ] Dead code removal with evidence (grep + lint)
- [ ] Run full Playwright E2E suite
- [ ] Run full Vitest suite
- [ ] Final tsc --noEmit
- [ ] Final eslint on all changed files
