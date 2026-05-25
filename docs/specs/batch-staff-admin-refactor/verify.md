# Verification Gate: batch-staff-admin-refactor

**Current verdict: BLOCK — do not integrate as refactor-complete.**

This branch contains valid preparatory refactor work: pure helpers/types were extracted, the rooms domain now has `useStaffRoomsAdmin`, and the course-builder domain now has `useStaffCoursesAdmin`. However, `StaffUsersAdminClient.tsx` still owns too many domains, state slices, effects, handlers, fetches, and JSX. Treat the current work as a chained refactor batch, not as the completed staff-admin split.

## Current Evidence

Measured on branch `refactor/staff-admin-split` after the `useStaffCoursesAdmin` working-tree slice.

| Metric | Current value | Gate interpretation |
|--------|---------------|---------------------|
| `StaffUsersAdminClient.tsx` LOC | 11,971 | Still a god component; ~15x the directional 800-line target. |
| `React.useState` occurrences | 153 | Improved, but state remains concentrated in the container. |
| `React.useEffect` occurrences | 32 | Improved, but side-effect ownership remains concentrated. |
| `React.useMemo` occurrences | 78 | High derived-state/cognitive surface remains. |
| `React.useCallback` occurrences | 54 | Improved, but many handlers remain inline in the container. |
| `fetch(` call sites | 46 | Improved, but network orchestration remains concentrated. |
| JSX return starts | ~line 5,000+ | Thousands of lines of state/handlers still precede render. |
| `useStaffRoomsAdmin.ts` LOC | 526 | Real bounded-context extraction for rooms only. |
| `useStaffCoursesAdmin.ts` LOC | 1,307 | Real bounded-context extraction for course builder/schedule/media state. |

## Judgment Day Result

Two blind judges reviewed the branch using `solid`, `codebase-cleanup-refactor-clean`, and `judgment-day` criteria.

| Finding | Status | Evidence |
|---------|--------|----------|
| `StaffUsersAdminClient` remains a god component | Confirmed | 11,971 LOC, 153 `useState`, 32 `useEffect`, 54 `useCallback`, 46 `fetch(`. |
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
npm run build
# build passed; warnings remain in unrelated/baseline files
```

These commands support behavior preservation for the current slices. They do **not** prove the refactor is complete.

## Latest Slice Gate Result

`useStaffCoursesAdmin` was extracted as the next measurable bounded-context slice.

| Metric | Required improvement | Actual improvement | Result |
|--------|----------------------|--------------------|--------|
| `StaffUsersAdminClient.tsx` LOC | -800 to -1,500 lines | -1,048 lines | ✅ Met |
| Container `useState` | at least -10 | -26 | ✅ Met |
| Container `fetch(` | at least -5 | -4 | ⚠️ Slight miss; CourseLink/consecutive no-touch boundary kept link fetches in container. |
| Container `useCallback` | at least -10 | -21 | ✅ Met |
| Tests | behavior tests for extracted hook/helpers | `useStaffCoursesAdmin.test.tsx` covers schedule-slot state transitions and slug-conflict suggestion flow. | ✅ Met |

## Next Required Slice

Implement one more measurable bounded-context extraction before any integration-complete claim.

Recommended next target: **payments/admin or residual school package/points context**.

Move real ownership out of the container:

- payment query state, payment summary loading, bulk settlement actions, checkout menu state, and related fetches; or
- residual school package/points state and handlers, while keeping CourseLink/consecutive as an explicit no-touch slice unless separately approved.

## Numeric Exit Gate for the Next Slice

The next slice should meet all of these before review:

| Metric | Required improvement |
|--------|----------------------|
| `StaffUsersAdminClient.tsx` LOC | -800 to -1,500 lines |
| Container `useState` | at least -10 |
| Container `fetch(` | at least -5 |
| Container `useCallback` | at least -10 |
| Tests | behavior tests for extracted hook/helpers; avoid adding source-string-only coverage |

## Final Gate

Do not integrate this branch as refactor-complete until:

1. at least one more high-density domain hook/reducer is extracted,
2. this report is regenerated with fresh metrics,
3. Judgment Day is rerun, and
4. the branch is framed honestly as either a batch in a chain or a verified complete refactor.

**Current terminal judgment: BLOCK / ESCALATED.**
