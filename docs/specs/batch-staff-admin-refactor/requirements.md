# Requirements: batch-staff-admin-refactor

## Scope
- Plan a behavior-preserving frontend refactor for `components/front/staff/StaffUsersAdminClient.tsx` and tightly coupled staff-admin modules/tests.
- Deliver work as larger executable batches (2–5 coherent slices each), reviewable and preferably below ~400 changed lines per batch.

## Non-Goals
- No product behavior changes (UI outcomes, permissions, network contracts, payload semantics, navigation flows).
- No new endpoints, schema changes, or domain renames.
- No refactor of active consecutive-course-link internals in this change.

## Requirements

### R1 — Behavior Preservation
1. Refactor must preserve user-visible behavior and existing staff permission gating.
2. Existing API calls, HTTP methods, headers/options, and validation semantics must remain equivalent.
3. Any wording-only changes that break brittle source-string tests must be treated as regressions unless explicitly re-baselined and documented.

### R2 — Extraction Boundaries
1. Split monolithic responsibilities into cohesive modules/components/hooks with explicit interfaces.
2. Keep extraction incremental and reversible by slice (no big-bang rewrite).
3. Maintain temporary compatibility seams (re-exports/adapters) where required to avoid broad test churn in a single slice.
4. Target architecture must converge to:
   - container shell (`StaffUsersAdminClient`) for orchestration,
   - domain hooks for side-effect domains,
   - presentational sections for JSX-heavy blocks,
   - pure helpers for deterministic transforms/state builders.

### R3 — Dead Code Cleanup Constraint
1. Dead/unused code may be removed only when proven unused by objective evidence from one or more of: search (`grep`), TypeScript (`tsc`), ESLint, and tests.
2. Deletions must be localized to the active slice and validated by focused commands.
3. Do not remove code based on assumption or style preference alone.
4. Cleanup scope includes unused imports/exports/types/constants, dead JSX branches, and stale tests/source-string tests only when replacement coverage exists.

### R4 — Size and Reviewability Direction
1. Component-size target is directional: components should trend toward `<800` lines over the batch.
2. `<800` is not a hard single-PR gate; intermediate slices may remain above target while moving toward it.
3. Slices should favor cognitive-load reduction (clear responsibility boundaries, reduced nesting, smaller local scope).
4. Refactors must avoid mega-utils; ownership must remain domain-cohesive.

### R6 — Logic Simplification Policy
1. Prefer early returns over nested conditionals when behavior remains equivalent.
2. Introduce typed field updaters/helpers only when they remove meaningful repetition and improve local readability.
3. Do not abstract simple, single-use logic if abstraction hides intent.
4. Shared helpers must stay scoped by domain (no catch-all utility sinks).

### R7 — Cleanup Decision Rule (Delete vs Report)
1. Delete when unused evidence is conclusive and targeted validations are green.
2. Leave in place and report when evidence is ambiguous, behavior risk is non-trivial, or tests are brittle and not safely rebased in the same batch.
3. For stale string-based tests, prefer behavior-oriented assertions when updated in-scope; otherwise document as known debt.

### R5 — Validation and Baseline Discipline
1. Each slice must define and run focused validation commands.
2. Pre-existing failures in baseline tests must be documented and distinguished from newly introduced regressions.
3. Refactor completion requires no new failing checks in targeted validations.

## Acceptance Criteria
1. Requirements, design, and tasks artifacts exist under `docs/specs/batch-staff-admin-refactor/`.
2. Current-state summary records completed slices: `paymentState`, `paymentTimelineTransforms`, `studentPaymentCardFormatters`, `StaffPortalNavButton`, `StaffAssistantRightRail`, `staffAdminConstants`, `staffRoomCatalogHelpers`, `staffRoomFormState`, reservation time option simplification, typed reservation field updater, `StaffRoomReservationForm`, brittle rooms lifecycle test fix, and evidence-gated dead-code cleanup.
3. Design defines migration plan for test/compat re-exports and eventual seam removal.
4. Tasks include review workload forecast with explicit 400-line risk and `feature-branch-chain` strategy under `auto-chain` delivery.
5. Cleanup and logic-simplification policies are explicit and executable.
6. `roadmap.md` exists with batch-level objectives, validation, rollback boundaries, and suggested commit messages.

## Scenarios

### Scenario 1: Behavior-preserving helper extraction
- **Given** helper logic currently exported from `StaffUsersAdminClient.tsx`
- **When** helper logic is moved behind dedicated modules with temporary re-export seams
- **Then** helper tests and dependent imports continue to pass without behavior changes.

### Scenario 2: Dead-code cleanup proof gate
- **Given** an allegedly unused variable/function
- **When** cleanup is proposed
- **Then** removal is allowed only after objective evidence from grep/tsc/eslint/tests confirms no runtime or compile-time usage.

### Scenario 3: Incremental size reduction
- **Given** the current monolithic component exceeds target size
- **When** extraction slices are executed
- **Then** responsibility boundaries improve and resulting components trend toward `<800` lines across the batch, without requiring one-shot compliance.

### Scenario 4: Baseline failure handling
- **Given** known pre-existing failing source-string assertions
- **When** a slice validation runs
- **Then** those failures are documented as baseline unless worsened, and any new failures are treated as regressions to fix before merge.
