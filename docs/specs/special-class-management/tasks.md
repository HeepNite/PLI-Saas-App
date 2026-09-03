# Special Classes Management — Implementation Plan

## Gate

B-01, B-02, and B-03 are resolved. The user explicitly accepted this four-work-unit plan on 2026-09-03. Execute work units in order. Each unit keeps tests with behavior, records exact command results, and preserves its rollback boundary. Forecast counts authored additions plus deletions and excludes generated Prisma client output.

## Work Unit 1 — Persist stable authoring identity

**Forecast:** 330-390 authored lines. **Risk:** medium. **Start:** existing operational schema, no CourseCatalog link. **Finish:** additive identity and pure policies, no route/UI behavior.

**Dependencies:** Accepted specification and explicit acceptance of this plan; no implementation dependency.

### TDD order

1. RED: migration tests prove existing courses default disabled, standalone/Salsa rows stay unlinked, duplicate `(courseCatalogId, startsAt)` and duplicate authoring-slot links fail.
2. RED: unit tests prove concrete-slot normalization, DST/error handling, stable slug generation, payload hashing, drop-in-only mapping, commitment mutation rejection, manual-publish state, and no kind-based activation.
3. GREEN: add the smallest schema/migration and pure helpers.
4. REFACTOR: centralize normalized authoring command/result types; run schema validation and focused tests.

### Files and symbols

- `prisma/schema.prisma`: `CourseCatalog`, `SpecialClass`; add `CourseCatalogSpecialClassSlot`, `CourseCatalogAuthoringOperation`, operations flag/shared capacity and relations.
- `prisma/migrations/<timestamp>_school_builder_special_class_authoring/migration.sql`: additive tables, FKs, unique keys, indexes, defaults.
- `lib/special-classes/authoring-policy.ts` (new): concrete-slot parser, projection mapping, stable slug, normalized payload hash.
- `tests/lib/special-class-authoring-policy.test.ts` (new).
- `tests/integration/special-class-migration.test.ts`: extend existing empty/populated/Salsa assertions.

### Gate and rollback

- `npx prisma validate`; focused unit and PostgreSQL migration tests.
- Rehearse `migrate deploy` on empty and representative populated clones; snapshot counts/IDs before and after.
- Rollback boundary: no runtime path reads new fields. Revert helper/runtime references; retain additive schema if migration reached shared data. Never delete operational rows.

## Work Unit 2 — Synchronize Course Studio commands

**Forecast:** 350-390 authored lines. **Risk:** high. **Start:** stable schema unused. **Finish:** owner/admin can idempotently save/publish projections through the existing course route; no wizard controls yet.

**Dependencies:** WU1 merged/applied with migration and pure-policy gates passing.

### TDD order

1. RED: API tests reject front desk, partial full-save payloads, foreign slot IDs, stale revisions, mismatched operation replay, and automatic publication from delayed metadata.
2. RED: PostgreSQL tests prove two-slot creation, identical replay, concurrent retry, immutable slug, drop-in-only price mapping, committed move/removal/disable rejection, all-or-nothing failure, room/session collision, and no weekly fallback expansion.
3. GREEN: implement command parser and serializable synchronizer; call it from the existing route.
4. REFACTOR: share existing retry/lock policy; preserve operations-off course behavior and make active toggle an explicit narrow command.

### Files and symbols

- `lib/special-classes/authoring-sync.ts` (new): `synchronizeSpecialClassAuthoring`, diff, receipt replay, lock order, mapping/audit.
- `lib/special-classes/management.ts`: reuse/export bounded retry and canonical boundary locks without weakening current callers.
- `app/api/staff/school/courses/route.ts`: `POST`, request normalization, ID/revision/operation commands, transactional response/errors.
- `lib/security/staff-portal-auth.ts`: reuse `authorizeSpecialClassDefinitionRequest`; no new role vocabulary.
- `tests/api/staff-school-courses-security.test.ts`.
- `tests/integration/special-class-authoring-sync.test.ts` (new).
- Regression: `tests/integration/special-class-staff-races.test.ts`, `tests/api/staff-special-classes.test.ts`.

### Gate and rollback

- Focused API/integration commands plus existing Special Class race tests.
- Failure injection after each write stage must leave no partial slot/projection/audit/receipt state.
- Rollback boundary: disable enabled-command handling while retaining reads, webhook fulfillment, additive data, and operations-off course saves.

## Work Unit 3 — Extend the seven-step wizard

**Forecast:** 340-390 authored lines. **Risk:** medium. **Start:** backend capability has no UI entry. **Finish:** existing Course Studio owns switch, stable concrete slots, shared capacity, preview, and explicit draft/publish commands.

**Dependencies:** WU2 synchronization contract and API tests passing.

### TDD order

1. RED: form/hook tests prove switch default false, course kind never activates operations, all kinds can use concrete slots when enabled, slot IDs survive hydration/edit, and capacity is required only when enabled.
2. RED: component tests prove unchanged seven-step order, capacity in Schedule, drop-in-only shared price in Prices, preview count, delayed metadata stays draft, and Save Draft/Publish operation-ID reuse after transport failure.
3. GREEN: extend state/payload/hydration and existing step components only.
4. REFACTOR: remove `isSpecialEventCourse` as an operations discriminator while preserving non-operational schedule presentation.

### Files and symbols

- `components/front/staff/staffAdminTypes.ts`: `CourseFormState`, `CourseScheduleSlot`, `SchoolCourseRow`, command response types.
- `components/front/staff/useStaffCoursesAdmin.ts`: initial/hydrated operations state; derive concrete scheduling from switch.
- `components/front/staff/useStaffCoursesCRUD.ts`: `saveCourseCatalog`, retry-stable operation ID, ID-based edits, explicit commands.
- `components/front/staff/StaffCourseMainInfoStep.tsx`: operations switch.
- `components/front/staff/StaffCourseScheduleStep.tsx`: concrete slots/shared capacity.
- `components/front/staff/StaffCoursePreviewStep.tsx`, `StaffCoursePublishStep.tsx`, `StaffCourseStudioPanel.tsx`.
- Existing focused tests under `components/front/staff/__tests__/` for each touched component/hook and schedule helpers.

### Gate and rollback

- Focused Vitest component/hook suite, typecheck, and accessibility assertions for labels, errors, keyboard use, and focus retention.
- Rollback boundary: hide new controls and commands; existing seven-step CourseCatalog authoring remains. Do not remove generated operational data.

## Work Unit 4 — Remove duplicate authoring and verify operations

**Forecast:** 240-330 authored lines. **Risk:** medium. **Start:** both UI writers are still visible. **Finish:** operations panel is operational-only, linked rows navigate to Course Studio, and repository-native smoke is recorded.

**Dependencies:** WU3 Course Studio controls and hydration tests passing.

### TDD order

1. RED: panel tests prove create and shared-definition forms are absent; lifecycle/roster/payment/capacity/audit controls remain; linked and standalone navigation states are explicit.
2. RED: API tests prove deprecated browser definition writes cannot bypass Course Studio while current operational mutations retain authorization/locking.
3. GREEN: remove duplicate controls, add Course Studio navigation, narrow route contracts.
4. REFACTOR: delete dead client definition state only after tests prove no operational regression.

### Files and symbols

- `components/front/staff/StaffSpecialClassesPanel.tsx`: remove `create` and shared-definition `update`; retain operational handlers; add builder navigation.
- `components/front/staff/StaffUsersAdminView.tsx`: `StaffUsersAdminView` passes linked CourseCatalog navigation into `StaffSpecialClassesPanel`.
- `app/api/staff/special-classes/route.ts`: deprecate/restrict browser `POST` after caller proof.
- `app/api/staff/special-classes/[id]/route.ts`: retain lifecycle and permitted per-session operations; reject removed shared-definition fields.
- `lib/special-classes/read-model.ts`: expose nullable authoring CourseCatalog identity for navigation.
- `tests/front/staff-special-classes-panel.test.tsx`, `tests/api/staff-special-classes.test.ts`.
- Regression: public, fulfillment, backfill, roster race, attendance, and terminal current-class tests.

### Gate and rollback

- Focused tests, `npm run typecheck`, `npm run lint`, and operational dev smoke below.
- Rollback boundary: restore panel navigation/visibility only if needed; do not re-enable a second writer after Course Studio has authored linked rows. Preserve operational APIs and durable records.

## Operational development smoke

1. As owner/admin, save an operations-off course of a presentation kind that previously implied special events; verify no projection.
2. Enable operations on a different course, add two concrete slots, set shared price/capacity, Save Draft, retry the same operation, and verify stable IDs/no duplicates.
3. Publish and verify two independent rows in staff operations and public resolution; confirm each points to its own canonical ClassSession under the source course.
4. Adjust one session capacity/price operationally; verify the sibling remains unchanged and a later authoring save does not overwrite the published override.
5. Move one uncommitted slot and verify stable slug/IDs; then add a hold/purchase/attendance fixture and verify move/removal/disable returns a conflict with no mutation.
6. Verify front desk can operate roster but cannot author; verify Salsa and one standalone row remain unchanged.
7. Confirm the terminal today-classes projection can consume canonical data; kiosk UI integration itself remains out of scope.

Record environment, commands, IDs/counts (not PII), exact results, and rollback checkpoint.

## Review Workload Forecast

| Chain | Work unit | Estimated authored lines | Review focus |
|---|---|---:|---|
| PR 1 | WU1 | 330-390 | Additive identity, migration safety, pure policy |
| PR 2 (on PR 1) | WU2 | 350-390 | Transaction, idempotency, authorization, no recurrence |
| PR 3 (on PR 2) | WU3 | 340-390 | Existing wizard integration and retry UX |
| PR 4 (on PR 3) | WU4 | 240-330 | Duplicate-writer removal and operational regression |

**Recommended chain:** four reviewable PRs in dependency order. Do not combine units if the authored diff exceeds 400 lines. If one cohesive unit cannot fit after one honest slicing pass, report the smallest count and request a `size:exception`; do not code-golf tests or documentation.

## Final verification

- [x] Product decisions B-01, B-02, and B-03 recorded in `requirements.md` and `resolve.md`.
- [x] This implementation plan explicitly accepted.
- [ ] Empty/populated migration rehearsal and non-destructive rollback evidence recorded.
- [ ] Focused unit/API/PostgreSQL/component tests pass in their owning work units.
- [ ] Existing checkout, webhook, roster, Salsa, public, attendance, and terminal regressions pass.
- [ ] Typecheck, lint, Prisma validation, and operational smoke pass with exact results.
- [x] No implementation begins before explicit plan acceptance.

## Exact next first unit

After explicit plan acceptance, start **WU1 — Persist stable authoring identity**. The first RED action is to extend `tests/integration/special-class-migration.test.ts` and create `tests/lib/special-class-authoring-policy.test.ts`, then run:

```bash
npx vitest run tests/integration/special-class-migration.test.ts tests/lib/special-class-authoring-policy.test.ts
```

Expected first result: failures proving the missing additive schema, stable slot identity, drop-in-only mapping, commitment guard, and manual-publish policy. Do not write production/schema implementation before that RED evidence is recorded.
