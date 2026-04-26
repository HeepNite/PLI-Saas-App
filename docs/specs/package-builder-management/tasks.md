# package-builder-management - Tasks

## Phase 1 - Analysis And Contract Mapping

- [x] inspect the current package builder UI, package persistence model, and public package visibility path
- [x] identify every backend and frontend reference to `cadencia`
- [ ] identify every backend and frontend branch where `0` is treated as a sentinel, placeholder, or implicit business flag
- [ ] list the current package-to-course association shape and where reassignment vs duplication is handled today
- [ ] identify all surfaces that read package status/availability for checkout, enrollment, or admin management

## Phase 2 - Schema And Migration Design

- [ ] add or adapt package persistence so each package belongs to exactly one course
- [ ] add explicit lifecycle support for `ACTIVE`, `SUSPENDED`, `SCHEDULED`, and `DELETED`
- [ ] add `launchAt` or equivalent scheduled-launch field
- [ ] define the canonical persisted price representation so cents are unambiguous
- [ ] write a migration/normalization plan for legacy `cadencia` and special `0` data
- [ ] document follow-up exploration for turning informational `cadencia` into an enforceable weekly attendance rule in a future iteration
- [ ] verify soft-delete behavior preserves historical purchases/enrollments and does not hard-delete package records

## Phase 3 - Server Use Cases

- [ ] separate package management operations into focused server actions/services:
  - `createPackage`
  - `updatePackage`
  - `duplicatePackageToCourse`
  - `suspendPackage`
  - `relaunchPackage`
  - `schedulePackageLaunch`
  - `softDeletePackage`
- [ ] enforce one-course ownership on create and update paths
- [ ] implement duplicate-to-course without mutating the source package
- [x] remove active write-path dependence on `cadencia` and sentinel `0` behavior
- [x] enforce explicit price validation, including malformed input and negative values
- [x] ensure current public availability logic continues to hide inactive packages while admin can still manage active/inactive sets; full scheduled/deleted lifecycle remains pending schema work

## Phase 4 - Admin UI Refactor

- [x] refactor the package management list into a denser row/table layout
- [ ] display package name, course, price, lifecycle status, and launch date in each row
- [x] add explicit row actions for edit, duplicate, and active/inactive toggle as an interim step before full lifecycle controls
- [x] refactor the package form so pricing is edited with explicit decimal/cents semantics
- [x] remove `cadencia` and ambiguous `0` inputs from the active admin form
- [x] expose course ownership clearly in create/edit flows
- [ ] implement the duplicate-to-course modal/flow with target-course selection
- [ ] add scheduling controls for launch date and lifecycle state transitions

## Phase 5 - Public Visibility And Read Path Adjustments

- [ ] update package read/query filters so only eligible `ACTIVE` packages are public
- [ ] ensure overdue `SCHEDULED` packages are handled consistently on read paths
- [ ] exclude `DELETED` packages from default admin active lists while preserving audit/history access if needed
- [ ] verify suspended or deleted packages do not reappear through older helper paths or cached list builders

## Phase 6 - Tests

- [x] add unit tests for price parsing/formatting and ambiguous `0` rejection rules
- [ ] add unit tests for lifecycle transition rules (`ACTIVE`, `SUSPENDED`, `SCHEDULED`, `DELETED`)
- [ ] add unit tests for duplicate-to-course behavior preserving the source package
- [ ] add integration tests for package create/update with one-course ownership enforcement
- [ ] add integration tests proving suspended, deleted, and future-scheduled packages are hidden from public flows
- [ ] add integration tests for soft delete preserving historical package references
- [ ] add migration/normalization coverage for legacy `cadencia` and sentinel `0` records where feasible
- [ ] add UI/integration coverage for dense list row actions and scheduling workflow

## Phase 7 - Final Validation

- [ ] verify the implementation matches all acceptance scenarios in `requirements.md`
- [ ] verify no new dependency was introduced for scheduling
- [ ] verify auth/authorization boundaries for admin package actions remain unchanged
- [ ] verify the management UI is denser without hiding critical actions or state
- [ ] verify no unrelated course, checkout, or payment refactor leaked into the change
