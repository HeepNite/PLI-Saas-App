# Tasks: batch-staff-admin-refactor

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,800–2,900 total |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1→PR2→PR3→PR4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Container boundary + rooms seam hardening | PR1 | Base = feature branch |
| 2 | Profile/settings + catalog shell extraction | PR2 | Base = PR1 branch |
| 3 | Compat re-export migration + brittle tests | PR3 | Base = PR2 branch |
| 4 | Final cleanup/evidence/doc pass | PR4 | Base = PR3 branch |

## Phase 1: Baseline + Boundary Lock
- [x] 1.1 Record completed slices baseline in spec artifacts and keep behavior-preserving scope explicit.
- [x] 1.2 Define target `StaffUsersAdminClient` shell boundary and expected domain hook/presentational splits in docs.
- [x] 1.3 Validation (docs-only): `npx markdownlint "docs/specs/batch-staff-admin-refactor/*.md"` (or repo-equivalent markdown check).

## Phase 2: Batch Roadmap Authoring
- [x] 2.1 Create `roadmap.md` with 4 executable batches; each batch includes objective, modules, line budget, validation, rollback, and commit-message suggestions.
- [x] 2.2 Include explicit cleanup policy and delete-vs-report rule in roadmap/design/tasks alignment.
- [x] 2.3 Include logic-simplification policy (early returns, typed field updaters, no mega-utils).

## Phase 3: Tasks Realignment for Apply
- [x] 3.1 Rewrite task checklist into larger coherent batches (2–5 slices), not micro-steps.
- [x] 3.2 Ensure every batch has local-first validations and explicit rollback boundary.
- [x] 3.3 Ensure chain boundaries are explicit for feature-branch-chain bases.

## Phase 4: Persistence + Handoff
- [x] 4.1 Persist updated spec/design/tasks/roadmap summaries to Engram topics for this change.
- [x] 4.2 Handoff next apply batch recommendation with workload/risk forecast.

## Apply Execution Progress

### Batch 1 — Container Boundary + Rooms Domain Hardening
- [x] B1.1 Extract current/upcoming reservation rows into a presentational component (`StaffRoomReservationList.tsx`) while preserving copy/classes/actions.
- [x] B1.2 Keep reservation API, validation, permission, and container state ownership in `StaffUsersAdminClient.tsx`; tighten list props to render-only concerns.
- [x] B1.3 Stabilize rooms lifecycle source-contract assumptions by asserting reservation form/list source markers in extracted modules and endpoint/callback wiring in container.
- [ ] B1.4 Remove stale room-specific code only with conclusive unused evidence (deferred in this batch).

### Batch 2 — Profile/Settings + Catalog Presentational Split
- [x] B2.1 Extract profile payment section shell into `StaffProfilePaymentSection.tsx` while preserving payment form behavior/copy/classes and submission flow ownership in container.
- [x] B2.2 Extract profile request layout boundary into `StaffProfileRequestsSection.tsx` while preserving create/history request behavior and aria-visible structure.
- [x] B2.3 Extract school/catalog header+KPI shell into `StaffCatalogSection.tsx` and keep wizard/content internals owned by `StaffUsersAdminClient.tsx`.
- [x] B2.4 Keep no-touch guard for consecutive-course-link internals (no behavior/logic changes in consecutive-link flows).

### Batch 3 — Compat Re-export Migration + Test Contract Cleanup
- [x] B3.1 Migrate helper test imports from `StaffUsersAdminClient.tsx` compatibility seams to dedicated helper modules (`paymentState`, `paymentTimelineTransforms`, `studentPaymentCardFormatters`, `staffRoomCatalogHelpers`) where safe.
- [x] B3.2 Remove temporary compatibility re-exports from `StaffUsersAdminClient.tsx` only after proving no remaining named imports rely on them.
- [x] B3.3 Keep brittle source-string tests unchanged unless directly required for this import-path migration (no broad test strategy rewrite).

### Batch 4 — Final Evidence-Gated Cleanup + Architecture Lock
- [x] B4.1 Remove only proven stale imports/exports/types/constants in staff refactor modules with objective evidence from lint/search.
- [x] B4.2 Confirm architecture lock guardrails in design/roadmap/tasks and keep behavior-preserving boundaries explicit.
- [x] B4.3 Run local validation set (eslint changed files, staff/admin focused tests including rooms lifecycle/fetch-cache, full `tsc`) and report baseline vs new failures.
