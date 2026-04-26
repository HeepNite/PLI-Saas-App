# package-builder-management - Design

## Intent

Implement the package-builder overhaul as a localized admin-management change that clarifies package pricing, removes legacy configuration concepts, and introduces explicit lifecycle controls without weakening existing purchase, enrollment, or historical transaction integrity.

The design goal is to replace ambiguous package configuration with a predictable contract:

- one package belongs to exactly one course
- package price is stored and edited with explicit currency-subunit semantics
- legacy `cadencia` and special `0` behavior are removed from active management flows
- package removal is soft-delete only
- lifecycle is modeled explicitly instead of inferred from scattered flags

## Reuse Strategy

The implementation must reuse as much of the existing system as possible:

- existing admin package-management routes and screens as the entry point
- existing course entities and selectors instead of introducing a parallel ownership model
- existing package purchase/enrollment flow where public visibility can continue to depend on package eligibility filters
- existing Prisma models and admin server actions / API handlers, extending them only where required
- existing table/list UI primitives already used in staff/admin views

Do **not** introduce a new package engine, a second course-association system, or new external dependencies for scheduling.

## Affected Areas

- `docs/specs/package-builder-management/*`
- package-related Prisma schema and migrations
- admin package-management UI for list, create, edit, duplicate, suspend, relaunch, and delete actions
- server-side package create/update/read logic
- package visibility logic used by public checkout/enrollment flows
- targeted unit/integration tests around package lifecycle and duplication

## Architecture Constraints

- keep the change localized to package-management and package-read paths
- preserve existing auth and authorization boundaries for staff/admin package actions
- avoid unrelated refactors in course creation, checkout, or payment processing
- preserve historical purchases/enrollments even when packages are suspended or deleted
- migration must be deterministic and idempotent enough to run safely once in controlled deployment
- no background worker dependency should be introduced just to activate scheduled packages

## Data And Contract Notes

### 1. Canonical Package Ownership

Packages move to a strict single-owner model:

- each package record references exactly one course
- duplication creates a **new package record** for another selected course
- duplication copies editable commercial/configuration fields only
- duplication must not copy historical sales, enrollments, or audit timestamps that belong to the source record lifecycle

Recommended persistence rule:

- source package remains unchanged
- duplicated package gets a new identity and target `courseId`
- UI must present duplication as “copy package to another course”, not reassignment of the original

### 2. Lifecycle Model

Package availability must be represented explicitly with a status enum and launch metadata.

Recommended internal model:

- `ACTIVE`
- `SUSPENDED`
- `SCHEDULED`
- `DELETED`

Recommended supporting field:

- `launchAt: Date | null`

Rules:

1. `ACTIVE`
   - available in admin active list
   - visible to public purchase/enrollment flows if all existing business rules pass

2. `SUSPENDED`
   - visible in admin
   - hidden from public purchase/enrollment flows
   - historical purchases remain intact

3. `SCHEDULED`
   - visible in admin with scheduled date
   - hidden from public purchase/enrollment flows until `launchAt <= now`
   - no worker is required initially; read-path eligibility can treat overdue scheduled packages as active, while an admin/service write-path may normalize stale state opportunistically

4. `DELETED`
   - soft removed from default management list
   - hidden from public purchase/enrollment flows
   - retained for historical transaction integrity and auditability

### 3. Price Normalization

Price editing must stop relying on ambiguous string or sentinel conventions.

Recommended contract:

- admin input displays a decimal monetary value such as `45.50`
- persistence stores a canonical integer minor-unit value (for example cents) if the current schema does not already guarantee unambiguous decimals
- conversion happens in exactly one form-mapping boundary on write and one formatter boundary on read

Validation rules:

- reject malformed monetary input
- reject negative values
- treat `0` only as explicit zero-price business intent (`$0.00`) if allowed by product rules
- never treat `0` as a placeholder, hidden flag, cadence trigger, or incomplete state marker

### 4. Removal of Legacy `cadencia` / `0` Logic

Legacy fields and behaviors must be removed from active admin flows in a compatibility-safe way.

Implementation boundary:

- remove `cadencia` from active admin editing, validation, and update handlers as an operational field
- preserve `cadencia` as optional informational/display text for catalog and checkout messaging during this iteration
- remove any branch where `0` means anything other than literal zero price/value
- if the database still contains legacy columns temporarily, map them only for migration/backfill and stop exposing them in active write contracts

Follow-up note for next iteration:

- evaluate converting informational `cadencia` into an enforceable attendance-frequency rule (for example, limiting weekly usage such as `2 classes/week`) only after the package model and lifecycle refactor are stable
- do not implement weekly enforcement in this change set

Migration expectation:

- normalize legacy records before or during deployment
- any legacy package with ambiguous `0` semantics must be converted to an explicit supported state before the new UI becomes source-of-truth

### 5. Delete / Removal Contract

Deletion must be implemented as soft delete.

Recommended admin actions:

- `Delete` -> confirms destructive intent -> sets `status = DELETED`
- optional filtered view may expose deleted packages for audit/recovery later, but deleted records are absent from the default active list

Explicit non-goal:

- no hard delete for package records that may already participate in payments, attendance, or enrollment history

## UI / Component Notes

### Dense Management List

Refactor the package-management list into a denser row-based table/list that surfaces, at minimum:

- package name
- course
- price
- lifecycle status
- launch date when scheduled
- last updated date (if already available cheaply)
- row actions: edit, duplicate, suspend/relaunch, delete

Design constraints:

- 2–3 rows should be visible in the primary viewport without oversized cards wasting space
- use badges/chips for lifecycle state instead of verbose text blocks
- destructive and lifecycle actions stay explicit and separated from navigation actions

### Package Form

The package create/edit form should be split by responsibility:

1. identity/details
2. pricing
3. course ownership
4. lifecycle scheduling

This keeps removal of `cadencia` and sentinel `0` logic contained to the form boundary instead of leaking across the page.

### Duplicate-to-Course Flow

Preferred UX:

- row action opens modal or focused flow
- user selects target course
- system validates source package is duplicable
- system creates new package with copied editable fields
- success state routes user to the new package edit/detail view or refreshes the table with explicit confirmation

## Service / API Boundaries

The server layer should separate these use cases instead of using a single overloaded save path:

- `createPackage`
- `updatePackage`
- `duplicatePackageToCourse`
- `suspendPackage`
- `relaunchPackage`
- `schedulePackageLaunch`
- `softDeletePackage`

Why: lifecycle transitions, duplication, and general editing have different validation rules and side effects. Mixing them in one generic mutation would recreate the ambiguity we are trying to remove.

## Security And Operational Notes

- preserve existing admin/staff auth boundary for package-management actions
- public users must never see suspended, deleted, or not-yet-launched scheduled packages
- logging/audit should capture lifecycle-changing actions (`suspend`, `relaunch`, `schedule`, `delete`) if the current admin action layer already supports audit hooks
- rollout should prefer schema migration first, then UI activation, to avoid the old UI writing incompatible payloads after migration starts
- rollback must account for any schema migration that introduces lifecycle enum values or required course ownership constraints

## Testing Notes

At minimum, implementation must add coverage for:

- editing a package with explicit decimal price input
- rejecting malformed or ambiguous price values
- duplicating a package to a different course without mutating the source
- hiding `SUSPENDED`, `SCHEDULED` (future), and `DELETED` packages from public availability
- relaunching a suspended package
- soft deleting a package while preserving historical reads
- migration/normalization behavior for legacy `cadencia` and sentinel `0` cases where applicable
