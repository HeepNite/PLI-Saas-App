# Design: batch-staff-admin-refactor

## Intent
Refactor staff-admin frontend code for maintainability and cognitive-load reduction while preserving behavior, contracts, and security boundaries.

## Architecture Approach

### 1) Target End-State Around `StaffUsersAdminClient` (<=800 Direction)
- `StaffUsersAdminClient.tsx`: container shell only (auth/permissions, section orchestration, navigation state, API-side effect orchestration).
- Domain hooks: `useStaffRoomsAdmin`, `useStaffProfileAdmin`, `useStaffCatalogAdmin` (state/effects per domain, typed outputs).
- Presentational sections: `StaffRoomsSection`, `StaffProfileSection`, `StaffCatalogSection`, nav/rail sections.
- Pure helpers: formatting, transforms, options/state builders (`payment*`, room catalog/state helpers, constants) with no React imports.

### 2) Re-export Seams (Compatibility Layer)
- Introduce temporary re-export seams from `StaffUsersAdminClient` for helpers currently imported by tests.
- Migrate direct imports to new modules incrementally per slice.
- Remove seam only after all dependent tests/imports are moved and validated.

### 2.1) Compat/Test Migration Plan
1. Keep existing helper re-exports while extractions land.
2. Update tests to import from dedicated helper modules in the same batch where feasible.
3. Keep re-exports for one additional green batch as rollback cushion.
4. Remove re-exports in a dedicated compatibility cleanup batch with focused helper/test suite validation.

### 3) Dependency Direction
- `Container` → `Domain Hooks` → `Pure Helpers`.
- Presentational sections depend on props/contracts only, not on fetch/side-effect internals.
- Pure helpers must not import React/UI code.

### 4) Validation Strategy
- Slice-level focused checks: eslint, targeted tests, and type checks where extraction affects types.
- Track baseline known failures (source-string brittleness) separately from new regressions.
- Require no net-new targeted failures before moving to next slice.

### 5) Cleanup Policy (Explicit)
- Unused imports/exports/types/constants: delete only with evidence (`grep` + lint/tsc + tests).
- Dead JSX branches: delete only when unreachable logic is proven and role/permission behavior is preserved.
- Stale tests/source-string tests: prefer conversion to behavior assertions; if risky/out-of-scope, keep and report debt.
- If evidence is ambiguous: do not delete; log in roadmap/tasks as deferred cleanup.

### 6) Logic Simplification Policy
- Prefer early returns over nested `if` trees.
- Use typed field updaters for repeated form state writes where readability improves.
- Do not introduce abstractions that hide domain meaning.
- No mega-utils; helpers must stay feature-cohesive.

### 7) Architecture Lock Guardrails (Batch 4)
- `StaffUsersAdminClient.tsx` remains the orchestration shell: permissions, active section routing, and side-effect workflow coordination.
- Extracted section components (`StaffRoomReservationList`, `StaffRoomReservationForm`, `StaffProfilePaymentSection`, `StaffProfileRequestsSection`, `StaffCatalogSection`) stay presentational and must not own network side effects.
- Extracted helper modules (`paymentState`, `paymentTimelineTransforms`, `studentPaymentCardFormatters`, `staffRoomCatalogHelpers`, `staffRoomFormState`) remain React-free and deterministic.
- Any new helper introduced during cleanup must be domain-scoped and justified by direct architecture-lock support.

## Constraints
- Preserve existing endpoint usage, auth/permission behavior, validation semantics, and user workflows.
- Keep changes localized; avoid unrelated refactors.
- Dead-code deletion allowed only with objective unused proof (grep/tsc/eslint/tests).

## What NOT To Do
- Do **not** ship product behavior changes under the refactor label.
- Do **not** introduce giant catch-all `utils` modules that recreate monolith coupling.
- Do **not** perform nested-if/control-flow churn without protective tests for touched behavior.
- Do **not** modify consecutive-course-link internals in this batch.

## Current-State Summary (Completed Slices)
Completed and considered baseline for next apply batch:
- `paymentState`
- `paymentTimelineTransforms`
- `studentPaymentCardFormatters`
- `StaffPortalNavButton`
- `StaffAssistantRightRail`
- `staffAdminConstants`
- `staffRoomCatalogHelpers`
- `staffRoomFormState`
- room reservation time option simplification
- typed reservation field updater
- `StaffRoomReservationForm`
- brittle rooms lifecycle test fixed
- evidence-gated dead-code cleanup

## Remaining Architecture Map (Execution Order)
1. Container-shell hardening + compat map.
2. Rooms domain hook + section seam hardening.
3. Profile/settings extraction.
4. Catalog shell extraction (consecutive internals excluded).
5. Compat re-export migration/removal.
6. Final evidence-gated cleanup + documentation.

## Rollback Strategy
- Each slice remains independently revertible.
- Keep compatibility seams until next slice is green.
- If a slice introduces unstable tests, revert that slice only and preserve prior green baseline.
