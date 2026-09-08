# Special Classes Management — Implementation Plan

## Gate

B-01, B-02, and B-03 are resolved. The user explicitly accepted this four-work-unit plan on 2026-09-03. Execute work units in order. Each unit keeps tests with behavior, records exact command results, and preserves its rollback boundary. Forecast counts authored additions plus deletions and excludes generated Prisma client output.

## Work Unit 1 — Persist stable authoring identity

**Forecast:** 330-390 authored lines. **Risk:** medium. **Start:** existing operational schema, no CourseCatalog link. **Finish:** additive identity and pure policies, no route/UI behavior.

**Status:** Complete. WU1 closed at 389 authored lines after unit, static, and empty/populated disposable-schema migration tests passed on 2026-09-03.

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

### Approved WU2 delivery split — 2026-09-03

WU3 remains blocked until both units are integrated. Neither unit includes UI work or delivery actions.

#### WU2a — Transactional synchronization

- **Status:** Complete and verified.
- **Scope:** Transactional synchronization, durable removal/disable outcomes, terminal lifecycle protection, reusable conflict policy, and PostgreSQL proof.
- **Verification:** isolated PostgreSQL authoring, race, policy, and migration suites — 4 files, 29 tests passed; typecheck passed.
- **Failure injection:** Every write stage rolls back; uncommitted removal/disable is receipted, while committed or terminal mutation is rejected.
- **Authored size:** 384 additions plus deletions, including its allocated 12 lines of this evidence block.

#### WU2b — Course route contract

- **Status:** Complete and verified.
- **Scope:** Existing route wiring, authoring-bypass closure, definition authorization, complete commands, active command, and HTTP translation.
- **Verification:** course security, existing school route, and existing Special Class API suites — 3 files, 40 tests passed; typecheck passed.
- **HTTP contract:** Typed failures retain their mappings; unexpected synchronizer details are redacted from the generic `500` response.
- **Authored size:** 184 additions plus deletions, including its allocated 8 lines of this evidence block.

## Work Unit 3 — Extend the seven-step wizard

The user approved one bounded delivery split on 2026-09-07. WU3b depends on WU3a; WU4 remains blocked until both slices are integrated and green.

### WU3a — Wizard state and commands

**Status:** Complete and verified. **Risk:** medium. **Start:** WU2 commands have no Course Studio state/wiring. **Finish:** stable authoring state, hydration, scheduling derivation, and explicit commands are available without new visual controls.

- **Scope:** Types; operations default/hydration; stable CourseCatalog, revision, slot and projection IDs; concrete scheduling derivation; authoring payloads; `save_draft`, `publish`, and `set_active`; retry-stable operation IDs; additive Course GET hydration.
- **Dependencies:** WU2a synchronization and WU2b route contract complete and passing.
- **TDD/evidence:** Original RED contributed the five hook failures for defaults, hydration, capacity gating, and retry identity. The reconstructed WU3a intermediate typechecks and its hook, schedule-helper, and Course API suites pass — 3 files, 31 tests. Targeted ESLint for `useStaffCoursesCRUD.ts` passes without warnings.
- **Files:** `app/api/staff/school/courses/route.ts`; `staffAdminTypes.ts`; `useStaffCoursesAdmin.ts`; `useStaffCoursesCRUD.ts`; `useStaffCoursesDerived.ts`; `useStaffCoursesSchedule.ts`; `useStaffCoursesAdmin.test.tsx`; `StaffCourseMediaStep.test.tsx`; `tests/api/staff-school-courses-security.test.ts`; the four required `CourseFormState` initializer lines in each of five WU3b component test files; and the compatibility-alias hunk in `buildStaffSchoolWorkspaceProps.ts`.
- **Authored size:** 288 additions plus deletions, including allocated evidence, partial test fixtures, and intermediate compatibility churn.
- **Rollback boundary:** Remove client authoring state/hydration/command construction and the additive GET projection; preserve WU1/WU2 schema, synchronization, authorization, durable data, and operations-off course saves.

### WU3b — Wizard controls and accessibility

**Status:** Complete and verified. **Risk:** medium. **Start:** WU3a state/commands exist without visual controls. **Finish:** the existing seven-step Course Studio exposes the complete accessible authoring workflow.

- **Scope:** Info switch; Prices explanation; Schedule concrete dates/shared capacity; Preview count/manual-publication copy; Save Draft/Publish controls; Studio/error presentation; exact seven-step order; labels, error linkage/announcement, visible focus, keyboard use, and async failure focus retention.
- **Dependencies:** WU3a integrated and its focused gate passing.
- **TDD/evidence:** Original RED contributed four component failures. Gap RED: 4 accessibility failures while exact order and async rerender behavior already passed. Applying WU3b to the verified WU3a intermediate typechecks, reproduces the final code/test candidate byte-for-byte, and passes 8 component files/32 tests plus the combined 11-file/63-test matrix.
- **Accessibility proof:** The slug conflict is an announced alert linked by `aria-describedby`; new switch/capacity/action controls use the existing `focus-visible:ring-2` convention; both Save Draft and Publish retain/restore focus through an asynchronous error rerender, whose generic error is assertively announced.
- **Files:** `StaffCourseMainInfoStep.tsx`; `StaffCoursePricingStep.tsx`; `StaffCourseScheduleStep.tsx`; `StaffCoursePreviewStep.tsx`; `StaffCoursePublishStep.tsx`; `StaffCourseStudioPanel.tsx`; `school/SchoolWizardPanel.tsx`; their focused test hunks after the five WU3a-allocated four-line initializers; new `SchoolWizardPanel.test.tsx`; and the final builder hunks.
- **Authored size:** 271 additions plus deletions, including allocated evidence, the new test, and intermediate-to-final builder churn.
- **Rollback boundary:** Hide/remove only WU3b controls, copy, focus/error semantics, and component tests; retain WU3a state/commands and all generated operational data.

### Combined gate and allocation

- Combined WU3 matrix: 11 files, 63 tests passed; typecheck and `git diff --check` passed.
- Regression: WU2b API 40/40; WU2a integration/race 15/15; WU1 policy/migration 14/14, with database suites serialized against guarded disposable schemas.
- Focused ESLint has zero candidate-caused warnings; five pre-existing warnings remain outside the added behavior.
- Shared path: WU3a changes 2 lines in `buildStaffSchoolWorkspaceProps.ts` to destructure `usesConcreteSchedule: isSpecialEventCourse`, retaining the existing Studio prop and omitting Publish callbacks. WU3b then spends 7 intermediate-to-final changed lines to remove the alias, rename the Studio prop, add preview count, and add Publish callbacks. The final combined file remains behaviorally unchanged; the extra 2 lines are counted as delivery churn.
- Shared path: this `tasks.md` evidence allocates 22 changed lines to WU3a and 22 to WU3b.
- WU4 gate: blocked until both slices are integrated; no WU4 implementation or operational smoke belongs to either WU3 slice.

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
- [x] Empty/populated migration rehearsal and non-destructive rollback evidence recorded.
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
