# Roadmap: batch-staff-admin-refactor

## Current State (Completed Slices)
- `paymentState`
- `paymentTimelineTransforms`
- `studentPaymentCardFormatters`
- `StaffPortalNavButton`
- `StaffAssistantRightRail`
- `staffAdminConstants`
- `staffRoomCatalogHelpers`
- `staffRoomFormState`
- Room reservation time option simplification (`ROOM_RESERVATION_TIME_OPTIONS`)
- Typed reservation field updater (`updateRoomReservationFormField`)
- `StaffRoomReservationForm`
- Brittle rooms lifecycle test fixed
- Evidence-gated dead-code cleanup completed for proven unused items

## Target Architecture (Toward `StaffUsersAdminClient.tsx` <=800)
1. **Container shell**: orchestration only (permissions, active section, API workflow wiring).
2. **Domain hooks**: side-effect/state domains (`useStaffRoomsAdmin`, `useStaffProfileAdmin`, `useStaffCatalogAdmin`).
3. **Presentational sections**: pure prop-driven JSX sections with no side effects.
4. **Pure helpers**: transforms/formatters/constants/state factories with no React imports.
5. **Compat migration**: temporary test/helper re-exports retained, then removed in dedicated compatibility cleanup batch.

## Architecture Lock Guardrails (Final)
- `StaffUsersAdminClient.tsx` is the orchestration shell only; it coordinates permissions, section state, and side-effect workflow wiring.
- Presentational modules (`StaffRoomReservationList`, `StaffRoomReservationForm`, `StaffProfilePaymentSection`, `StaffProfileRequestsSection`, `StaffCatalogSection`) remain prop-driven UI boundaries and do not own API side effects.
- Pure helper modules (`paymentState`, `paymentTimelineTransforms`, `studentPaymentCardFormatters`, `staffRoomCatalogHelpers`, `staffRoomFormState`) must remain deterministic and React-free.
- Cleanup deletions require objective proof (search + lint/tsc + focused tests) and should remain localized to staff-admin refactor touchpoints.

## Batch Plan (auto-chain, feature-branch-chain)

### Batch 1 — Container Boundary + Rooms Domain Hardening
- **Objective**: lock shell boundaries and complete room-domain separation without behavior drift.
- **Slices (3)**:
  1) container boundary map + props contract tightening,
  2) rooms hook seam hardening,
  3) room lifecycle test stabilization (behavior assertions first).
- **Files/Modules expected**:
  - `components/front/staff/StaffUsersAdminClient.tsx`
  - `components/front/staff/StaffRoomReservationForm.tsx`
  - `components/front/staff/staffRoomCatalogHelpers.ts`
  - `components/front/staff/staffRoomFormState.ts`
  - `tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx`
- **Review budget**: max ~320 changed lines.
- **Validation commands**:
  - `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffRoomReservationForm.tsx`
  - `npx vitest run tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx tests/front/staff-users-admin-client-fetch-cache.test.tsx`
- **Rollback boundary**: revert Batch 1 commits only; preserve prior helper extractions.
- **Suggested commit messages**:
  - `refactor(staff-admin): harden rooms container boundaries`
  - `test(staff-admin): stabilize rooms lifecycle assertions`

### Batch 1 Progress (apply)
- ✅ Extracted current/upcoming reservation list rendering into `StaffRoomReservationList.tsx` presentational component.
- ✅ Kept API calls, validation, permission checks, and reservation state ownership in `StaffUsersAdminClient.tsx`.
- ✅ Simplified assigned-staff label lookup for reservation rows via memoized id→label map in container.
- ✅ Updated rooms lifecycle source-contract test to assert reservation-form/list markers from extracted modules while preserving endpoint/callback assertions in container.
- 🔲 Additional proven dead/stale room-specific deletion deferred (no conclusive evidence in this batch).

### Batch 2 — Profile/Settings + Catalog Presentational Split
- **Objective**: remove major JSX weight from container by extracting profile/settings and catalog shells.
- **Slices (4)**:
  1) profile payment section component,
  2) profile request section component,
  3) catalog shell extraction,
  4) no-touch guard for consecutive-link internals.
- **Files/Modules expected**:
  - `components/front/staff/StaffUsersAdminClient.tsx`
  - `components/front/staff/StaffProfileSection.tsx` (new)
  - `components/front/staff/StaffCatalogSection.tsx` (new)
  - `components/front/staff/__tests__/StaffUsersAdminClient.test.ts`
- **Review budget**: max ~380 changed lines.
- **Validation commands**:
  - `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/StaffProfileSection.tsx components/front/staff/StaffCatalogSection.tsx`
  - `npx vitest run components/front/staff/__tests__/StaffUsersAdminClient.test.ts -t "profile|payment|request|school|course|package|points"`
- **Rollback boundary**: revert Batch 2 branch/commits; Batch 1 remains valid.
- **Suggested commit messages**:
  - `refactor(staff-admin): extract profile settings sections`
  - `refactor(staff-admin): extract catalog presentational shell`

### Batch 2 Progress (apply)
- ✅ Added `StaffProfilePaymentSection.tsx` and moved the profile payment section shell boundary there while keeping the existing payment form behavior (fields, copy, classes, submit flow) in the container via children.
- ✅ Added `StaffProfileRequestsSection.tsx` and moved profile requests two-column layout boundary out of container.
- ✅ Added `StaffCatalogSection.tsx` and moved school builder header/KPI shell there while keeping `SchoolWizardPanel` and downstream school flows in `StaffUsersAdminClient.tsx`.
- ✅ Preserved no-touch boundary for consecutive-course-link internals (no functional edits in that domain).

### Batch 3 — Compat Re-export Migration + Test Contract Cleanup
- **Objective**: migrate tests/imports to dedicated modules and shrink temporary seam surface.
- **Slices (3)**:
  1) helper import path migration in tests,
  2) controlled re-export removal from container,
  3) brittle source-string test cleanup where safe.
- **Files/Modules expected**:
  - `components/front/staff/StaffUsersAdminClient.tsx`
  - `components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts`
  - `components/front/staff/__tests__/StaffUsersAdminClient.test.ts`
  - `tests/front/staff-users-admin-client-fetch-cache.test.tsx`
- **Review budget**: max ~260 changed lines.
- **Validation commands**:
  - `npx vitest run components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts components/front/staff/__tests__/StaffUsersAdminClient.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx`
  - `npx tsc --noEmit`
- **Rollback boundary**: revert seam-removal commits; keep migrated helpers and sections.
- **Suggested commit messages**:
  - `refactor(staff-admin): migrate helper test imports to dedicated modules`
  - `chore(staff-admin): remove temporary helper re-exports`

### Batch 3 Progress (apply)
- ✅ Migrated helper imports in `StaffUsersAdminClient.helpers.test.ts` from container compatibility seams to `studentPaymentCardFormatters`.
- ✅ Split `StaffUsersAdminClient.test.ts` imports so extracted helper contracts now come from domain modules (`paymentState`, `paymentTimelineTransforms`, `studentPaymentCardFormatters`, `staffRoomCatalogHelpers`) while container-only helpers still import from `StaffUsersAdminClient`.
- ✅ Removed compatibility re-export blocks from `StaffUsersAdminClient.tsx` for extracted helper modules after verifying no remaining named imports rely on those seams.
- ✅ Left brittle source-string fetch-cache test strategy unchanged because Batch 3 did not require source-contract rewrites.

### Batch 4 — Final Evidence-Gated Cleanup + Architecture Lock
- **Objective**: perform remaining proven deletions, simplify logic, and finalize docs/verification.
- **Slices (2)**:
  1) evidence-backed dead code and dead JSX cleanup,
  2) final architecture verification and docs refresh.
- **Files/Modules expected**:
  - `components/front/staff/StaffUsersAdminClient.tsx`
  - `components/front/staff/**/*.ts*` (only proven-unused touchpoints)
  - `docs/specs/batch-staff-admin-refactor/*.md`
- **Review budget**: max ~220 changed lines.
- **Validation commands**:
  - `npx eslint components/front/staff/StaffUsersAdminClient.tsx components/front/staff/*.ts components/front/staff/*.tsx`
  - `npx vitest run components/front/staff/__tests__/StaffUsersAdminClient.helpers.test.ts tests/front/staff-users-admin-client-fetch-cache.test.tsx tests/front/staff-users-admin-client-rooms-lifecycle.test.tsx`
  - `npx tsc --noEmit`
- **Rollback boundary**: revert Batch 4 only; prior extraction architecture remains intact.
- **Suggested commit messages**:
  - `chore(staff-admin): remove proven unused staff-admin code`
  - `docs(spec): finalize batch staff-admin refactor roadmap`

### Batch 4 Progress (apply)
- ✅ Removed one proven-unused import in a staff-admin module (`Image` import from `StaffTerminalShell.tsx`) backed by ESLint evidence (`@typescript-eslint/no-unused-vars`).
- ✅ Kept cleanup scope localized and behavior-preserving; no broad extraction or product contract changes introduced.
- ✅ Locked architecture guardrails in spec docs for container/orchestration boundaries, presentational boundaries, and pure helper boundaries.
- ✅ Re-ran required local validation set for Batch 4 and reported baseline warnings/errors separately from new regressions.

## Explicit Cleanup Policy
- Delete unused imports/exports/types/constants only with evidence from search + static checks + targeted tests.
- Delete dead JSX branches only when role/permission/runtime behavior is proven unchanged.
- Update or remove stale source-string tests only if behavior coverage remains; otherwise leave and report debt.
- If proof is inconclusive, do not delete in this change.

## Logic Simplification Policy
- Prefer early returns over nested branching.
- Use typed field updaters/helpers where repetition is materially reduced.
- Avoid abstraction that hides meaning.
- No mega-utils; modules must remain domain-owned.

## Workload & Risk Forecast
- Total expected remaining changes: ~1,180 lines across 4 chained PRs.
- 400-line single-PR budget risk: **High** (mitigated by chain plan).
- Highest risks: brittle source-string tests and hidden cross-section coupling in monolith leftovers.
- Primary mitigation: keep compat seams until validation is green, then remove in dedicated batch.
