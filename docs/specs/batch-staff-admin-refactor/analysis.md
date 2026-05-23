## Exploration: batch-staff-admin-refactor

### Current State
- `components/front/staff/StaffUsersAdminClient.tsx` is **15,160 lines** and currently mixes:
  - domain types/contracts,
  - pure helper logic,
  - network/data orchestration,
  - nav/state control,
  - and full JSX for multiple portal sections.
- The file currently has very high local complexity:
  - ~76 `useState` calls,
  - ~42 `useEffect` calls,
  - ~177 memoized callbacks/memos.
- The component already started extraction work for payment/history helpers into:
  - `components/front/staff/paymentState.ts`
  - `components/front/staff/paymentTimelineTransforms.ts`
  - `components/front/staff/studentPaymentCardFormatters.ts`
- Tests are heavily coupled to `StaffUsersAdminClient` as a source-of-truth export and, in some cases, to string literals in source code.

### Affected Areas
- `components/front/staff/StaffUsersAdminClient.tsx` — primary refactor target; currently a monolith.
- `components/front/staff/__tests__/StaffUsersAdminClient.test.ts` — imports many helpers directly from `StaffUsersAdminClient`; will need import-path migration when helpers move.
- `components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts` — helper export contract coupling.
- `tests/front/staff-users-admin-client-fetch-cache.test.tsx` — source-level regression guard for `cache: "no-store"` payroll GETs.
- `tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx` — source-level string assertions for room lifecycle/reservations.
- `app/staff/portal/page.tsx` — entrypoint that mounts the admin client; low-risk but useful smoke point.

### Validation Baseline (before refactor)
- `npx eslint components/front/staff/StaffUsersAdminClient.tsx`
  - Warnings include at least one proven unused variable (`reservationTimezone`) and multiple hook dependency warnings.
- Focused tests run:
  - ✅ `tests/front/staff-users-admin-client-fetch-cache.test.tsx`
  - ✅ `components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts`
  - ❌ `tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx` (2 failing string assertions, including missing `"Range preview:"`)
- Important implication: this branch already has pre-existing failures in source-string-based regression tests; refactor slices must distinguish **baseline failures** from new regressions.

### Candidate Batch Slices (behavior-preserving, <400 changed lines each)

1. **Slice A — Stabilize helper surface and import seams**
   - Scope:
     - move pure helper exports behind dedicated modules (continue current direction),
     - keep `StaffUsersAdminClient` as temporary re-export facade to avoid big test churn in same slice.
   - Why now: reduces coupling and unlocks smaller follow-up slices.
   - Validation:
     - targeted unit tests for helper modules,
     - existing helper tests green.
   - Risk: low.

2. **Slice B — Extract rooms/reservations logic hook + section component (without consecutive links)**
   - Scope:
     - isolate room CRUD/reservation fetch+actions into `useStaffRoomsAdmin` hook,
     - isolate JSX into `StaffRoomsSection` with explicit props.
   - Why: room workflows are already functionally grouped and have dedicated source-level tests.
   - Validation:
     - `tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx` (adjust only if wording-assertions are brittle),
     - run staff API room tests if touched.
   - Risk: medium (source-string tests are brittle).

3. **Slice C — Extract profile/settings section boundaries**
   - Scope:
     - pull profile payment form and profile request form into section components,
     - keep side effects in parent initially (props down), then shrink parent state surface.
   - Why: large JSX-only area with limited cross-section coupling.
   - Validation:
     - focused UI smoke (render + key interactions),
     - no behavior contract changes.
   - Risk: medium-low.

4. **Slice D — Extract school catalog shell excluding consecutive-link flows**
   - Scope:
     - extract school/course/package/points UI shell,
     - **explicitly avoid touching course-link (consecutive) functions and wiring in this batch**.
   - Why: this is the largest remaining chunk, but we need isolation from active consecutive work.
   - Validation:
     - targeted tests around room/catalog helpers,
     - manual smoke for school section navigation.
   - Risk: medium-high due size; must split into micro-slices.

5. **Slice E — Nav orchestration and right-rail cleanup**
   - Scope:
     - extract nav rendering (`renderStaffNavButton`, rail/tabs wrapper) and assistant rail into presentation components,
     - keep behavior/permissions in parent container.
   - Why: reduces top-level cognitive load and makes remaining container orchestration readable.
   - Validation:
     - smoke render by role/category matrix.
   - Risk: medium.

6. **Slice F — Proven dead code cleanup only**
   - Scope:
     - remove only code proven dead by ESLint/TypeScript/search/tests (e.g., unused locals).
   - Why: keep deletion objective evidence-based.
   - Validation:
     - eslint/typecheck + focused tests.
   - Risk: low.

### Areas to Explicitly Avoid in this batch
- Avoid modifying active consecutive-course flows in this dirty worktree:
  - `CourseLink` state and handlers (`loadCourseLinks`, `saveCourseLink`, `toggleCourseLinkActive`, etc.)
  - related JSX blocks in school section.
- No QR-related workflow expansion in this batch (none required for this target scope).

### Risks
- **Brittle source-string tests** can fail on wording/move-only changes even when behavior is preserved.
- Monolithic state sharing means naive extraction can create prop drilling explosions; hooks must define cohesive state boundaries.
- Existing dirty-worktree edits in the same file increase merge/conflict risk; slices must stay narrow and sequential.

### Recommendation
- Use a **chained batch strategy**: start with helper surface stabilization, then section-by-section extraction with dedicated validation per slice.
- Keep each PR slice under ~400 changed lines and maintain a running baseline note for existing failing tests.
- Defer consecutive-link internals to a separate change to avoid collision with active work.

### Recommended Next Phases
1. **sdd-propose** — lock scope boundaries and non-goals (especially consecutive exclusion).
2. **sdd-spec** — define behavior-preserving acceptance criteria per slice and explicit validation matrix.
3. **sdd-tasks** — produce chained implementation tasks with line-budget forecast and rollback points.
