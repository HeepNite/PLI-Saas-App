# Validation Plan: ProfilePageClient Remaining Slices

## Purpose

Define a focused validation matrix for the **remaining decomposition only** (sections + modals + right rail extraction), without changing behavior.

## Matrix by Remaining Slice

| Slice | Primary checks | Expected result |
|---|---|---|
| `ProfileFormCard` extraction | TypeScript + ESLint + profile E2E render/edit-profile toggle | No type/lint regressions; profile form open/close flow unchanged |
| `StudentPinCard` extraction | TypeScript + ESLint + profile E2E smoke | Same PIN panel visibility/controls in UI |
| `AnalyticsCard` extraction | TypeScript + ESLint + visual parity in profile E2E render | Same chart tabs/hover rendering behavior |
| `AgendaCard` extraction | TypeScript + ESLint + profile E2E navigation smoke | Same month nav/day badges/pending labels |
| `AssignClassesCard` extraction | TypeScript + ESLint + profile E2E booking/assign path | Same package/date/time selection and submit guards |
| `ProfileRightRail` extraction | TypeScript + ESLint + profile E2E book/change/check-in/request flows | Same action entry points and messages |
| `RescheduleModal` extraction | TypeScript + ESLint + profile E2E reschedule scenario | Same 3-step modal behavior and success/error paths |
| `ActionRequestModal` extraction | TypeScript + ESLint + profile E2E cancel/suspend scenarios | Same branch validation and request submission behavior |
| `CoursePickerModal` extraction | TypeScript + ESLint + profile E2E open picker scenario | Same preferred-first list and EnrollModal handoff |

## Commands (Validate Phase)

1. **TypeScript (targeted grep + compile)**
   - `grep -R "ProfilePageClient\|useProfileBookings\|useRescheduleFlow\|useAssignClassesFlow\|useActionRequestModal" components/front/profile`
   - `npx tsc --noEmit`
2. **Lint**
   - `npx eslint components/front/profile/`
3. **Unit/API**
   - `npx vitest run`
4. **E2E profile**
   - `node scripts/run-playwright.mjs e2e/profile.spec.ts`

## Baseline and Reporting Rules

- Baseline for this refactor is the current behavior represented by existing tests and current UI copy.
- Any failure after extraction is treated as a refactor regression unless proven pre-existing.
- Report per command as: `pass | fail | blocked` with first actionable error.

## Known Playwright Blocker (Repository-Level)

- `e2e/staff-terminal-latency.spec.ts` contains `test.fixme(...)` due to non-deterministic `/staff/terminal` server-auth setup in Playwright.
- This blocker does **not** prevent focused execution of `e2e/profile.spec.ts`, but it must be called out when interpreting full-suite E2E status.
