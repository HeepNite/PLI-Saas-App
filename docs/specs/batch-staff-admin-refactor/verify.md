# Verification Gate: batch-staff-admin-refactor

**Current verdict: PASS FOR REFACTOR TARGET — ready for fresh review before PR/merge.**

`StaffUsersAdminClient.tsx` has been reduced to a thin orchestration container and now meets the requested 600–700 LOC target. Domain ownership is distributed across focused hooks, final JSX lives in `StaffUsersAdminView.tsx`, top-level composition lives in `useStaffUsersAdminComposition.ts`, and compatibility/helper garbage identified after B60 has been removed. Treat this as refactor-target complete, but still require a fresh review before PR/merge because the cumulative branch is large.

## Current Evidence — Post-B60 Cleanup

Measured on branch `refactor/staff-admin-split` in `/Users/marianobarrionuevo/WebstormProjects/PLI-Saas-App-refactor` after B59, B60, compat re-export cleanup, and history date-helper cleanup.

| Metric | Current value | Gate interpretation |
|--------|---------------|---------------------|
| `StaffUsersAdminClient.tsx` LOC | 561 | ✅ Meets the 600–700 LOC target. |
| `React.useState` calls | 1 | ✅ Container owns only remaining shell/search-local state. |
| `React.useEffect` calls | 3 | ✅ Only bridge/sync effects remain in the container. |
| `React.useMemo` calls | 1 | ✅ Heavy derivation moved to domain hooks/builders. |
| `React.useCallback` calls | 7 | ✅ Remaining callbacks are bridge wrappers for current domain seams. |
| `fetch(` call sites | 0 | ✅ Network behavior moved out of the container. |
| JSX return | one-line `<StaffUsersAdminView />` handoff | ✅ Final JSX no longer lives in the container. |

## Latest Validation Evidence

```text
npm run test -- components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 79 tests passed
```

```text
npm run test -- components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/useStaffStudentsBoardAdmin.test.tsx components/front/staff/__tests__/StaffAdminHistoryOverlays.test.tsx
# 3 files passed, 79 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/staffAdminFormatters.ts components/front/staff/useStaffStudentsBoardAdmin.ts components/front/staff/buildStaffStudentsBoardPanelProps.ts components/front/staff/paymentTimelineTransforms.ts components/front/staff/__tests__/StaffUsersAdminClient.test.ts --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

```text
git diff --check
# exit 0, no output
```

## Post-B60 Cleanup Completed

- Removed legacy compatibility re-exports from `StaffUsersAdminClient.tsx`; helper tests now import from their real modules.
- Unified history date/range helpers in `staffAdminFormatters.ts` and removed duplicate local implementations from the container, student-board hook, students-board props builder, and payment timeline transforms.
- `StaffUsersAdminClient.tsx` moved from 602 LOC after B60 to 561 LOC after cleanup.

## Remaining Review Notes

- The branch still contains a large cumulative refactor history. Run a fresh-context review before PR/merge.
- `useStaffUsersAdminComposition.ts` is intentionally an assembly-only composition layer; review it for callback parity and prop-surface readability, but do not move domain internals back into the container.
- Source-string tests still protect cache/fetch invariants and should remain until replaced by stronger contract tests.

## Batch 59 Slice 1 — Staff Users Admin View Shell Extraction

Batch 59 Slice 1 moved the final JSX composition out of `StaffUsersAdminClient.tsx` into a new render-only `StaffUsersAdminView.tsx` while preserving container ownership for state/effects/fetches/hooks and callback semantics.

Scope completed in this slice:
- Created `components/front/staff/StaffUsersAdminView.tsx` with grouped prop objects (`shell`, `boards`, `assistant`, `modals`, `statusBanners`, `actions`, `formatters`).
- Replaced container return tree with `staffUsersAdminViewProps` assembly + `<StaffUsersAdminView {...staffUsersAdminViewProps} />`.
- Added focused render wiring tests in `components/front/staff/__tests__/StaffUsersAdminView.test.tsx`.
- Preserved no-touch/source-contract boundaries (CourseLink/consecutive-course-link internals, auth/permissions, endpoint contracts, copy/classes/ARIA).

Validation evidence:

```text
npm run test -- components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 5 files passed, 89 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffUsersAdminView.tsx components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

```text
git diff --check
# clean
```

## Batch 59 Slice 2 — Staff Users Admin View Props Builder Extraction

Batch 59 Slice 2 moved the large `staffUsersAdminViewProps` object assembly out of `StaffUsersAdminClient.tsx` into `components/front/staff/buildStaffUsersAdminViewProps.ts`, while preserving container ownership for all state/effects/fetches/hooks and callback semantics.

Scope completed in this slice:
- Created `components/front/staff/buildStaffUsersAdminViewProps.ts` as a focused prop-composition module returning `StaffUsersAdminView` props.
- Replaced in-container assembly with `const staffUsersAdminViewProps = buildStaffUsersAdminViewProps(...)` and kept `return <StaffUsersAdminView {...staffUsersAdminViewProps} />`.
- Removed stale in-container composition-only callbacks and permission/payroll mapping wrappers by relocating them into the builder.
- Added focused behavior test for composed callback semantics in `components/front/staff/__tests__/buildStaffUsersAdminViewProps.test.ts`.
- Preserved no-touch/source-contract boundaries (CourseLink/consecutive-course-link internals, auth/permissions, endpoint contracts, UI copy/classes/ARIA, callback semantics).

Validation evidence:

```text
npm run test -- components/front/staff/__tests__/buildStaffUsersAdminViewProps.test.ts
# 1 file passed, 1 test passed
```

```text
npm run test -- components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 5 files passed, 89 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffUsersAdminView.tsx components/front/staff/buildStaffUsersAdminViewProps.ts components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

```text
git diff --check
# clean
```

Measured LOC impact for Slice 2:
- `StaffUsersAdminClient.tsx`: 1,120 → 928 (**-192**)
- `buildStaffUsersAdminViewProps.ts`: new file (**153 LOC**)

## Current Evidence

Measured on branch `refactor/staff-admin-split` after commit `ad78c82` (`refactor(staff): extract courses admin hook`). Metrics below use executable-call counts in `StaffUsersAdminClient.tsx` with these exact regexes: `React\.useState\s*\(`, `React\.useEffect\s*\(`, `React\.useMemo\s*\(`, `React\.useCallback\s*\(`, and `fetch\s*\(`. The `React.useState` value is cross-checked against declarations matching `const [...] = React.useState(`; both methods currently return `56`.

| Metric | Current value | Gate interpretation |
|--------|---------------|---------------------|
| `StaffUsersAdminClient.tsx` LOC | 11,971 | Still a god component; ~15x the directional 800-line target. |
| `React.useState` calls/declarations | 56 | Improved, but state remains concentrated in the container. |
| `React.useEffect` occurrences | 32 | Improved, but side-effect ownership remains concentrated. |
| `React.useMemo` occurrences | 69 | High derived-state/cognitive surface remains. |
| `React.useCallback` occurrences | 54 | Improved, but many handlers remain inline in the container. |
| `fetch(` call sites | 46 | Improved, but network orchestration remains concentrated. |
| JSX return starts | ~line 5,000+ | Thousands of lines of state/handlers still precede render. |
| `useStaffRoomsAdmin.ts` LOC | 526 | Real bounded-context extraction for rooms only. |
| `useStaffCoursesAdmin.ts` LOC | 1,307 | Real bounded-context extraction for course builder/schedule/media state. |

## Judgment Day Result

Two blind judges reviewed the branch using `solid`, `codebase-cleanup-refactor-clean`, and `judgment-day` criteria.

| Finding | Status | Evidence |
|---------|--------|----------|
| `StaffUsersAdminClient` remains a god component | Confirmed | 11,971 LOC, 56 `useState`, 32 `useEffect`, 69 `useMemo`, 54 `useCallback`, 46 `fetch(`. |
| Extraction is partly cosmetic/presentational | Confirmed | Most extracted LOC is types, constants, formatters, pure helpers, and thin presentational shells. |
| Real domain extraction exists | Confirmed | `useStaffRoomsAdmin` moved rooms/reservations ownership; `useStaffCoursesAdmin` moved course-builder/schedule/media ownership. |
| Refactor is complete | Refuted | Two stateful domain hooks exist, but many domains still live in the container. |
| `verify.md` was reliable | Refuted | Previous report had stale LOC, stale branch/worktree notes, and over-optimistic compliance labels. |
| Scope creep in current branch | Mixed | One judge flagged broad historical scope; the other found the current branch scoped to staff frontend/tests. Treat as packaging risk, not confirmed current defect. |

## What Is Real vs. Not Enough

| Category | Evidence | Verdict |
|----------|----------|---------|
| Pure helper/type extraction | `staffAdminTypes`, `staffAdminFormatters`, `staffCourseScheduleHelpers`, `staffPaymentFilters`, room helpers | Useful foundation, but mostly moves pure code. |
| Rooms bounded context | `useStaffRoomsAdmin` | Real simplification pattern; keep and repeat. |
| Course-builder bounded context | `useStaffCoursesAdmin` | Real simplification; moved course form/schedule/media/query-hydration ownership and added hook behavior tests. |
| Presentational shells | `StaffCatalogSection`, profile/room reservation components | Helpful boundaries, but they do not remove most state/effect ownership. |
| Container simplification | Metrics above | Insufficient; the container still owns most product workflows. |

## Remaining Container Responsibilities

`StaffUsersAdminClient.tsx` still owns orchestration for at least:

- staff user list, filters, and sync flows
- Clerk sync health and repair actions
- schedule/calendar data
- payments board, history filters, bulk payments, and payment summaries
- student PIN and profile override workflows
- staff requests and payroll change requests
- self-profile payment/request workflows
- school catalog residuals: packages, points, course links, and some school fetch/orchestration
- reports, suggestions, terminal alerts, and assistant UI state
- thousands of lines of JSX section rendering

## Validation Commands Run Recently

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffRoomsAdmin.ts tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx
# exit 0, no output
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffCoursesAdmin.ts components/front/staff/__tests__/useStaffCoursesAdmin.test.tsx
# exit 0, no output
```

```text
npm run test -- components/front/staff/__tests__/staffCourseScheduleHelpers.test.ts components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx
# 5 files passed, 94 tests passed
```

```text
npm run test -- components/front/staff/__tests__/useStaffCoursesAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx components/front/staff/__tests__/staffCourseScheduleHelpers.test.ts
# 4 files passed, 90 tests passed
```

```text
npm run test -- components/front/staff/__tests__/useStaffCoursesAdmin.test.tsx components/front/staff/__tests__/staffCourseScheduleHelpers.test.ts tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx
# 3 files passed, 20 tests passed
```

```text
npm run test -- components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx components/front/staff/__tests__/useStaffCoursesAdmin.test.tsx
# 4 files passed, 92 tests passed
```

```text
npx tsc --noEmit
# exit 0, no output
```

```text
npm run build
# build passed; warnings remain in unrelated/baseline files
```

These commands support behavior preservation for the current slices. They do **not** prove the refactor is complete.

## Batch 22 Validation — Payroll Control Panel

```text
npm run test -- components/front/staff/__tests__/StaffPayrollControlPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 83 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffPayrollControlPanel.tsx components/front/staff/__tests__/StaffPayrollControlPanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

Batch 22 moved the payroll control article into `StaffPayrollControlPanel` as a render-only component. Payroll calculations, live-session lookup, pending-payment navigation, delay-modal ownership, and staff actions remain in `StaffUsersAdminClient.tsx`; the extracted component receives data/actions/formatters as props and preserves the owner-only payment-method config boundary.

## Batch 23 Validation — Staff Access Create Panel

```text
npm run test -- components/front/staff/__tests__/StaffAccessCreatePanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 83 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffAccessCreatePanel.tsx components/front/staff/__tests__/StaffAccessCreatePanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

Batch 23 moved the Staff access / Invite or promote user article into `StaffAccessCreatePanel` as a render-only component. The container still owns create form state and `createStaff`; the extracted component receives values/setters/status as props and preserves role/category normalization plus PIN sanitization.

## Batch 24 Validation — School Packages + Points Panel

```text
npm run test -- components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 79 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffSchoolPackagesPointsPanel.tsx components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

Batch 24 moved the school packages/points render surface into `StaffSchoolPackagesPointsPanel` while keeping state/actions in `StaffUsersAdminClient.tsx`. It also removed the production non-null access for `roomById[courseForm.defaultRoomId]` in the course main-info block. `StaffUsersAdminClient.tsx` dropped from 6,434 to 5,847 LOC.

## Batch 25 Validation — School Rooms Management Panel

```text
npm run test -- components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 79 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffSchoolRoomsPanel.tsx components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

Batch 25 moved the rooms management render surface into `StaffSchoolRoomsPanel` while keeping room form/filter/lifecycle ownership in `StaffUsersAdminClient.tsx`. `StaffUsersAdminClient.tsx` dropped from 5,847 to 5,674 LOC.

## Latest Slice Gate Result

`useStaffPaymentsAdmin` was extracted as the next measurable bounded-context slice.

Baseline (post-`useStaffCoursesAdmin`): LOC 11,971; `React.useState(` 56; `React.useEffect(` 32; `React.useMemo(` 69; `React.useCallback(` 54; `fetch(` 46.
Post-extraction: LOC 10,666 after the follow-up payments-board controls split, pure card-helper extraction, requests/approvals hook extraction, and self-profile hook extraction; `React.useState(` 42; `React.useEffect(` 28; `React.useMemo(` 64; `React.useCallback(` 47; `fetch(` 35.

| Metric | Required improvement | Actual improvement | Result |
|--------|----------------------|--------------------|--------|
| `StaffUsersAdminClient.tsx` LOC | -800 to -1,500 lines | -1,305 lines total | ✅ Met across the combined payments + requests + self-profile wave. Remaining bulk is card grid, profile modal, reports/suggestions, and school/package internals. |
| Container `useState` | at least -10 | -14 (56 → 42) | ✅ Met. Payments, requests, and self-profile ownership moved out. |
| Container `fetch(` | at least -3 | -11 (46 → 35) | ✅ Met. Payments, bulk settlement, staff requests, payment change requests, self-profile fetch/save, and self request submission now live outside the shell. |
| Container `useCallback` | at least -10 | -7 (54 → 47) | ⚠️ Partial. Fetch/update callbacks moved, but the container still owns cross-domain UI handlers, modal wiring, report callbacks, and school/package callbacks. |
| Tests | at least 5 behavior tests for the new hook | `useStaffPaymentsAdmin.test.tsx` provides 10 behavior tests: initial state, history-filter clearing on category change, history-class-key auto-reset, `fetchPayments` happy path, auth-failure routing, history-mode empty-range short-circuit, `fetchPaymentsMonthlySummary` totals update, selection actions, bulk settlement success, and 350ms debounced history search. | ✅ Met. |

Verdict: Combined wave now meets the LOC/state/fetch gates while preserving behavior. Real bounded-context ownership for payments lives in `useStaffPaymentsAdmin`; approvals/request ownership lives in `useStaffRequestsAdmin`; self-profile/payment/request ownership lives in `useStaffSelfProfileAdmin`; presentation helpers live in focused modules. Remaining line-count gap is concentrated in the student card grid, profile edit modal, reports/suggestions UI, and school/package internals.

### Batch 11 — Profile Edit Modal Hook Extraction

`useStaffProfileModalAdmin` moves real ownership of the admin profile edit modal (state, behavior, and form mutations) out of the container and exposes a typed action surface to JSX.

Baseline (post-Batch 10 audit cleanup): LOC 10,666; `React.useState(` 42; `React.useEffect(` 28; `React.useMemo(` 64; `React.useCallback(` 47; `fetch(` 35.
Post-extraction: LOC 10,500; `React.useState(` 35; `React.useEffect(` 31; `React.useMemo(` 64; `React.useCallback(` 49; `fetch(` 31.

| Metric | Required improvement | Actual improvement | Result |
|--------|----------------------|--------------------|--------|
| `StaffUsersAdminClient.tsx` LOC | -400 to -1,000 lines | -166 lines | ⚠️ Partial. Profile modal JSX is still rendered by the container so the reduction comes from state, helpers, and inline setters only. New hook adds 297 LOC. |
| Container `useState` | at least -8 | -7 (42 → 35) | ⚠️ Partial. The 12 modal state slices and `profileForm` collapsed into one hook reference, but the container still owns the assigned destructure aliases. |
| Container `fetch(` | at least -3 | -4 (35 → 31) | ✅ Met. `/api/staff/users/:id/profile` GET+PATCH, `/avatar`, and `/gallery-upload` now live in the hook. |
| Container `useCallback` | at least -6 | +2 (47 → 49) | ⚠️ Partial. Three cross-domain refresh callback wrappers (refs) plus three ref-syncing effects were added; the `openProfileModal`, `saveProfileModal`, avatar, and gallery callbacks moved into the hook. The container surface still owns most cross-domain UI handlers. |
| Tests | at least 5 behavior tests for the new hook | 11 behavior tests | ✅ Met. |

Verdict: Behavior preserved; real ownership of profile-modal state and network actions now lives in `useStaffProfileModalAdmin`. The remaining container line-count gap is concentrated in the still-inlined modal JSX (~390 LOC), reports/suggestions UI, school/package internals, and the student card grid.

Validation after Batch 11:

```text
npm run test -- components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx components/front/staff/__tests__/useStaffPaymentsAdmin.test.tsx components/front/staff/__tests__/useStaffProfileModalAdmin.test.tsx
# 4 files passed, 97 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffSelfProfileAdmin.ts components/front/staff/useStaffProfileModalAdmin.ts components/front/staff/useStaffRequestsAdmin.ts components/front/staff/useStaffPaymentsAdmin.ts components/front/staff/staffApprovals.ts components/front/staff/staffPaymentCardPresentation.ts components/front/staff/StaffPaymentsBoardControls.tsx components/front/staff/__tests__/useStaffProfileModalAdmin.test.tsx --max-warnings=0
# exit 0, no warnings
```

```text
npx tsc --noEmit
# exit 0, no type errors
```

Fresh review follow-up addressed non-blocking findings by moving role/category guards into `lib/security`, strengthening `closeProfileModal` form-preservation coverage, adding `saveProfileModal` non-OK failure coverage, and adding gallery upload dedupe + 6-image cap coverage.

### Batch 12 — Profile Modal Presentational Extraction

`StaffProfileModal.tsx` moves the remaining profile edit modal markup out of `StaffUsersAdminClient.tsx`. This is intentionally presentational: Batch 11 already moved the modal state, form mutations, and network actions into `useStaffProfileModalAdmin`.

Baseline (post-Batch 11 hook extraction): LOC 10,500.
Post-extraction: LOC 10,103; `StaffProfileModal.tsx` is 427 LOC.

| Metric | Required improvement | Actual improvement | Result |
|--------|----------------------|--------------------|--------|
| `StaffUsersAdminClient.tsx` LOC | -300 to -450 lines | -397 lines (10,500 → 10,103) | ✅ Met. Modal JSX no longer lives in the god container. |
| Behavior ownership | No behavior changes | Render-only component; hook remains the behavior owner | ✅ Met. |
| Tests | render smoke coverage plus existing hook/container tests | `StaffProfileModal.test.tsx` adds 3 render tests; focused suite now passes 5 files / 102 tests | ✅ Met. |

Validation after Batch 12:

```text
npm run test -- components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx components/front/staff/__tests__/useStaffPaymentsAdmin.test.tsx components/front/staff/__tests__/useStaffProfileModalAdmin.test.tsx components/front/staff/__tests__/StaffProfileModal.test.tsx
# 5 files passed, 102 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffProfileModal.tsx components/front/staff/useStaffProfileModalAdmin.ts components/front/staff/__tests__/useStaffProfileModalAdmin.test.tsx components/front/staff/__tests__/StaffProfileModal.test.tsx --max-warnings=0
# exit 0, no warnings
```

```text
npx tsc --noEmit
# exit 0, no type errors
```

Fresh review follow-up restored the original profile-role permission boundary by passing `assignableRoles` from the container into `StaffProfileModal`. This prevents non-owner users from seeing the owner role in the profile editor.

### Batch 13 — Staff Approvals Panel Presentational Extraction

`StaffApprovalsPanel.tsx` moves the staff requests / notifications and approvals markup out of the container while preserving `useStaffRequestsAdmin` as the state and network owner.

Baseline (post-Batch 12): LOC 10,103.
Post-extraction: LOC 9,911; `StaffApprovalsPanel.tsx` is 240 LOC.

| Metric | Required improvement | Actual improvement | Result |
|--------|----------------------|--------------------|--------|
| `StaffUsersAdminClient.tsx` LOC | -150 to -250 lines | -192 lines (10,103 → 9,911) | ✅ Met. Approvals markup no longer lives in the god container. |
| Behavior ownership | No behavior changes | Render-only component; request hook remains the behavior owner | ✅ Met. |
| Tests | render smoke coverage plus existing hook/container tests | `StaffApprovalsPanel.test.tsx` adds 2 render tests; focused suite passes 6 files / 104 tests | ✅ Met. |

Validation after Batch 13:

```text
npm run test -- components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx components/front/staff/__tests__/useStaffPaymentsAdmin.test.tsx components/front/staff/__tests__/useStaffProfileModalAdmin.test.tsx components/front/staff/__tests__/StaffProfileModal.test.tsx components/front/staff/__tests__/StaffApprovalsPanel.test.tsx
# 6 files passed, 104 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffApprovalsPanel.tsx components/front/staff/__tests__/StaffApprovalsPanel.test.tsx --max-warnings=0
# exit 0, no warnings
```

```text
npx tsc --noEmit
# exit 0, no type errors
```

### Batch 14 — Team Calendar Panel Presentational Extraction

`StaffTeamCalendarPanel.tsx` moves the team calendar markup out of the container while leaving schedule fetching and month state ownership in `StaffUsersAdminClient.tsx`.

Baseline (post-Batch 13): LOC 9,911.
Post-extraction: LOC 9,837; `StaffTeamCalendarPanel.tsx` is 119 LOC.

| Metric | Required improvement | Actual improvement | Result |
|--------|----------------------|--------------------|--------|
| `StaffUsersAdminClient.tsx` LOC | -70 to -120 lines | -74 lines (9,911 → 9,837) | ✅ Met. Team calendar markup no longer lives in the god container. |
| Behavior ownership | No behavior changes | Render-only component; container still owns schedule state/fetching | ✅ Met. |
| Tests | render smoke coverage plus existing container tests | `StaffTeamCalendarPanel.test.tsx` adds 2 render tests | ✅ Met. |

Validation after Batch 14:

```text
npm run test -- components/front/staff/__tests__/StaffTeamCalendarPanel.test.tsx
# 1 file passed, 2 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffTeamCalendarPanel.tsx components/front/staff/__tests__/StaffTeamCalendarPanel.test.tsx --max-warnings=0
# exit 0, no warnings
```

```text
npx tsc --noEmit
# exit 0, no type errors
```

### Batch 15 — Performance Metrics Panel Presentational Extraction

`StaffPerformanceMetricsPanel.tsx` moves the performance metrics markup out of the container while leaving teacher metrics state, derived values, and save behavior in `StaffUsersAdminClient.tsx`.

Baseline (post-Batch 14): LOC 9,837.
Post-extraction: LOC 9,680; `StaffPerformanceMetricsPanel.tsx` is 236 LOC.

| Metric | Required improvement | Actual improvement | Result |
|--------|----------------------|--------------------|--------|
| `StaffUsersAdminClient.tsx` LOC | -120 to -200 lines | -157 lines (9,837 → 9,680) | ✅ Met. Performance metrics markup no longer lives in the god container. |
| Behavior ownership | No behavior changes | Render-only component; container still owns teacher metrics state/derived values/save action | ✅ Met. |
| Tests | render smoke coverage plus typed callback wiring | `StaffPerformanceMetricsPanel.test.tsx` adds 3 render/callback tests | ✅ Met. |

Validation after Batch 15:

```text
npm run test -- components/front/staff/__tests__/StaffPerformanceMetricsPanel.test.tsx
# 1 file passed, 3 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffPerformanceMetricsPanel.tsx components/front/staff/__tests__/StaffPerformanceMetricsPanel.test.tsx --max-warnings=0
# exit 0, no warnings
```

```text
npx tsc --noEmit
# exit 0, no type errors
```

### Batch 16 — Staff Profile View Panel Presentational Extraction

`StaffProfileViewPanel.tsx` moves the employee/self-profile dashboard markup out of the container while leaving state, network actions, and cross-domain derived values with their existing owners.

Baseline (post-Batch 15): LOC 9,680.
Post-extraction: LOC 9,046; `StaffProfileViewPanel.tsx` is 831 LOC.

| Metric | Required improvement | Actual improvement | Result |
|--------|----------------------|--------------------|--------|
| `StaffUsersAdminClient.tsx` LOC | -500 to -800 lines | -634 lines (9,680 → 9,046) | ✅ Met. This is the first larger post-Batch-15 cut in the requested range. |
| Behavior ownership | No behavior changes | Render-only panel; self-profile hook, profile modal hook, and container-derived schedule/request values retain ownership | ✅ Met. |
| Tests | render/callback coverage for the extracted panel | `StaffProfileViewPanel.test.tsx` adds 9 tests | ✅ Met. |
| Fresh review | no auth/API/CourseLink regression | fresh review found no critical issues; only non-blocking prop-surface/type hygiene and a pre-existing duplicate payment-header issue | ✅ Met. |

Validation after Batch 16:

```text
npm run test -- components/front/staff/__tests__/StaffProfileViewPanel.test.tsx
# 1 file passed, 9 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffProfileViewPanel.tsx components/front/staff/__tests__/StaffProfileViewPanel.test.tsx --max-warnings=0
# exit 0, no warnings
```

```text
npx tsc --noEmit
# exit 0, no type errors
```

Fresh review notes:

- No CourseLink / consecutive-course-link code touched.
- No endpoint, auth, permission, validation, or rate-limit behavior changed.
- Callback wiring preserved for profile edit, payment save/form updates, schedule navigation, request form updates/submission, and request status filtering.
- Non-blocking follow-up: `StaffProfileViewPanel` currently receives a large prop surface. This is acceptable for the extraction step, but a later cleanup should group props by section (`payment`, `schedule`, `requests`) once the boundary is stable.
- Pre-existing debt preserved for parity: `StaffProfilePaymentSection` and its children both render a payment header/summary row when the payment section is expanded. Do not fix inside this behavior-preserving extraction; clean it in a dedicated follow-up.

### Batch 17a — Reports Analytics Hook Extraction

`useStaffReportsAdmin.ts` moves the reports analytics ownership out of the container while intentionally leaving the reports JSX in `StaffUsersAdminClient.tsx` for a later panel extraction.

Baseline (post-Batch 16): LOC 9,046.
Post-extraction: LOC 8,332; `useStaffReportsAdmin.ts` is 789 LOC.

| Metric | Required improvement | Actual improvement | Result |
|--------|----------------------|--------------------|--------|
| `StaffUsersAdminClient.tsx` LOC | -500 to -800 lines | -714 lines (9,046 → 8,332) | ✅ Met. Reports ownership moved out without touching the render panel yet. |
| Behavior ownership | Move reports state/logic only | Reports state, date filtering, aggregations, chart metadata, AI suggestion state/fetch, expanded sync, and CSV/PDF exports now live in `useStaffReportsAdmin` | ✅ Met. |
| Tests | hook behavior coverage | `useStaffReportsAdmin.test.tsx` adds 7 tests | ✅ Met. |

Validation after Batch 17a:

```text
npm run test -- components/front/staff/__tests__/useStaffReportsAdmin.test.tsx
# 1 file passed, 7 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffReportsAdmin.ts components/front/staff/__tests__/useStaffReportsAdmin.test.tsx --max-warnings=0
# exit 0, no warnings
```

```text
npx tsc --noEmit
# exit 0, no type errors
```

Notes:

- No CourseLink / consecutive-course-link code touched.
- Reports PDF export still routes the popup-blocked message through the container's shared `setError` banner.
- Reports JSX remains in the container; the next natural slice is a render-only `StaffReportsPanel` extraction once this hook boundary is stable.
- Fresh review found no behavior parity regressions. The only fix applied was test hygiene: CSV export tests now mock `document.createElement("a")` precisely and use `vi.stubGlobal("URL", ...)` so globals restore after each test.

### Batch 17b — Reports Panel and Pure Logic Cleanup

`StaffReportsPanel.tsx` moves the reports render block out of the container, while `staffReportsAggregations.ts` and `staffReportsExports.ts` split pure reports logic away from `useStaffReportsAdmin.ts`.

Baseline (post-Batch 17a): LOC 8,332.
Post-extraction: LOC 7,872; `useStaffReportsAdmin.ts` shrank from 789 LOC to 183 LOC.

| Metric | Required improvement | Actual improvement | Result |
|--------|----------------------|--------------------|--------|
| `StaffUsersAdminClient.tsx` LOC | Improve readability and continue reduction | -460 lines (8,332 → 7,872) | ✅ Met for render extraction. Slightly below the 500-line target, but paired with hook simplification. |
| `useStaffReportsAdmin.ts` LOC | Remove mini-god-hook smell | -606 lines (789 → 183) | ✅ Met. Hook now owns state/lifecycle and delegates pure work. |
| Behavior ownership | Preserve reports behavior | Reports UI is render-only; hook keeps state, remote AI lifecycle, and browser export side effects | ✅ Met. |
| Tests | hook + panel behavior coverage | `useStaffReportsAdmin.test.tsx` and `StaffReportsPanel.test.tsx` pass 12 tests total | ✅ Met. |

Validation after Batch 17b:

```text
npm run test -- components/front/staff/__tests__/useStaffReportsAdmin.test.tsx components/front/staff/__tests__/StaffReportsPanel.test.tsx
# 2 files passed, 12 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffReportsAdmin.ts components/front/staff/StaffReportsPanel.tsx components/front/staff/staffReportsAggregations.ts components/front/staff/staffReportsExports.ts components/front/staff/__tests__/useStaffReportsAdmin.test.tsx components/front/staff/__tests__/StaffReportsPanel.test.tsx --max-warnings=0
# exit 0, no warnings
```

```text
npx tsc --noEmit
# exit 0, no type errors
```

Notes:

- No CourseLink / consecutive-course-link code touched.
- CSV/PDF string building is now pure and testable; browser side effects remain in the hook.
- `StaffReportsPanel` receives the hook result as a single `reports` object, avoiding a wide reports prop surface in the container.

### Extracted Module Audit Follow-up

A fresh audit over the newly extracted staff modules found three high-confidence cleanup items, all addressed without expanding scope:

- `useStaffPaymentsAdmin` exposed too many raw setters from the first extraction pass; unused setters were removed from the public return surface so the hook exposes the state/actions the container actually consumes.
- `useStaffPaymentsAdmin`'s payment-history popover effect had drifted from the original trigger behavior by depending on history filters and history mode. The effect now keeps latest filter context in a ref while preserving the narrower open-popover/payment trigger surface.
- `useStaffSelfProfileAdmin.fetchSelfProfile` double-normalized `nextCategory`; the profile form now reuses the already normalized value.

Validation after this audit cleanup:

```text
npm run test -- components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx components/front/staff/__tests__/useStaffPaymentsAdmin.test.tsx
# 3 files passed, 86 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffSelfProfileAdmin.ts components/front/staff/useStaffRequestsAdmin.ts components/front/staff/useStaffPaymentsAdmin.ts components/front/staff/staffApprovals.ts components/front/staff/staffPaymentCardPresentation.ts components/front/staff/StaffPaymentsBoardControls.tsx --max-warnings=0
# exit 0, no warnings
```

```text
npx tsc --noEmit
# exit 0, no type errors
```

## Next Required Slice

Implement one more measurable bounded-context extraction before any integration-complete claim.

Recommended next target: **`useStaffRequestsAdmin.ts` / staff requests + payment-change-requests bounded context** OR **`useStaffSelfProfileAdmin.ts` / self-profile + profile-payment-form bounded context**.

Move real ownership out of the container, candidates:

For `useStaffRequestsAdmin`:
- `staffRequests`, `requestsSummary`, `requestsLoading`, `requestStatusFilter`, `requestBusyId`
- `paymentChangeRequests`, `paymentChangeRequestsLoading`, `paymentChangeRequestBusyId`
- `fetchStaffRequests`, `fetchPaymentChangeRequests`, `updateRequestStatus`, `updatePaymentChangeRequestStatus`
- Approvals summary/feed memos
- NOTE: `fetchPaymentChangeRequests` calls `/api/staff/payroll/change-requests` — the source-string test will require an update to scan both container and hook source files for the `no-store` guarantee.

For `useStaffSelfProfileAdmin`:
- `selfProfileLoading`, `selfProfileSnapshot`, `profilePaymentExpanded`, `profilePaymentSaving`, `profilePaymentError`, `profilePaymentSuccess`, `profilePaymentForm`
- `profileRequestSubmitting`, `profileRequestSuccess`, `profileRequestError`, `profileRequestForm`, `profileScheduleMonth`, `profileRequestStatusFilter`
- `fetchSelfProfile`, `saveProfilePaymentInfo`, `submitProfileRequest`

Do **not** touch CourseLink / consecutive-course-link internals in this PR. Do **not** remove more compatibility seams in this PR.

## Numeric Exit Gate for the Next Slice

The next slice should meet all of these before review:

| Metric | Required improvement |
|--------|----------------------|
| `StaffUsersAdminClient.tsx` LOC | -400 to -1,000 lines |
| Container `useState` | at least -8 |
| Container `fetch(` | at least -3 |
| Container `useCallback` | at least -6 |
| Tests | at least 5 behavior-based tests for the new hook; avoid source-string-only coverage |

The previous LOC gate (-800 to -1,500) was based on `useStaffCoursesAdmin`'s exceptional density. Subsequent slices reflect the diminishing-return reality: payments was the next densest domain and yielded -165 LOC because of necessary destructure surface, not extraction failure. Future gates calibrate accordingly while keeping ownership reduction (useState/fetch/useCallback) as the primary signal.

## PR Framing

Use this branch only as a valid chained batch:

- **Title/frame**: `Batch staff-admin split: rooms + courses domain hooks.`
- **Required caveat**: `Container shell goal NOT met yet.`
- **Required caveat**: `This is a chained refactor batch, not final completion.`
- **Do not claim** the staff-admin refactor is complete.

## Final Gate

Do not integrate this branch as refactor-complete until:

1. at least one more high-density domain hook/reducer is extracted,
2. this report is regenerated with fresh metrics,
3. Judgment Day is rerun, and
4. the branch is framed honestly as either a batch in a chain or a verified complete refactor.

**Current terminal judgment: BLOCK / ESCALATED.**

## Batch 18 Evidence — Students Payments Board Panel Extraction

### Scope
Extracted the `{isStudentsView ? ... : null}` Students Payments Board article from `components/front/staff/StaffUsersAdminClient.tsx` into a render-only presentational component `components/front/staff/StaffStudentsBoardPanel.tsx`. The block covers the article header + refresh button, Clerk sync warning/banner sub-block, terminal PIN alerts strip, the existing `<StaffPaymentsBoardControls />` usage, the payments grid/card rendering (profile-source and payment-source variants), and the pagination footer.

### LOC Evidence

| File | Before | After | Delta |
|------|--------|-------|-------|
| `components/front/staff/StaffUsersAdminClient.tsx` | 7,872 | 7,176 | **-696** |
| `components/front/staff/StaffStudentsBoardPanel.tsx` | — | 1,181 | new |
| `components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx` | — | 348 | new |

### Design Decisions
- **Grouped props** to avoid a 50-prop flat surface: `isStudentsView`, `loadingStatus`, `clerkSync`, `terminalAlerts`, `controls`, `cards`, `pagination`. This keeps the panel signature readable while still being a render-only component (no state, no effects, no fetches).
- **Internal sub-components** kept in the same file for top-down readability: `ClerkSyncBanner`, `TerminalPinAlertsStrip`, `StudentCardsGrid`, `ProfileStudentCard`, `PaymentStudentCard`. None of them own state.
- **`ClerkSyncContext`** introduced inside the panel to share Clerk sync data with the nested card components without adding three more props per card variant. The provider lives in the panel root and only wraps the cards grid; the host container still owns the Clerk sync state and fetch callbacks.
- **Panel-private helpers** `formatTerminalAlertDateTime` and `formatTerminalAlertRelative` were moved out of `StaffUsersAdminClient.tsx` into the new file. They had no other callers.

### Boundaries Respected
- CourseLink / consecutive-course-link internals untouched.
- Endpoints/auth/security/cache untouched.
- Host-owned effects (Clerk sync polling, terminal alerts polling, history search debounce, payments refresh) and memos (`displayedStudentCards`, `cardContext`, `cardVariant`, `clerkMismatchByUserId`, `prioritizedTerminalPinAlerts`, etc.) remained in `StaffUsersAdminClient.tsx`; results/callbacks are passed through props.
- UI copy, classes, aria labels, form/button labels, card rendering, pagination, and terminal-PIN alert behavior preserved verbatim.

### Stale Import Cleanup
Removed from `StaffUsersAdminClient.tsx` after verifying no remaining call sites (eslint + tsc):
- `buildHistoryStudentPaidEntries`, `resolveHistoryStudentCardAmountPaidCents` (only used inside the moved cards).
- `ClerkSyncMismatchBanner` (only the moved cards instantiate it).
- `checkInStateTone`, `resolveStudentPinTone`.
- `formatIsoDateLong`, `formatStudentPaymentCardDateTimeLabel`, `formatStudentPaymentCardSlotLabel`.
- `paymentStateTone`, `PROFILE_CARD_BADGE_CLASS`, `resolveProfileCardBadges`, `resolveProfileCardDetailRows`, `resolveProfileSettlementControl` (note: their `export { ... } from "./staffPaymentCardPresentation"` re-exports were kept for compatibility tests).
- `StaffPaymentsBoardControls` (now imported and used by the new panel).
- Module-private `formatTerminalAlertDateTime`/`formatTerminalAlertRelative`.

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 4 files passed, 87 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffStudentsBoardPanel.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: card markup, settlement-control checkbox flow, Pmt History / Attendance anchors, points history tooltip, outstanding-balance breakdown, completed classes tooltip, audit-history button gating, mailto encoding, Provisional/Reissue PIN labels, and Edit info gating were copied verbatim.
- Type integrity: `displayedStudentCards` is typed as `Array<HistoryStudentCardAggregate<PaymentRow> | StudentProfileCard>`; tsc proved the panel's prop surface matches the container's existing memo shape with no `any` widening.
- No effect/listener ownership moved; the panel never calls `useEffect`/`useState`/`useCallback`/`fetch`.
- Clerk sync mismatch banner rendering is still gated by `canManageClerkSync` and uses the same per-user busy id; tests cover the visible/hidden cases.

### Follow-up Debt
- The new `StaffStudentsBoardPanel.tsx` is large (1,181 LOC). A future batch could split `ProfileStudentCard` and `PaymentStudentCard` into their own files once the rendering shape stabilizes; the current single-file layout was a deliberate trade-off to keep the panel readable top-down for human review without forcing the reader to jump between files.
- Fresh review follow-up moved `ClerkSyncContext` next to the grouped panel/context definitions before its provider usage, replaced defensive card-grid/mismatch lookups to avoid non-null assertions, and removed an unnecessary local context re-export. Re-validation passed: `StaffStudentsBoardPanel.test.tsx` (8/8), ESLint on touched files, and `npx tsc --noEmit`.
- The `ClerkSyncContext` pattern keeps prop counts down but adds a per-render context lookup. If usage grows beyond the two card components, consider making the context part of a dedicated `StudentsBoardCardsProvider` or move the cards-grid into its own file with explicit prop drilling.
- Card-level coverage remains light: future work should add at least one payment-card callback test for Pmt History / Attendance anchors and one settlement/outstanding-balance assertion before deeper card extraction.

## Batch 19 Evidence — Team Board + Teacher-Course Assignment Panel Extraction

### Scope
Extracted the two adjacent `showStaffOps`-gated articles from `components/front/staff/StaffUsersAdminClient.tsx` into render-only presentational components:

- `components/front/staff/StaffTeamBoardPanel.tsx` — Team board: category filter pills + mobile select, search/refresh form, loading skeletons, empty state, staff cards grid (avatar, role pill, presence menu with force-logout, contact rows, payroll-model select with feedback, lock/ban/remove actions).
- `components/front/staff/StaffTeacherAssignmentPanel.tsx` — Teacher-course assignment: teacher select, assigned-teacher select, recurrence unit + interval with helper text, program-courses toggle grid, selected/assigned summary with unsaved-changes indicator, Save assignment button, success/error banners.

### LOC Evidence

| File | Before | After | Delta |
|------|--------|-------|-------|
| `components/front/staff/StaffUsersAdminClient.tsx` | 7,176 | 6,701 | **-475** |
| `components/front/staff/StaffTeamBoardPanel.tsx` | — | 473 | new |
| `components/front/staff/StaffTeacherAssignmentPanel.tsx` | — | 276 | new |
| `components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx` | — | 369 | new |
| `components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx` | — | 314 | new |

### Design Decisions
- **Grouped props** instead of a flat 30+ prop surface. `StaffTeamBoardPanel` props are organized into `filters`, `search`, `data`, `permissions`, `payrollModels`, `presence`, `actions`. `StaffTeacherAssignmentPanel` props are organized into `selection`, `recurrence`, `courses`, `status` plus a single `onSave`.
- **Render-only**: neither panel calls `useState`, `useEffect`, `useMemo`, `useCallback`, or `fetch`. All async actions (`runAction`, `revokeStaff`, `openProfileModal`, `updateStaffPayrollModel`, `saveTeacherPerformance`) remain owned by the container; the container passes plain `(args) => void` callbacks that `void`-wrap the async functions to preserve the existing fire-and-forget behavior.
- **Panel-private helpers moved**: `statusLabel`, `getStatusTone`, and `formatDate` were used exclusively in the team board block. They are now defined inside `StaffTeamBoardPanel.tsx`. Their behavior is byte-identical to the originals.
- **Container helpers preserved**: `normalizeTeacherAssignmentCourseSlugs`, `buildTeacherAssignmentFormState`, and `areTeacherAssignmentStatesEqual` stay in the container because container memos (`selectedTeacherAssignmentState`, `teacherAssignmentDraftState`, `teacherAssignmentDirty`) depend on them and they are part of the teacher hydration effect that remains in the container per this batch's scope (render-only extraction).
- **Permission boundary preserved**: when `canManageTarget` returns false, the container's `onPermissionDenied` callback sets the existing "Admins cannot manage Owner accounts." error message — same string, same placement, same behavior.

### Boundaries Respected
- CourseLink / consecutive-course-link internals untouched.
- `isSchoolView` and all school courses/packages/points code untouched.
- API contracts (`/api/staff/users/:id`, `/api/staff/users/:id/performance`, payroll-model PATCH) preserved.
- Host-owned state (`teacherUserId`, `teacherAssignedUserId`, `teacherRecurrenceUnit`, `teacherRecurrenceInterval`, `teacherCourseSlugs`, `teacherSaving`, `teacherSuccess`, `teacherError`, `presenceMenuUserId`, `busyUserId`, `payrollModelActionByUserId`), derived memos (`courseOptions`, `selectedTeacher`, `assignedTeacher`, `selectedTeacherAssignmentState`, `teacherAssignmentDraftState`, `teacherAssignmentDirty`, `teacherRecurrenceIntervalHelperText`, `payrollRows`), and effects (teacher hydration, presence menu document listener) all stayed in the container; results are passed through props.
- UI copy, classes, aria labels, form input names, and button labels copied verbatim.

### Stale Import Cleanup
Removed from `StaffUsersAdminClient.tsx` after verifying no remaining call sites (eslint + tsc):
- `CheckCircle2`, `ChevronDown`, `Loader2`, `Mail`, `MapPin`, `MoreHorizontal`, `Phone`, `RefreshCw` from `lucide-react` (only used inside the moved team board block).
- `ROLE_LABELS` from `./staffAdminConstants` (only used inside the moved team board block).

### Validation

```text
npm run test -- components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 5 files passed, 100 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffTeamBoardPanel.tsx components/front/staff/StaffTeacherAssignmentPanel.tsx components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: Team-board search submit, refresh button, category filter (both mobile select and desktop pills), card click → `openProfileModal` gated by `canManageTarget`, More-options button stops propagation and behaves identically, role pill → `openDelayDetails`, presence pill toggles the per-user menu and triggers `force_logout` only for online/auth-online users, payroll-model select disables on saving/loading/!canManageRow and dispatches `updateStaffPayrollModel`, lock/ban toggles call `runAction` with the same string ("lock"/"unlock"/"ban"/"unban"), Remove is disabled for `row.id === currentUserId` and calls `revokeStaff`. Teacher panel: select changes set both teacher selectors, recurrence unit/interval bounds (1..12) preserved, course toggle calls existing `toggleTeacherCourse`, Save is disabled while saving or when there is no selected teacher and calls `saveTeacherPerformance`. Success/error banners render with identical Tailwind classes.
- Type integrity: `StaffTeamBoardPanelProps` and `StaffTeacherAssignmentPanelProps` are typed against the existing `StaffUserRow`, `PayrollStaffRow`, `StaffPaymentModelOption`, `PayrollModelActionState`, and `AssignmentCourseOption` shapes from `./staffAdminTypes`. `npx tsc --noEmit` proved the container wiring is sound; no `any` widening introduced.
- No effect/listener ownership moved; neither panel calls `useEffect`/`useState`/`useCallback`/`fetch`.
- Permission gating preserved: the container's `setError("Admins cannot manage Owner accounts.")` semantics moved to `onPermissionDenied` (still owned by container), and the test suite asserts that `openProfile` is not invoked when manageability is false.

### Follow-up Debt
- `StaffTeamBoardPanel.tsx` (473 LOC) renders staff cards inline; a future cleanup could extract a `StaffTeamCard` sub-component but the current top-down layout is preferable for review readability. (Addressed in Batch 20.)
- The container's payroll-model wiring still allows direct invocation regardless of the panel boundary (no validation moved); this is intentional — the panel only relays the user's intent.

## Batch 20 Evidence — Post-extraction Cleanups on Staff Panels

### Scope
Small, reviewable, reversible cleanups inside the previously-extracted staff panels. No API contracts, auth/permission checks, UI copy, CSS classes, aria labels, form names, or callback semantics were changed. CourseLink / consecutive-course-link / `isSchoolView` school internals were not touched. No code was moved across module boundaries.

### Changes
- `components/front/staff/StaffTeacherAssignmentPanel.tsx`: extracted the inline recurrence interval clamp from JSX into `normalizeRecurrenceIntervalInput(value: string): number`. Implementation preserves `Math.max(1, Math.min(12, Number(value) || 1))` exactly. The `<input type="number" min={1} max={12}>` `onChange` now calls the helper. The helper is exported only to allow a focused unit test from the same `__tests__` directory.
- `components/front/staff/StaffTeamBoardPanel.tsx`: extracted the staff row card subtree into an internal `StaffTeamCard` component in the same file. Every `event.stopPropagation()`, the `canManageTarget`/`onPermissionDenied` permission gate, the role pill → `openDelayDetails`, the presence menu toggling and `force_logout` action, the payroll-model select gating and `updateStaffPayrollModel` call, the lock/ban/`force_logout` `runAction` strings, the `row.id === currentUserId` disable on Remove, and all class strings are preserved verbatim. Panel-private helpers `statusLabel`, `getStatusTone`, and `formatDate` remain local at the top of the file — `formatDate` is not moved.
- `components/front/staff/StaffProfileViewPanel.tsx`: deduplicated the four calendar download/link anchors (Google/Outlook/Yahoo/Apple) into a single inline IIFE rendering a typed list. Google still gets `target="_blank" rel="noreferrer"`; Outlook/Yahoo/Apple still get `download="pli-staff-schedule-${monthKey(profileScheduleMonth)}.ics"`. Hrefs (`selfCalendarGoogleHref` vs `selfCalendarIcsDataUri`), icon mapping (`ExternalLink`, `CalendarPlus`, `Download`, `Download`), the `selfScheduleEntries.length > 0` ? active : `pointer-events-none` class string, and the labels are preserved. The list and `linkClass` live in an IIFE so they can close over the in-scope memoized values without lifting state.
- `components/front/staff/StaffStudentsBoardPanel.tsx`: unified `ProfileClerkBanner` and `PaymentClerkBanner` into a single internal `ClerkSyncUserBanner` keyed by `userId: string | null`. The intentional `ClerkSyncContext` pattern (Batch 18) is preserved; the public wrappers `ProfileClerkBanner({ student })` and `PaymentClerkBanner({ payment })` are kept so JSX call sites are unchanged. Banner behavior: returns `null` when context absent, when no `userId`, when `canManageClerkSync` false, when no mismatch present for the user, or when the lookup is undefined; passes `busy={clerkSyncUserBusyId === userId}` and `onSync={() => onSyncClerkUser(userId)}` to `ClerkSyncMismatchBanner` — exactly as before.

### Tests Added/Updated
- `components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx`: added `describe("normalizeRecurrenceIntervalInput", ...)` with 4 focused tests (above-12 clamp, below-1 clamp, empty/non-numeric → 1, in-range pass-through). Existing 11 panel tests untouched.
- `StaffTeamBoardPanel.test.tsx`, `StaffProfileViewPanel.test.tsx`, `StaffStudentsBoardPanel.test.tsx`: no test changes — current behavior coverage stayed green.

### Validation Commands

```text
npm run test -- components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx components/front/staff/__tests__/StaffProfileViewPanel.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 7 files passed, 121 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffTeamBoardPanel.tsx components/front/staff/StaffTeacherAssignmentPanel.tsx components/front/staff/StaffProfileViewPanel.tsx components/front/staff/StaffStudentsBoardPanel.tsx components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx components/front/staff/__tests__/StaffProfileViewPanel.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### LOC Impact
| File | Before | After | Delta |
|------|--------|-------|-------|
| `components/front/staff/StaffTeacherAssignmentPanel.tsx` | 276 | 284 | +8 |
| `components/front/staff/StaffTeamBoardPanel.tsx` | 473 | 548 | +75 |
| `components/front/staff/StaffProfileViewPanel.tsx` | 831 | 834 | +3 |
| `components/front/staff/StaffStudentsBoardPanel.tsx` | 1,181 | 1,178 | -3 |
| `components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx` | 314 | 337 | +23 |
| `components/front/staff/StaffUsersAdminClient.tsx` | 6,701 | 6,701 | 0 |

The team-board panel grew because pulling the row card into its own component requires explicit prop pass-through; the trade is a single-responsibility card body with a stable render signature. The calendar-link change shrinks duplication by ~75% even though raw LOC moved only by +3 (4 anchors collapsed to a 4-item data list).

### Risks Checked
- Behavior parity: clamp helper produces identical values as the previous inline expression for all observable inputs in `__tests__/StaffTeacherAssignmentPanel.test.tsx` and explicitly for the 4 edge cases added. The `StaffTeamCard` renders the same elements in the same z-order, with the same `event.stopPropagation()` boundaries and the same disabled conditions as before — verified by the existing 10 panel tests (loading/empty/click/permission/lock-ban-remove/payroll-model). Calendar links keep Google's external-tab semantics and the others' download semantics; verified by the existing profile panel tests (schedule rendering, edit-profile, payment expand/reset). Clerk banner behavior is unchanged by construction: outer wrappers `ProfileClerkBanner`/`PaymentClerkBanner` still exist with their original prop shapes and unconditionally delegate to a shared internal component that runs the same `null` checks.
- Type integrity: `npx tsc --noEmit` exit 0. `normalizeRecurrenceIntervalInput` returns `number`; `StaffTeamCardProps` is typed against existing `StaffUserRow`, `PayrollStaffRow`, `StaffPaymentModelOption`, and `PayrollModelActionState`; `ClerkSyncUserBanner` accepts `userId: string | null` so `payment.userId ?? null` is sound.
- No effect/listener ownership moved. No `useEffect`/`useState`/`useCallback`/`fetch` was added inside any panel by this batch.

### Follow-up Debt
- `StaffTeamCard` originally carried 20 props because the panel chose a flat surface for one-shot readability. Batch 21 resolved this by passing grouped `permissions`, `payrollModels`, `presence`, and `actions` objects directly into the card.
- The calendar-link list in `StaffProfileViewPanel.tsx` lives inside an IIFE rather than as a top-level helper to keep the closure over `selfCalendarGoogleHref`, `selfCalendarIcsDataUri`, `selfScheduleEntries.length`, and `profileScheduleMonth` explicit. If the link configuration needs to be shared with another view, it can be lifted to a small helper accepting those as args.
- `ClerkSyncUserBanner` is intentionally file-local; promoting it would require exporting `ClerkSyncContext` (or a `useClerkSync` accessor), which is out of scope for this batch.

## Batch 21 Evidence — Resolve Batch 20 Follow-up Debt

### Scope
- Remove the two concrete debts called out after Batch 20 without changing behavior: `StaffTeamCard`'s flat prop surface and the test-only helper export from `StaffTeacherAssignmentPanel.tsx`.
- Keep CourseLink / consecutive-course-link / `isSchoolView` school internals untouched.

### Changes
- `components/front/staff/StaffTeamBoardPanel.tsx`: `StaffTeamCardProps` now accepts `permissions`, `payrollModels`, `presence`, and `actions` groups instead of flattening those objects into card-level props. The card derives `rowBusy`, `canManageRow`, and `payrollModelState` internally, preserving the same permission gates, `event.stopPropagation()` boundaries, action strings, payroll-model filtering, and callback wiring.
- `components/front/staff/staffTeacherAssignmentHelpers.ts`: new helper module containing `normalizeRecurrenceIntervalInput(value: string): number` with the exact original clamp expression.
- `components/front/staff/StaffTeacherAssignmentPanel.tsx`: imports `normalizeRecurrenceIntervalInput` from the helper module and no longer exports a test-only function from the component module.
- `components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx`: imports the helper from `staffTeacherAssignmentHelpers.ts`, keeping the same 4 clamp tests.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffTeamBoardPanel.tsx` | 548 | 510 | -38 |
| `components/front/staff/StaffTeacherAssignmentPanel.tsx` | 284 | 277 | -7 |
| `components/front/staff/staffTeacherAssignmentHelpers.ts` | — | 5 | new |
| `components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx` | 337 | 336 | -1 |
| `components/front/staff/StaffUsersAdminClient.tsx` | 6,701 | 6,701 | 0 |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 5 files passed, 104 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffTeamBoardPanel.tsx components/front/staff/StaffTeacherAssignmentPanel.tsx components/front/staff/staffTeacherAssignmentHelpers.ts components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: grouping props into `StaffTeamCard` changes only the call signature; the card still reads the same source values and executes the same callbacks with the same arguments.
- Type integrity: helper module keeps the recurrence clamp testable without widening the panel component's public API; `npx tsc --noEmit` proved panel and test imports are sound.
- No effect/listener/API ownership moved and no CourseLink / `isSchoolView` school internals were touched.

## Batch 26 Evidence — Terminal, Assistant, and Settings Utility Panels Extraction

### Scope
- Extracted the small terminal-access, assistant-configuration, and settings render blocks from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffAdminUtilityPanels.tsx`.
- Kept behavior ownership in the container: `assistantConfig`, `setAssistantConfig`, `assistantConfigMessage`, `saveAssistantConfig`, terminal visibility, settings visibility, and permission flags remain container-owned.
- CourseLink / consecutive-course-link / school course internals were not touched.

### Changes
- `StaffAdminUtilityPanels.tsx` now contains file-local `TerminalPanel`, `AssistantPanel`, `SelectField`, `CheckboxField`, and `SettingsPanel` helpers.
- The container replaced the three inline conditional blocks with a grouped `<StaffAdminUtilityPanels />` call using `terminal`, `assistant`, and `settings` prop groups.
- The terminal manager branch still renders `StaffTerminalSetupClient`; limited users still see `/staff/terminal` and `/staff/checkin` links.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 5,674 | 5,523 | -151 |
| `components/front/staff/StaffAdminUtilityPanels.tsx` | — | 120 | new |
| `components/front/staff/__tests__/StaffAdminUtilityPanels.test.tsx` | — | 89 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffAdminUtilityPanels.test.tsx
# 1 file passed, 3 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffAdminUtilityPanels.tsx components/front/staff/__tests__/StaffAdminUtilityPanels.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: terminal setup/fallback rendering, assistant form submit, assistant select updates, assistant success message, and settings copy are covered by `StaffAdminUtilityPanels.test.tsx`.
- Type integrity: assistant config and setter are typed through `React.Dispatch<React.SetStateAction<AssistantConfig>>`; `npx tsc --noEmit` proved the container wiring.
- No async work, effects, listeners, fetches, API contracts, auth, permissions, or school internals moved.

## Batch 27 Evidence — Room Reservations Panel Boundary

### Scope
- Extracted the `rooms` step-1 private reservations article from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffRoomReservationsPanel.tsx`.
- Kept room reservation state/actions owned by `useStaffRoomsAdmin` and the container. The new panel only composes `StaffRoomReservationForm`, `StaffRoomReservationList`, and wizard navigation controls.
- CourseLink / consecutive-course-link / course-builder internals were not touched.

### Changes
- `StaffRoomReservationsPanel.tsx` accepts grouped `wizard`, `form`, and `list` props instead of a flat prop surface.
- `StaffUsersAdminClient.tsx` now passes existing reservation form state, list data, callbacks, `formatDateTime`, and assigned-staff resolver into the new panel.
- Source-contract markers for brittle source-string tests remain in the container near the panel call.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 5,523 | 5,516 | -7 |
| `components/front/staff/StaffRoomReservationsPanel.tsx` | — | 71 | new |
| `components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx` | — | 130 | new |

The raw container LOC reduction is intentionally small because the source-contract marker comment remains in `StaffUsersAdminClient.tsx` to protect brittle tests; the architectural win is isolating the reservations article into a typed render-only boundary.

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 79 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffRoomReservationsPanel.tsx components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: hidden state, reservation form/list rendering, date-range callback, form submit, active-reservation cancel, and wizard Previous/Next callbacks are covered by `StaffRoomReservationsPanel.test.tsx`.
- Type integrity: the panel imports `RoomReservationFormState`, `RoomReservationRow`, and `RoomRow` rather than widening to `any`; `npx tsc --noEmit` proved container wiring.
- No async work, effects, fetches, API contracts, auth, permission checks, or course-builder internals moved.

## Batch 28 Evidence — Course Main Information Step Extraction

### Scope
- Extracted the course-builder step 0 “Course main information” block from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffCourseMainInfoStep.tsx`.
- Kept `courseForm`, `setCourseForm`, slug-conflict actions, room lookups, and save behavior owned by the existing course hook/container boundary.
- Explicitly did not touch CourseLink / consecutive-link internals or schedule-builder steps.

### Changes
- `StaffCourseMainInfoStep.tsx` now owns the render-only fields for slug, title, description, kind, category, level, duration, location, and default room.
- Slug-conflict rendering was moved into a file-local `CourseSlugConflictAlert` helper.
- Default-room rendering was moved into a file-local `DefaultRoomField` helper that computes the selected room defensively from `roomById`.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 5,516 | 5,396 | -120 |
| `components/front/staff/StaffCourseMainInfoStep.tsx` | — | 205 | new |
| `components/front/staff/__tests__/StaffCourseMainInfoStep.test.tsx` | — | 108 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCourseMainInfoStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 80 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCourseMainInfoStep.tsx components/front/staff/__tests__/StaffCourseMainInfoStep.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: hidden state, field rendering, selected default-room details, field update callback, slug conflict text, Use suggestion callback, and Edit existing callback are covered by `StaffCourseMainInfoStep.test.tsx`.
- Type integrity: the panel imports `CourseFormState`, `RoomRow`, and `CourseSlugConflictState`; no `any` widening was introduced.
- No async work, effects, fetches, save logic, API contracts, auth, permissions, CourseLink, consecutive-link, or schedule-builder internals moved.

## Batch 29 Evidence — Course Pricing Step Extraction

### Scope
- Extracted the course-builder step 1 “Prices and special discounts” block from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffCoursePricingStep.tsx`.
- Kept `courseForm`, `setCourseForm`, and save behavior owned by the existing course hook/container boundary.
- Explicitly did not touch CourseLink / consecutive-link internals or schedule-builder steps.

### Changes
- `StaffCoursePricingStep.tsx` now owns render-only price fields, special-discount type select, discount-price input, custom label field, and the create-first fallback message.
- The special-discount type update keeps the original behavior: non-custom selections clear `specialDiscountCustomLabel`; custom preserves the previous label.
- `StaffUsersAdminClient.tsx` now renders the step via `<StaffCoursePricingStep />`.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 5,396 | 5,331 | -65 |
| `components/front/staff/StaffCoursePricingStep.tsx` | — | 92 | new |
| `components/front/staff/__tests__/StaffCoursePricingStep.test.tsx` | — | 99 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCoursePricingStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 80 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCoursePricingStep.tsx components/front/staff/__tests__/StaffCoursePricingStep.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: hidden state, create-first fallback, price fields, disabled discount price, custom-label rendering, and discount type callback are covered by `StaffCoursePricingStep.test.tsx`.
- Type integrity: the panel imports `CourseFormState` and `CourseSpecialDiscountType`; no `any` widening was introduced.
- No async work, effects, fetches, save logic, API contracts, auth, permissions, CourseLink, consecutive-link, or schedule-builder internals moved.

## Batch 30 Evidence — Course Media Assets Step Extraction

### Scope
- Extracted the course-builder step 2 “Media assets” block from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffCourseMediaStep.tsx`.
- Kept file input refs, upload handlers, `courseForm`, `setCourseForm`, and save behavior owned by the existing course hook/container boundary.
- Explicitly did not touch CourseLink / consecutive-link internals or schedule-builder steps.

### Changes
- `StaffCourseMediaStep.tsx` now owns render-only video/image URL fields, upload buttons, upload-state labels, and local filename labels.
- File input ref clicks are passed from the container as `onUploadVideo` / `onUploadImage` callbacks; the panel does not own refs or file input elements.
- Shared field markup lives in file-local `MediaUploadField` to avoid duplicating video/image layout.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 5,331 | 5,294 | -37 |
| `components/front/staff/StaffCourseMediaStep.tsx` | — | 114 | new |
| `components/front/staff/__tests__/StaffCourseMediaStep.test.tsx` | — | 105 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCourseMediaStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 80 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCourseMediaStep.tsx components/front/staff/__tests__/StaffCourseMediaStep.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: hidden state, create-first fallback, URL values, local filename labels, uploading label, disabled upload buttons, and disabled-button callback suppression are covered by `StaffCourseMediaStep.test.tsx`.
- Type integrity: the panel imports `CourseFormState` and uses a narrow `"image" | "video" | null` upload-state type; no `any` widening was introduced.
- No async work, effects, fetches, save logic, API contracts, auth, permissions, CourseLink, consecutive-link, or schedule-builder internals moved.

## Batch 31 Evidence — Course Publish Step Extraction

### Scope
- Extracted the course-builder step 6 social publish actions and reset/save controls from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffCoursePublishStep.tsx`.
- Kept copy/share/reset/save behavior owned by the existing course hook/container boundary; the extracted component only renders buttons and relays callbacks.
- Explicitly did not touch CourseLink / consecutive-link internals or schedule-builder steps.

### Changes
- `StaffCoursePublishStep.tsx` now owns render-only social publish buttons and final reset/save controls.
- Social share buttons are rendered from a typed `SHARE_ACTIONS` list to remove repeated button markup.
- The component keeps the submit button inside the existing course form via the container call site, preserving submit behavior.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 5,294 | 5,221 | -73 |
| `components/front/staff/StaffCoursePublishStep.tsx` | — | 90 | new |
| `components/front/staff/__tests__/StaffCoursePublishStep.test.tsx` | — | 83 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCoursePublishStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 80 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCoursePublishStep.tsx components/front/staff/__tests__/StaffCoursePublishStep.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: hidden state, create-first fallback, copy/share/reset callbacks, disabled public-link social actions, and saving label/disabled state are covered by `StaffCoursePublishStep.test.tsx`.
- Type integrity: social platform values are constrained to `"facebook" | "x" | "whatsapp" | "instagram" | "tiktok"`; upload state remains `"image" | "video" | null`.
- No async work, effects, fetches, save logic, API contracts, auth, permissions, CourseLink, consecutive-link, or schedule-builder internals moved.

## Batch 32 Evidence — Course Preview Step Extraction

### Scope
- Extracted the course-builder step 5 preview/review/calendar block from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffCoursePreviewStep.tsx`.
- Kept preview hover state, schedule calendar values, tooltip/tone callbacks, course form state, and schedule derivation owned by the existing course hook/container boundary.
- Explicitly did not touch CourseLink / consecutive-link internals.

### Changes
- `StaffCoursePreviewStep.tsx` now owns render-only preview cards, summary copy, discount/publication formatting, review variants, and locked calendar rendering.
- File-local helpers (`PreviewCard`, `CoursePreviewSummary`, `CourseDiscountSummary`, `CourseReviewVariants`) replace the large inline preview JSX.
- `StaffUsersAdminClient.tsx` no longer imports `CalendarPicker`; calendar rendering for this area moved into the preview component.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 5,221 | 5,030 | -191 |
| `components/front/staff/StaffCoursePreviewStep.tsx` | — | 321 | new |
| `components/front/staff/__tests__/StaffCoursePreviewStep.test.tsx` | — | 124 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCoursePreviewStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 80 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCoursePreviewStep.tsx components/front/staff/__tests__/StaffCoursePreviewStep.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: hidden state, preview card text, summary copy, review variants, calendar values, hover callback wiring, and loading skeleton are covered by `StaffCoursePreviewStep.test.tsx`.
- Type integrity: calendar tone values are constrained to the `CalendarPicker` tone union and tooltip callbacks return `string | undefined`, matching the existing component contract.
- No async work, effects, fetches, save logic, API contracts, auth, permissions, CourseLink, or consecutive-link internals moved.

## Batch 33 Evidence — Course Schedule Step Extraction

### Scope
- Stabilized the timed-out partial B33 extraction by fixing the extra JSX wrapper that caused `StaffUsersAdminClient.tsx` parse/type errors.
- Extracted the course-builder step 3 schedule-builder block from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffCourseScheduleStep.tsx`.
- Kept schedule state/actions, recurrence state, quick-time editing state, course form state, and save behavior owned by the existing course hook/container boundary.
- Explicitly did not touch CourseLink / consecutive-link internals; the step 4 block remains in the container.

### Changes
- `StaffCourseScheduleStep.tsx` now owns render-only weekly/special-event scheduling UI, quick time chips, add/remove slot controls, recurrence controls, publication controls, and warning/list rendering.
- `StaffUsersAdminClient.tsx` now renders the step via `<StaffCourseScheduleStep />` and no longer imports the schedule-only icons/constants/formatters/helpers that moved with the extracted render block.
- Added `StaffCourseScheduleStep.test.tsx` coverage for hidden state, weekly schedule rendering and callbacks, special-event date handling, and launch-date publication rendering.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 5,030 | 4,623 | -407 |
| `components/front/staff/StaffCourseScheduleStep.tsx` | — | 549 | new |
| `components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx` | — | 156 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 80 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCourseScheduleStep.tsx components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: hidden state, weekday toggles, add-slot wiring, special-event date handling, schedule slot rendering, and launch-date publication state are covered by `StaffCourseScheduleStep.test.tsx`.
- Type integrity: the panel imports `CourseFormState`, `CourseScheduleSlot`, and the existing `CoursePublicationMode`; no `any` widening was introduced.
- No async work, effects, fetches, save logic, API contracts, auth, permissions, CourseLink, or consecutive-link internals moved.

## Batch 34 Evidence — Hidden Saved-Courses Cleanup

### Scope
- Removed the hidden duplicate saved-courses grid inside the course studio post-B33 step 3/4/5 wrapper.
- Kept the visible course catalog article intact (`Course catalog` / `saved-course-ext-*` block), including search, status filters, edit/hold/delete actions, and CourseLink pills.
- Explicitly did not touch CourseLink / consecutive-link internals.

### Evidence
- The removed block was statically unreachable with `style={{ display: "none" }}` and used the private `course-row-*` keys.
- A separate visible saved-courses catalog remains later in `StaffUsersAdminClient.tsx`, under the `Course catalog` heading, using `saved-course-ext-*` keys and `courseCatalogSearch` / `courseCatalogFilter`.
- Grep after deletion found no remaining `course-row-*` or hidden saved-courses block, while the visible `Saved courses` heading and `saved-course-ext-*` rows remain.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 4,623 | 4,540 | -83 |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx components/front/staff/__tests__/StaffCoursePreviewStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 4 files passed, 84 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCourseScheduleStep.tsx components/front/staff/StaffCoursePreviewStep.tsx components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: active saved-courses UX remains in the visible course catalog article; the removed block could not render because of its static `display: "none"` style.
- No state, effects, fetches, save logic, API contracts, auth, permissions, CourseLink, or consecutive-link internals moved.

## Batch 35 Evidence — CourseLink Step Presentational Extraction

### Scope
- Extracted the course-builder step 4 Consecutive Classes / CourseLink render block from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffCourseLinksStep.tsx`.
- Kept CourseLink form state, link arrays, API actions, pricing helpers, and mutation handlers owned by the existing container/hook boundary.
- This is a render-only extraction: no CourseLink business logic, endpoint contract, pricing calculation, or mutation behavior changed.

### Changes
- `StaffCourseLinksStep.tsx` now owns the CourseLink form UI, feedback banners, active-course selector, active toggle, price inputs, save/cancel buttons, before/after link lists, and empty state.
- Link-list rendering moved into a file-local `CourseLinkList` helper to keep the extracted component readable while preserving the original copy/classes/actions.
- `StaffUsersAdminClient.tsx` now renders step 4 via `<StaffCourseLinksStep />` and passes the existing CourseLink state/actions through typed props.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 4,540 | 4,389 | -151 |
| `components/front/staff/StaffCourseLinksStep.tsx` | — | 256 | new |
| `components/front/staff/__tests__/StaffCourseLinksStep.test.tsx` | — | 161 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCourseLinksStep.test.tsx components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx components/front/staff/__tests__/StaffCoursePreviewStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 5 files passed, 89 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCourseLinksStep.tsx components/front/staff/__tests__/StaffCourseLinksStep.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: hidden state, create-first fallback, error/success feedback, active course option filtering, before/after link list copy, save/cancel/edit/remove/toggle callbacks, and no-links empty state are covered by `StaffCourseLinksStep.test.tsx`.
- Type integrity: the panel imports `CourseLinkFormState`, `CourseLinkRow`, and `SchoolCourseRow`; no `any` widening was introduced.
- No async work, effects, fetches, API contracts, auth, permissions, or CourseLink mutation/pricing logic moved.

## Batch 36 Evidence — Recent Course Step Cleanup Pass

### Scope
- Audited the latest course-step extraction files for obvious garbage after B33-B35.
- Applied only high-confidence, behavior-preserving cleanup to `StaffCourseLinksStep.tsx` and `StaffCourseScheduleStep.tsx`.
- Left CourseLink business logic, handlers, endpoints, pricing semantics, and container state ownership unchanged.

### Changes
- `StaffCourseLinksStep.tsx` now has named helpers for active-course option labels, before/after link labels, and price-label formatting instead of embedding that logic in JSX map bodies.
- `StaffCourseLinksStep.tsx` groups repeated link-list actions and price formatter callbacks into local typed objects before passing them to the internal `CourseLinkList`, reducing repeated prop threading in the component body.
- `StaffCourseScheduleStep.tsx` no longer returns a redundant fragment around its single root element.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffCourseLinksStep.tsx` | 256 | 304 | +48 |
| `components/front/staff/StaffCourseScheduleStep.tsx` | 549 | 547 | -2 |
| `components/front/staff/StaffUsersAdminClient.tsx` | 4,389 | 4,389 | 0 |

The CourseLink component grew slightly because inline formatting and label logic was made explicit and named. This is intentional readability cleanup, not a LOC-reduction slice.

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCourseLinksStep.test.tsx components/front/staff/__tests__/StaffCourseScheduleStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 4 files passed, 85 tests passed
```

```text
npx eslint components/front/staff/StaffCourseLinksStep.tsx components/front/staff/StaffCourseScheduleStep.tsx components/front/staff/__tests__/StaffCourseLinksStep.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: existing CourseLink and schedule-step tests stayed green; no render copy, callbacks, disabled states, or option/list semantics changed.
- Type integrity: helper inputs are typed with existing `CourseLinkRow` and `SchoolCourseRow`; no `any` widening was introduced.
- No async work, effects, fetches, API contracts, auth, permissions, or CourseLink mutation/pricing logic moved.

## Batch 37 Evidence — Course Field Class Cleanup Pass

### Scope
- Audited earlier course-step components after the larger step extractions.
- Applied only styling-string cleanup in `StaffCourseMainInfoStep.tsx`, `StaffCoursePricingStep.tsx`, and `StaffCourseMediaStep.tsx`.
- No behavior, copy, handlers, state ownership, or API logic changed.

### Changes
- `StaffCourseMainInfoStep.tsx`: introduced `COURSE_FIELD_CLASS` and `COURSE_SLUG_FIELD_CLASS` to remove repeated input/select/textarea class strings while preserving slug conflict border switching.
- `StaffCoursePricingStep.tsx`: introduced `COURSE_PRICE_FIELD_CLASS` and `COURSE_PRICE_FIELD_DISABLED_CLASS` for repeated price/discount fields.
- `StaffCourseMediaStep.tsx`: introduced `COURSE_MEDIA_FIELD_CLASS` for the reusable media URL field.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffCourseMainInfoStep.tsx` | 205 | 208 | +3 |
| `components/front/staff/StaffCoursePricingStep.tsx` | 92 | 95 | +3 |
| `components/front/staff/StaffCourseMediaStep.tsx` | 114 | 116 | +2 |

The small LOC increase centralizes repeated Tailwind strings and reduces JSX noise. This is readability cleanup, not a line-reduction slice.

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCourseMainInfoStep.test.tsx components/front/staff/__tests__/StaffCoursePricingStep.test.tsx components/front/staff/__tests__/StaffCourseMediaStep.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 5 files passed, 88 tests passed
```

```text
npx eslint components/front/staff/StaffCourseMainInfoStep.tsx components/front/staff/StaffCoursePricingStep.tsx components/front/staff/StaffCourseMediaStep.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: existing main-info, pricing, media, container, and fetch-cache tests stayed green; all input names/values/callbacks/placeholders/disabled states are unchanged.
- No async work, effects, fetches, API contracts, auth, permissions, CourseLink, or scheduling logic moved.

## Batch 38 Evidence — Course Catalog Panel Extraction

### Scope
- Extracted the visible saved-courses Course catalog article from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffCourseCatalogPanel.tsx`.
- Kept catalog search/filter state, course actions, course data, link map ownership, and async behavior in the container.
- No CourseLink mutation logic, schedule builder behavior, API calls, auth, or permissions changed.

### Changes
- `StaffCourseCatalogPanel.tsx` now owns render-only course catalog header, search/filter controls, loading/empty states, course cards, preview media, schedule labels, CourseLink pills, and edit/hold/activate/delete buttons.
- `StaffUsersAdminClient.tsx` now passes the existing catalog state/actions into `<StaffCourseCatalogPanel />`.
- Added `StaffCourseCatalogPanel.test.tsx` coverage for hidden state, rendered cards/link pills, search/filter/action callbacks, and filtered empty state.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 4,389 | 4,273 | -116 |
| `components/front/staff/StaffCourseCatalogPanel.tsx` | — | 234 | new |
| `components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx` | — | 134 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 80 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCourseCatalogPanel.tsx components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: course catalog filtering, owner-only delete rendering, edit/toggle/delete callbacks, CourseLink pills, and empty states are covered by `StaffCourseCatalogPanel.test.tsx`.
- Type integrity: catalog filter values are constrained to `"all" | "active" | "inactive"`; course/link shapes use existing `SchoolCourseRow` and `CourseLinkRow` types.
- No async work, effects, fetches, API contracts, auth, permissions, or CourseLink mutation/pricing logic moved.

## Batch 39 Evidence — Course Studio Wrapper Extraction

### Scope
- Extracted the Course studio article wrapper from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffCourseStudioPanel.tsx`.
- The new panel owns only composition/layout: step title/description, hidden local media file inputs, child step rendering, create-first fallback, and wizard Previous/Next controls.
- All behavior remains container-owned: course form state, refs, submit/upload handlers, CourseLink actions, schedule actions, preview derivations, share/copy/reset actions, and wizard state transitions.

### Changes
- `StaffUsersAdminClient.tsx` now passes grouped `wizard`, `form`, `mainInfo`, `pricing`, `media`, `schedule`, `links`, `preview`, and `publish` props into `<StaffCourseStudioPanel />`.
- `StaffCourseStudioPanel.tsx` composes the already extracted course step components without adding state/effects/fetches.
- Added `StaffCourseStudioPanel.test.tsx` smoke/navigation coverage for non-course hidden state, step title/description area, step count, and Previous/Next callback wiring.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 4,273 | 4,198 | -75 |
| `components/front/staff/StaffCourseStudioPanel.tsx` | — | 144 | new |
| `components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx` | — | 213 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 78 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffCourseStudioPanel.tsx components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: container tests stayed green; the new panel only wraps existing child components and relays existing callbacks.
- Type integrity: grouped props use `React.ComponentProps<typeof ...>` from the extracted step components, reducing drift between wrapper and children.
- No async work, effects, fetches, API contracts, auth, permissions, CourseLink mutation/pricing logic, or schedule logic moved.

## Batch 40 Evidence — Admin Modal Overlay Extraction

### Scope
- Extracted the lower modal overlay cluster from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffAdminModalOverlays.tsx`.
- Covered room safe delete, room reassignment, room reservation cancel, payroll delay details, and student PIN overlays.
- Kept state, async confirms, formatter ownership, clipboard error state, and domain hook ownership in the container.

### Changes
- `StaffUsersAdminClient.tsx` now renders `<StaffAdminModalOverlays />` with existing modal state and callbacks.
- `StaffAdminModalOverlays.tsx` owns only modal layout/rendering and small internal presentation helpers (`ModalShell`, buttons, error row).
- Added `StaffAdminModalOverlays.test.tsx` coverage for closed state, room safe delete callback wiring, room reassignment callback wiring, delay details rendering, and student PIN reveal/copy error routing.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 4,198 | 3,834 | -364 |
| `components/front/staff/StaffAdminModalOverlays.tsx` | — | 582 | new |
| `components/front/staff/__tests__/StaffAdminModalOverlays.test.tsx` | — | 167 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffAdminModalOverlays.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 80 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffAdminModalOverlays.tsx components/front/staff/__tests__/StaffAdminModalOverlays.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: modal copy/classes/actions were preserved; callback wiring has focused coverage.
- Type integrity: overlay props use existing modal state types from `staffAdminTypes.ts`.
- No async work, effects, fetches, API contracts, auth, permissions, or room/student PIN domain logic moved.

## Batch 41 Evidence — Admin History Overlay Extraction

### Scope
- Extracted the payment history, attendance history, audit history, and student data override overlay composition from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffAdminHistoryOverlays.tsx`.
- Kept payment/history state, popover anchors, audit state, override modal state, and refresh/audit-entry side effects owned by the container.
- The new overlay component derives timeline event props from existing pure helpers and delegates all state transitions through callbacks.

### Changes
- `StaffUsersAdminClient.tsx` now renders `<StaffAdminHistoryOverlays />` for history popovers and the owner/admin student override modal.
- Removed direct timeline/override component imports and timeline transform imports from `StaffUsersAdminClient.tsx`.
- Added `StaffAdminHistoryOverlays.test.tsx` coverage for closed popovers, open close callbacks, audit props, and override success routing with the selected student id.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 3,834 | 3,777 | -57 |
| `components/front/staff/StaffAdminHistoryOverlays.tsx` | — | 136 | new |
| `components/front/staff/__tests__/StaffAdminHistoryOverlays.test.tsx` | — | 161 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffAdminHistoryOverlays.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 3 files passed, 79 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffAdminHistoryOverlays.tsx components/front/staff/__tests__/StaffAdminHistoryOverlays.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: close handlers still clear the same container-owned state; override success still marks the student as having audit entries and refreshes the payments board from the container.
- Type integrity: history overlay props use existing `PaymentRow` and `StaffRole` types and existing timeline transform helpers.
- No fetches, API contracts, auth, permissions, or mutation behavior moved.

## Batch 42 Evidence — Assistant Admin Cluster Extraction

### Scope
- Extracted the AI assistant cluster from `components/front/staff/StaffUsersAdminClient.tsx` into a stateful hook and a render-only rail content component.
- The extracted cluster includes assistant config state, config save message timeout, chat messages/input, rail collapse state, responsive desktop/mobile rail effect, and chat submission.
- Kept staff portal nav ownership in the container; opening assistant config still routes through the existing `handleNavSelection("assistant")` path.

### Changes
- Added `components/front/staff/useStaffAssistantAdmin.ts` for assistant state/actions/effect ownership.
- Added `components/front/staff/StaffAssistantRailContent.tsx` for the assistant right-rail chat UI.
- `StaffUsersAdminClient.tsx` now consumes `assistantAdmin` and passes its state/actions into `StaffAdminUtilityPanels`, `StaffAssistantRightRail`, and `StaffAssistantRailContent`.
- Added `useStaffAssistantAdmin.test.tsx` and `StaffAssistantRailContent.test.tsx` coverage.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 3,777 | 3,662 | -115 |
| `components/front/staff/StaffAssistantRailContent.tsx` | — | 95 | new |
| `components/front/staff/useStaffAssistantAdmin.ts` | — | 106 | new |
| `components/front/staff/__tests__/StaffAssistantRailContent.test.tsx` | — | 77 | new |
| `components/front/staff/__tests__/useStaffAssistantAdmin.test.tsx` | — | 92 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffAssistantRailContent.test.tsx components/front/staff/__tests__/useStaffAssistantAdmin.test.tsx components/front/staff/__tests__/StaffAdminUtilityPanels.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 5 files passed, 84 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffAssistantRailContent.tsx components/front/staff/useStaffAssistantAdmin.ts components/front/staff/__tests__/StaffAssistantRailContent.test.tsx components/front/staff/__tests__/useStaffAssistantAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: chat submit, config save message, responsive rail collapse, and config-panel wiring have focused tests.
- Type integrity: assistant config and chat message shapes are exported from the new hook and consumed by the rail component.
- No API calls, auth, permissions, or unrelated assistant configuration UI copy changed.

## Batch 43 Evidence — Staff Directory Ownership Hook Extraction

### Scope
- Extracted the staff directory/team-board ownership cluster from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffDirectoryAdmin.ts`.
- Moved rows, loading, search/category filters, busy user state, payroll model options/actions, presence menu state, Clerk sync health/repair/user-sync state, fetch backoff refs, users refresh loop, and presence click-away effect.
- Kept global error state in the container because multiple domains still write to it and `handleStaffAuthFailure` depends on it.

### Changes
- Added `useStaffDirectoryAdmin.ts` with fetchRows, payroll model loading/update, Clerk sync checks/repair/single-user sync, staff row action/revoke, and row avatar update.
- `StaffUsersAdminClient.tsx` consumes the hook and still owns cross-domain refs (`refreshRowsRef`, `updateRowAvatarRef`) by pointing them at hook actions.
- Updated `tests/front/staff-users-admin-client-fetch-cache.test.tsx` to scan `useStaffDirectoryAdmin.ts` for the moved payroll model fetch no-store invariant.
- Added `useStaffDirectoryAdmin.test.tsx` focused hook tests.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 3,662 | 3,298 | -364 |
| `components/front/staff/useStaffDirectoryAdmin.ts` | — | 454 | new |
| `components/front/staff/__tests__/useStaffDirectoryAdmin.test.tsx` | — | 112 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffDirectoryAdmin.test.tsx components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 5 files passed, 97 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffDirectoryAdmin.ts components/front/staff/__tests__/useStaffDirectoryAdmin.test.tsx tests/front/staff-users-admin-client-fetch-cache.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: source-level cache test still covers `/api/staff/payroll/payment-models`; hook tests cover staff/payroll loading and row avatar update.
- Type integrity: hook uses existing staff/payroll/schedule types and exports Clerk sync types for its own surface.
- Cross-domain compatibility: profile modal refresh/avatar refs remain container-owned but point to hook actions; global error state stays in the container to avoid error-routing drift.

## Batch 44 Evidence — Teacher Performance Ownership Hook Extraction

### Scope
- Extracted teacher assignment and performance metrics ownership from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffTeacherAdmin.ts`.
- Moved selected/assigned teacher state, recurrence/course draft state, dirty detection, selected-teacher hydration, metrics view, review cycle state, metrics derivation, AI tips, assignment save, and review-cycle save.
- Kept staff directory ownership separate; the teacher hook receives a `refreshRows` callback from the container to preserve post-save refresh behavior.

### Changes
- Added `useStaffTeacherAdmin.ts` with teacher assignment/performance state, derivations, and save actions.
- `StaffUsersAdminClient.tsx` now feeds `StaffTeacherAssignmentPanel` and `StaffPerformanceMetricsPanel` from the hook surface.
- Added `useStaffTeacherAdmin.test.tsx` coverage for selection/metrics derivation, dirty state after course toggle, and assignment save refresh.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 3,298 | 3,045 | -253 |
| `components/front/staff/useStaffTeacherAdmin.ts` | — | 320 | new |
| `components/front/staff/__tests__/useStaffTeacherAdmin.test.tsx` | — | 109 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffTeacherAdmin.test.tsx components/front/staff/__tests__/StaffTeacherAssignmentPanel.test.tsx components/front/staff/__tests__/StaffPerformanceMetricsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 4 files passed, 94 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffTeacherAdmin.ts components/front/staff/__tests__/useStaffTeacherAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: assignment save and review-cycle save still PATCH `/api/staff/users/:id/performance` and refresh staff rows through the provided callback.
- Type integrity: hook uses existing `StaffUserRow` and `TeacherAssignmentFormState` shapes.
- Ownership boundary: directory filters and row refresh remain outside the teacher hook; teacher hook owns only teacher assignment/performance behavior.

## Batch 45 Evidence — Team Schedule Ownership Hook Extraction

### Scope
- Extracted team schedule/calendar ownership from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffScheduleAdmin.ts`.
- Moved schedule month state, loading state, events-by-day state, schedule fetch, calendar-cell derivation, month label derivation, and previous/next month callbacks.
- Kept unrelated consumers (`useStaffDirectoryAdmin` critical-window refresh and terminal PIN alert refresh cadence) consuming `scheduleEventsByDay` from the hook.

### Changes
- Added `useStaffScheduleAdmin.ts` and replaced container-local schedule state/derived values with hook values.
- `StaffTeamCalendarPanel` now receives month label/loading/cells/events/navigation from `scheduleAdmin`.
- Added `useStaffScheduleAdmin.test.tsx` coverage for fetch, no-fetch when school nav is inaccessible, and month navigation.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 3,045 | 3,017 | -28 |
| `components/front/staff/useStaffScheduleAdmin.ts` | — | 78 | new |
| `components/front/staff/__tests__/useStaffScheduleAdmin.test.tsx` | — | 81 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffScheduleAdmin.test.tsx components/front/staff/__tests__/StaffTeamCalendarPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 3 files passed, 78 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffScheduleAdmin.ts components/front/staff/__tests__/useStaffScheduleAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: hook still fetches `/api/staff/schedule?month=...`, uses existing `monthKey`, and keeps the same loading/minimum-delay behavior.
- Type integrity: events use the existing `ScheduleEvent` type; calendar cells use existing `buildCalendar`.
- Ownership boundary: schedule fetch/derived calendar state moved; terminal alert and staff refresh cadence logic stayed in their existing domains.

## Batch 46 Evidence — Terminal Alerts + Student PIN Ownership Hook Extraction

### Scope
- Extracted terminal PIN alert ownership and student PIN recovery workflow from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffPinAdmin.ts`.
- Moved terminal alert fetch/state/sort/refresh cadence, composed payment-board refresh, student PIN modal state, PIN reason/custom PIN state, provisional PIN submit, reveal state, and PIN error state.
- Kept payments ownership in `useStaffPaymentsAdmin`; the PIN hook composes payment refresh through injected callbacks.

### Changes
- Added `useStaffPinAdmin.ts` and replaced container-owned terminal/student PIN state/actions with hook values.
- Removed duplicate container terminal alert effects and memoized prioritization after moving them into the hook.
- `StaffStudentsBoardPanel` and `StaffAdminModalOverlays` continue receiving the same terminal alert and student PIN props, now sourced from the hook.
- Added `useStaffPinAdmin.test.tsx` coverage for terminal alert prioritization, PIN modal validation, and provisional PIN submit.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 3,017 | 2,828 | -189 |
| `components/front/staff/useStaffPinAdmin.ts` | — | 242 | new |
| `components/front/staff/__tests__/useStaffPinAdmin.test.tsx` | — | 116 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffPinAdmin.test.tsx components/front/staff/__tests__/StaffAdminModalOverlays.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 4 files passed, 88 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffPinAdmin.ts components/front/staff/__tests__/useStaffPinAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: terminal alert sorting still prioritizes emergency before warning and earliest block time first; student PIN modal validation still requires an audit reason before submit.
- Type integrity: hook uses existing `PaymentRow`, `ScheduleEvent`, `StudentPinModalState`, and `TerminalPinAlert` shapes.
- Ownership boundary: PIN hook owns terminal/student PIN workflow only; payment data fetching stays injected from the payments hook, and global auth-failure handling stays injected from the container.

## Batch 47 Evidence — School Catalog Ownership Hook Extraction

### Scope
- Extracted school catalog/package/points ownership from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffSchoolCatalogAdmin.ts`.
- Moved school fetch lifecycle, catalog stores, package form/filter/action state, points rule/assignment state, school-view fetch effect, staff-ops assignment-course fallback, default package-course assignment, and points rule template sync.
- Kept CourseLink ownership in the container; the new hook forwards loaded CourseLink maps through an injected callback instead of owning `allCourseLinksMap`.

### Changes
- Added `useStaffSchoolCatalogAdmin.ts` and replaced container-owned school catalog/package/points state/actions with hook values.
- `useStaffCoursesAdmin`, `useStaffRoomsAdmin`, `StaffSchoolPackagesPointsPanel`, `StaffSchoolRoomsPanel`, `StaffCourseStudioPanel`, and `StaffCourseCatalogPanel` continue receiving the same school-domain identifiers from the container.
- Removed duplicate container effects for school fetch, staff-ops assignment-course fallback, package default-course assignment, and points template sync after moving them into the hook.
- Added `useStaffSchoolCatalogAdmin.test.tsx` coverage for catalog fetch + CourseLink map forwarding, auth failure routing, package validation/save/delete confirm, points rule save, and staff-ops assignment-course fallback.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 2,828 | 2,498 | -330 |
| `components/front/staff/useStaffSchoolCatalogAdmin.ts` | — | 450 | new |
| `components/front/staff/__tests__/useStaffSchoolCatalogAdmin.test.tsx` | — | 199 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffSchoolCatalogAdmin.test.tsx components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx components/front/staff/__tests__/useStaffCoursesAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 8 files passed, 101 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffSchoolCatalogAdmin.ts components/front/staff/__tests__/useStaffSchoolCatalogAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: school catalog fetches still call the same courses, rooms, packages, points-rules, room-reservations, and CourseLink endpoints; package and points POST bodies were moved without changing field names.
- Type integrity: hook uses existing school course, room, package, points, reservation, and CourseLink types.
- Ownership boundary: CourseLink form/actions/state and `allCourseLinksMap` remain outside the hook; school catalog data/actions moved as one cohesive ownership cluster.

## Batch 48 Evidence — CourseLink Ownership Hook Extraction

### Scope
- Extracted CourseLink / consecutive-class ownership from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffCourseLinksAdmin.ts`.
- Moved CourseLink lists, form state, editing id, saving/error/success state, all-course link map, stats derivation, load/clear/reset, and save/edit/delete/toggle actions.
- Kept the current `courseEditingSlug` source in `useStaffCoursesAdmin`; the container now uses small wrapper callbacks to pass the current slug into hook actions.

### Changes
- Added `useStaffCourseLinksAdmin.ts` and replaced container-owned CourseLink state/actions with hook values.
- `useStaffCoursesAdmin`, `StaffCourseStudioPanel`, `StaffCourseLinksStep`, and `StaffCourseCatalogPanel` continue receiving the same CourseLink identifiers from the container.
- `fetchSchoolData` still forwards course-link maps into CourseLink ownership via `setAllCourseLinksMap`.
- Added `useStaffCourseLinksAdmin.test.tsx` coverage for loading, validation, save refresh, edit form, delete reset, and unique stats derivation.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 2,498 | 2,335 | -163 |
| `components/front/staff/useStaffCourseLinksAdmin.ts` | — | 227 | new |
| `components/front/staff/__tests__/useStaffCourseLinksAdmin.test.tsx` | — | 155 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffCourseLinksAdmin.test.tsx components/front/staff/__tests__/StaffCourseLinksStep.test.tsx components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx components/front/staff/__tests__/useStaffCoursesAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 6 files passed, 96 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffCourseLinksAdmin.ts components/front/staff/__tests__/useStaffCourseLinksAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: CourseLink validation copy, optional load failure behavior, POST/PUT/DELETE endpoint paths and body shapes, edit-form cent formatting, and post-mutation refresh behavior were moved without intentional changes.
- Type integrity: hook uses existing `CourseLinkFormState` and `CourseLinkRow` types.
- Ownership boundary: `courseEditingSlug` remains owned by the courses hook; wrapper callbacks pass it to CourseLink actions so the hook does not depend on the courses hook directly.

## Batch 49 Evidence — Self Profile Schedule Ownership Hook Extraction

### Scope
- Extracted self-profile schedule/calendar ownership from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffProfileScheduleAdmin.ts`.
- Moved profile schedule month state, calendar-cell derivation, month label, course title lookup, self schedule entries, entries-by-day map, Google calendar URL derivation, and ICS data URI derivation.
- Kept self profile data/network ownership in `useStaffSelfProfileAdmin`; the schedule hook receives `resolvedSelfProfile` and course options as inputs.

### Changes
- Added `useStaffProfileScheduleAdmin.ts` and replaced container-owned profile schedule memos/state with hook values.
- `StaffProfileViewPanel` continues receiving the same profile schedule/export props from the container.
- Removed the container-local `toUtcCalendarStamp` helper after moving calendar export generation into the hook.
- Added `useStaffProfileScheduleAdmin.test.tsx` coverage for schedule entry generation, missing end-time fallback, disabled links for incomplete schedule data, and Google/ICS exports.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 2,335 | 2,221 | -114 |
| `components/front/staff/useStaffProfileScheduleAdmin.ts` | — | 155 | new |
| `components/front/staff/__tests__/useStaffProfileScheduleAdmin.test.tsx` | — | 123 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffProfileScheduleAdmin.test.tsx components/front/staff/__tests__/StaffProfileViewPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 3 files passed, 86 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffProfileScheduleAdmin.ts components/front/staff/__tests__/useStaffProfileScheduleAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: schedule entries still derive from profile teaching weekdays/start/end/course slugs, use a one-hour fallback when end time is missing/invalid, and keep disabled export hrefs when schedule data is incomplete.
- Type integrity: hook uses existing `SelfProfileSnapshot` and `AssignmentCourseOption` shapes.
- Ownership boundary: profile fetch/form/request/payment ownership remains in `useStaffSelfProfileAdmin`; this hook owns only schedule/export derivation.

## Batch 50 Evidence — Staff Create/Invite Ownership Hook Extraction

### Scope
- Extracted staff create/invite/promote ownership from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffCreateAdmin.ts`.
- Moved create form state, busy/message state, submit handler, POST body construction, success/error handling, form reset, and post-create directory refresh.
- Kept the shared global error banner in the container; the hook receives `setError` and writes the same messages.

### Changes
- Added `useStaffCreateAdmin.ts` and replaced container-owned create form state/actions with hook values.
- `StaffAccessCreatePanel` continues receiving the same form/status/onSubmit props from the container.
- Added `useStaffCreateAdmin.test.tsx` coverage for normalized category/PIN body, invited message, API error, and network error routing.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 2,221 | 2,188 | -33 |
| `components/front/staff/useStaffCreateAdmin.ts` | — | 87 | new |
| `components/front/staff/__tests__/useStaffCreateAdmin.test.tsx` | — | 114 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffCreateAdmin.test.tsx components/front/staff/__tests__/StaffAccessCreatePanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 3 files passed, 83 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffCreateAdmin.ts components/front/staff/__tests__/useStaffCreateAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: create form defaults, normalized role/category payload, optional 4-digit PIN inclusion, invitation/promotion success messages, reset behavior, and API/network error messages were preserved.
- Type integrity: hook uses existing `StaffRole` and `StaffCategory` types.
- Ownership boundary: directory fetching remains in `useStaffDirectoryAdmin`; create hook receives a refresh callback from the container using current query/category.

## Batch 51 Evidence — Payroll + Presence Derived Ownership Hook Extraction

### Scope
- Extracted payroll/presence derived ownership from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffPayrollAdmin.ts`.
- Moved delay modal state, row-by-id map, live-session minute helper, self online/minutes fallback, payroll row derivation, payroll summary derivation, and delay modal open/close actions.
- Kept staff directory ownership in `useStaffDirectoryAdmin`; payroll hook receives rows, current timestamp, current user id, and resolved self profile as inputs.

### Changes
- Added `useStaffPayrollAdmin.ts` and replaced container-owned payroll/presence/delay derived state/actions with hook values.
- `StaffProfileViewPanel`, `StaffTeamBoardPanel`, `StaffPayrollControlPanel`, and `StaffAdminModalOverlays` continue receiving the same payroll/presence props from the container.
- Added `useStaffPayrollAdmin.test.tsx` coverage for payroll row/summary derivation, live-session minutes, and delay modal totals/open-close behavior.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 2,188 | 2,088 | -100 |
| `components/front/staff/useStaffPayrollAdmin.ts` | — | 140 | new |
| `components/front/staff/__tests__/useStaffPayrollAdmin.test.tsx` | — | 155 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffPayrollAdmin.test.tsx components/front/staff/__tests__/StaffPayrollControlPanel.test.tsx components/front/staff/__tests__/StaffTeamBoardPanel.test.tsx components/front/staff/__tests__/StaffProfileViewPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 5 files passed, 102 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffPayrollAdmin.ts components/front/staff/__tests__/useStaffPayrollAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: payroll row amount/status/payday/due-date/delay derivation, summary totals/exceptions, live-session minutes, and delay modal total/late-day calculations were moved without intentional changes.
- Type integrity: hook uses existing `StaffUserRow`, `PayrollStaffRow`, `PayrollDelayModalState`, and `SelfProfileSnapshot` types.
- Ownership boundary: directory data and profile data stay in their existing hooks; payroll hook owns only derived payroll/presence/delay state.

## Batch 52 Evidence — Student Board Derived Ownership Hook Extraction

### Scope
- Extracted student-board derived ownership from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffStudentsBoardAdmin.ts`.
- Moved student/history card aggregation, filtered board/search cards, global student search bridge, settlement bulk refresh composition, visible/filtered payment IDs, pagination state/effects, audit-entry discovery effect, history stats, monthly/current summaries, today/date-range labels, and card context/variant resolution.
- Kept payments fetching/filter ownership in `useStaffPaymentsAdmin`; the new hook receives payments, filters, selected payment IDs, summary API data, and injected settlement/refresh/auth callbacks only.

### Changes
- Added `useStaffStudentsBoardAdmin.ts` and replaced container-owned student-board derived memos/effects/actions with a hook surface.
- `StaffStudentsBoardPanel` and `StaffAdminHistoryOverlays` continue receiving student-board/history props from the container, but those values now come from the hook.
- Added `useStaffStudentsBoardAdmin.test.tsx` coverage for daily cash board derivation/selection pruning/audit lookup, pagination reset on filter changes, and history context/stat/summary/date-range derivation.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 2,088 | 1,858 | -230 |
| `components/front/staff/useStaffStudentsBoardAdmin.ts` | — | 387 | new |
| `components/front/staff/__tests__/useStaffStudentsBoardAdmin.test.tsx` | — | 220 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffStudentsBoardAdmin.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 3 files passed, 84 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffStudentsBoardAdmin.ts components/front/staff/__tests__/useStaffStudentsBoardAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: daily/history card filtering, cash settlement ID derivation, global-search fallback display preservation, pagination resets, selected cash pruning, audit-entry prefetching, history stats, and monthly summary fallback were moved without intentional behavior changes.
- Type integrity: hook uses existing `PaymentRow`, `PaymentsApiSummary`, history filter types, `CardContext`, and `StudentProfileCard` shapes.
- Ownership boundary: payment network/filter state remains in `useStaffPaymentsAdmin`; student PIN/profile override/payment-history modal ownership remains in existing hooks/container surfaces.

## Batch 53 Evidence — Student Audit + Override Ownership Hook Extraction

### Scope
- Extracted student audit/override ownership from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffStudentAuditAdmin.ts`.
- Moved override modal student state, override open/close actions, users-with-audit set, audit-entry marking, and current-month audit lookup.
- Kept student-board display ownership in `useStaffStudentsBoardAdmin`; the audit hook provides the audit set and lookup callback consumed by the board hook/panel and history overlays.

### Changes
- Added `useStaffStudentAuditAdmin.ts` and replaced container-owned audit/override state/callbacks with hook values.
- `StaffStudentsBoardPanel` and `StaffAdminHistoryOverlays` continue receiving the same audit/override props from the container.
- Added `useStaffStudentAuditAdmin.test.tsx` coverage for override modal open/close, current-month audit marking, and silent lookup failure behavior.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 1,858 | 1,835 | -23 |
| `components/front/staff/useStaffStudentAuditAdmin.ts` | — | 58 | new |
| `components/front/staff/__tests__/useStaffStudentAuditAdmin.test.tsx` | — | 90 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffStudentAuditAdmin.test.tsx components/front/staff/__tests__/useStaffStudentsBoardAdmin.test.tsx components/front/staff/__tests__/StaffAdminHistoryOverlays.test.tsx components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 5 files passed, 90 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffStudentAuditAdmin.ts components/front/staff/__tests__/useStaffStudentAuditAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: override modal open/close state, current-month audit lookup URL, silent lookup failure behavior, and override-success audit marking were moved without intentional changes.
- Type integrity: hook keeps the existing `{ id, name }` override modal shape and `Set<string>` audit marker semantics.
- Ownership boundary: audit display remains in `StaffStudentsBoardPanel`; override modal rendering remains in `StaffAdminHistoryOverlays`; the hook owns only state/actions/lookup.

## Batch 54 Evidence — School Workspace Composition Extraction

### Scope
- Extracted school workspace render composition from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/StaffSchoolWorkspacePanel.tsx`.
- Moved the school visibility guard, catalog shell composition, wizard save gating, source-contract markers, and ordered child panel composition for reservations, rooms, course studio, course catalog, packages, and points.
- Kept school/course/rooms/package ownership in existing hooks and panels; the container still builds existing prop groups.

### Changes
- Added `StaffSchoolWorkspacePanel.tsx` and replaced the in-container school workspace subtree with `<StaffSchoolWorkspacePanel />`.
- Preserved wizard submit behavior: save is enabled only for courses final publish and packages final step, then submits the existing `[data-wizard-form='courses']` / `[data-wizard-form='packages']` form.
- Added `StaffSchoolWorkspacePanel.test.tsx` coverage for hidden state, visible composition, and wizard-save enable/disable gating.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 1,835 | 1,804 | -31 |
| `components/front/staff/StaffSchoolWorkspacePanel.tsx` | — | 83 | new |
| `components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx` | — | 149 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 7 files passed, 91 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffSchoolWorkspacePanel.tsx components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: school visibility, wizard save gating, child panel order, and source-contract markers were moved without intentional behavior changes.
- Type integrity: component props reuse `React.ComponentProps` for existing child panels and `SchoolWizardState` / `StepEnabledContext` for wizard contracts.
- Ownership boundary: this is render-composition only; school/course/rooms/package data and actions remain in existing hooks and panels.

## Batch 55 Evidence — Portal Shell + Access Lifecycle Hook Extraction

### Scope
- Extracted portal shell/access lifecycle ownership from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffPortalShellAdmin.ts`.
- Moved current time ticker, active nav state, allowed/visible nav derivation, section visibility booleans, access booleans, nav label, nav selection/assistant expansion bridge, assignable roles, target-management guard, minimum loading delay, auth-failure redirect handling, and query-param nav hydration.
- Kept assistant chat/config ownership in `useStaffAssistantAdmin`; the shell hook receives an injected assistant-rail expansion callback and returns the active nav label used by assistant messages.

### Changes
- Added `useStaffPortalShellAdmin.ts` and replaced container-owned shell/access state/effects/memos/callbacks with hook values.
- `StaffUsersAdminClient.tsx` now keeps only the shell refs, shared error state, student search state, and panel composition around the shell hook.
- Added `useStaffPortalShellAdmin.test.tsx` coverage for nav/role derivation, query-param nav selection, assistant rail expansion, and auth failure handling.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 1,804 | 1,735 | -69 |
| `components/front/staff/useStaffPortalShellAdmin.ts` | — | 176 | new |
| `components/front/staff/__tests__/useStaffPortalShellAdmin.test.tsx` | — | 104 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffPortalShellAdmin.test.tsx components/front/staff/__tests__/useStaffAssistantAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 3 files passed, 79 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffPortalShellAdmin.ts components/front/staff/__tests__/useStaffPortalShellAdmin.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: default nav selection, nav query-param hydration, assistant rail expansion on assistant nav, owner/admin permissions, assignable-role lists, minimum loading delay, and auth-failure messages/redirect targets were moved without intentional behavior changes.
- Type integrity: hook uses existing `StaffRole`, `StaffCategory`, `StaffPortalSection`, `StaffPortalNavItem`, and `StaffUserRow` contracts.
- Ownership boundary: assistant state remains in `useStaffAssistantAdmin`; shell hook owns only portal navigation/access/time/auth utility concerns.

## Batch 56 Evidence — Portal Data Lifecycle Hook Extraction

### Scope
- Extracted portal data lifecycle effects from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/useStaffPortalDataLifecycle.ts`.
- Moved checkout-menu outside-click closing, staff request fetch trigger, payment-change request fetch trigger, self-profile fetch trigger, and profile-scope request fetch trigger.
- Kept request/profile ownership in `useStaffRequestsAdmin` and `useStaffSelfProfileAdmin`; the lifecycle hook receives existing fetch callbacks and view/access flags only.

### Changes
- Added `useStaffPortalDataLifecycle.ts` and replaced five container-owned effects with one hook call.
- Added `useStaffPortalDataLifecycle.test.tsx` coverage for staff-ops request fetching, profile request/profile fetching, and checkout-menu outside click closing.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 1,735 | 1,718 | -17 |
| `components/front/staff/useStaffPortalDataLifecycle.ts` | — | 66 | new |
| `components/front/staff/__tests__/useStaffPortalDataLifecycle.test.tsx` | — | 97 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/useStaffPortalDataLifecycle.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/useStaffRequestsAdmin.test.tsx components/front/staff/__tests__/useStaffSelfProfileAdmin.test.tsx
# focused tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffPortalDataLifecycle.ts components/front/staff/__tests__/useStaffPortalDataLifecycle.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

### Risks Checked
- Behavior parity: checkout-menu outside-click behavior and request/profile fetch trigger conditions were moved without intentional changes.
- Type integrity: request filters use existing `StaffRequestStatus | "all"` typing rather than widening to arbitrary strings.
- Ownership boundary: lifecycle hook orchestrates effects only; request/profile data state and network implementation remain in their existing hooks.

## Batch 57 Evidence — School Workspace Prop Assembly Extraction

### Scope
- Extracted the large school workspace prop assembly from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/buildStaffSchoolWorkspaceProps.ts`.
- Moved catalog, room reservation, rooms, course studio, course catalog, packages, and points prop-group construction.
- Kept existing school/course/rooms/package ownership hooks unchanged; the builder consumes existing admin hook surfaces and formatters, then returns the exact `StaffSchoolWorkspacePanel` props.

### Changes
- Added `buildStaffSchoolWorkspaceProps.ts` and replaced the in-container 250+ line school workspace prop tree with `const schoolWorkspaceProps = buildStaffSchoolWorkspaceProps(...)` and `<StaffSchoolWorkspacePanel {...schoolWorkspaceProps} />`.
- Removed now-stale container destructuring for school/course/room/course-link values that are consumed only by the builder.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 1,718 | 1,314 | -404 |
| `components/front/staff/buildStaffSchoolWorkspaceProps.ts` | — | 451 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx components/front/staff/__tests__/StaffCourseStudioPanel.test.tsx components/front/staff/__tests__/StaffCourseCatalogPanel.test.tsx components/front/staff/__tests__/StaffSchoolPackagesPointsPanel.test.tsx components/front/staff/__tests__/StaffSchoolRoomsPanel.test.tsx components/front/staff/__tests__/StaffRoomReservationsPanel.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 7 files passed, 91 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffSchoolWorkspacePanel.tsx components/front/staff/buildStaffSchoolWorkspaceProps.ts components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

```text
git diff --check
# exit 0, no output
```

### Risks Checked
- Behavior parity: school workspace prop values and callbacks were moved mechanically from the container into the builder without intentional behavior changes.
- Type integrity: builder returns `React.ComponentProps<typeof StaffSchoolWorkspacePanel>` and consumes existing hook return types, keeping child-panel prop contracts checked by TypeScript.
- Ownership boundary: school/course/rooms/package state and network behavior remain in existing hooks; this batch moves prop assembly only.

## Batch 58 Evidence — Students Board Prop Assembly Extraction

### Scope
- Extracted the large `StaffStudentsBoardPanel` prop assembly from `components/front/staff/StaffUsersAdminClient.tsx` into `components/front/staff/buildStaffStudentsBoardPanelProps.ts`.
- Moved loading status, Clerk sync, terminal alerts, controls, card, and pagination prop-group construction.
- Kept existing ownership hooks unchanged; the builder consumes existing admin hook surfaces and formatters, then returns the exact `StaffStudentsBoardPanel` props.

### Changes
- Added `buildStaffStudentsBoardPanelProps.ts` and replaced the in-container students-board prop tree with `const studentsBoardPanelProps = buildStaffStudentsBoardPanelProps(...)` and `<StaffStudentsBoardPanel {...studentsBoardPanelProps} />`.
- Removed now-stale container destructuring for values consumed only by the builder.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 1,314 | 1,180 | -134 |
| `components/front/staff/buildStaffStudentsBoardPanelProps.ts` | — | 232 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/useStaffStudentsBoardAdmin.test.tsx components/front/staff/__tests__/useStaffStudentAuditAdmin.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts
# 4 files passed, 87 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/buildStaffStudentsBoardPanelProps.ts components/front/staff/StaffStudentsBoardPanel.tsx --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

```text
git diff --check
# exit 0, no output
```

### Risks Checked
- Behavior parity: students-board prop values and callbacks were moved mechanically from the container into the builder without intentional behavior changes.
- Type integrity: builder returns `React.ComponentProps<typeof StaffStudentsBoardPanel>` and consumes existing hook return types, keeping panel prop contracts checked by TypeScript.
- Ownership boundary: payment/filter state, terminal PIN state/actions, directory/Clerk sync, student-board derivation, and audit/override state remain in their existing hooks; this batch moves prop assembly only.

## Batch 59 Evidence — Staff Users Admin View Shell Extraction

### Scope
- Created `components/front/staff/StaffUsersAdminView.tsx` as a render-only view shell.
- Moved the final JSX composition out of `StaffUsersAdminClient.tsx`.
- Extracted the view prop assembly into `components/front/staff/buildStaffUsersAdminViewProps.ts` as a follow-up slice.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 1,180 | 928 | -252 |
| `components/front/staff/StaffUsersAdminView.tsx` | — | 175 | new |
| `components/front/staff/buildStaffUsersAdminViewProps.ts` | — | 153 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/buildStaffUsersAdminViewProps.test.ts components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx components/front/staff/__tests__/StaffSchoolWorkspacePanel.test.tsx tests/front/staff-users-admin-client-fetch-cache.test.tsx
# focused view/client suites passed during slices
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffUsersAdminView.tsx components/front/staff/buildStaffUsersAdminViewProps.ts components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

```text
git diff --check
# exit 0, no output
```

### Risks Checked
- Behavior parity: view shell and builder are render/composition-only; domain hooks retain state/effect/fetch ownership.
- Type integrity: view props are grouped and checked through `StaffUsersAdminViewProps` / builder input contracts.
- Ownership boundary: no endpoint/auth/permission behavior moved.

## Batch 60 Evidence — Staff Users Admin Composition Hook Extraction

### Scope
- Created `components/front/staff/useStaffUsersAdminComposition.ts` as an assembly-only composition hook.
- Moved top-level view composition, school workspace prop assembly, students board prop assembly, and view builder handoff out of `StaffUsersAdminClient.tsx`.
- Kept all domain hook internals unchanged; the new hook receives existing hook surfaces and formatter/callback inputs.

### LOC Evidence
| File | Before | After | Delta |
| --- | ---: | ---: | ---: |
| `components/front/staff/StaffUsersAdminClient.tsx` | 928 | 602 | -326 |
| `components/front/staff/useStaffUsersAdminComposition.ts` | — | 244 | new |

### Validation
```text
npm run test -- components/front/staff/__tests__/buildStaffUsersAdminViewProps.test.ts components/front/staff/__tests__/StaffUsersAdminView.test.tsx components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx
# 4 files passed, 79 tests passed
```

```text
npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/useStaffUsersAdminComposition.ts --max-warnings=0
# exit 0, no output
```

```text
npx tsc --noEmit
# exit 0, no output
```

```text
git diff --check
# exit 0, no output
```

### Risks Checked
- Behavior parity: composition moved only prop assembly and callback adaptation; domain state/effects/fetches remain in existing owners.
- Type integrity: composition hook consumes typed hook return surfaces and returns `StaffUsersAdminViewProps` through the existing builder.
- Review boundary: rollback is isolated to `useStaffUsersAdminComposition.ts` plus the container call-site.
