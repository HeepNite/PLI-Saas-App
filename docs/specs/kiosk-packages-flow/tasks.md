# Tasks: kiosk-packages-flow

## Phase 1: API Identity Fix (Foundation)

- [ ] **T-001** Modify `app/api/checkin/previous-package/route.ts` — accept `userId` in request body; validate non-empty string; filter `PackagePurchase` by body `userId` (not `auth().userId`); keep `auth()` as access gate; return 400 on missing `userId`
  - **Dependencies**: none
  - **Acceptance**: Endpoint accepts `{ userId, courseSlug }` POST body; Prisma query uses body `userId`; 400 returned when `userId` is empty; existing 401 gate preserved
  - **Complexity**: S

- [ ] **T-002** Write unit tests for T-001 — `tests/api/checkin/previous-package.test.ts` — table-driven: (a) body `userId` used for lookup, (b) missing `userId` → 400, (c) empty `userId` → 400, (d) no Clerk session → 401
  - **Dependencies**: T-001
  - **Acceptance**: All 4 scenarios pass with mocked Prisma + mocked Clerk `auth()`
  - **Complexity**: S

## Phase 2: Kiosk Package Picker in EnrollModal (Core)

- [ ] **T-003** Modify `components/front/courses/EnrollModal.tsx` — in the `payments` step, when `isCheckInFlow && isKioskTerminalFlow && course.enrollment.packages.length > 0`, render a compact inline package picker above payment controls; reuse existing `pkg` state setter and selection UI pattern from the `party` branch
  - **Dependencies**: none (independent of T-001)
  - **Acceptance**: Kiosk `checkin-new` and `checkin-existing` with packages in catalog show package cards in payments step; non-kiosk flows unchanged; empty catalog = no picker
  - **Complexity**: M

## Phase 3: CheckInQrClient Verification (Wiring)

- [ ] **T-004** Verify `components/front/checkin/CheckInQrClient.tsx` — confirm `fetchPreviousPackage` POSTs `userId` in body (not omitting it); if missing, add `userId: customer.userId` to the POST body; no other changes
  - **Dependencies**: none
  - **Acceptance**: Network inspection or log shows `{ userId, courseSlug }` in POST body; if already correct, add a comment referencing T-001
  - **Complexity**: S

## Phase 4: Step Resolver Contract (Wiring)

- [ ] **T-005** Review `lib/checkin/enroll-flow.ts` — verify `resolveEnrollStepKeys()` for kiosk `checkin-new` includes package-related step (either `party` or `packages` sub-step) when `catalog.packages.length > 0`; if the step key is already correct per design (Option B = no step-sequence change), add JSDoc noting package picker lives in `payments` step for kiosk
  - **Dependencies**: none
  - **Acceptance**: Code review confirms step sequence; JSDoc added if no change needed; if step key needs adding, it gates on `packages.length > 0`
  - **Complexity**: S

## Phase 5: Component Tests (Verification)

- [ ] **T-006** Write RTL test — `tests/checkin/kiosk-package-visibility.test.tsx` — mount `EnrollModal` with `flowVariant="checkin-new"`, `isKioskTerminalFlow=true`, `course.enrollment.packages` with 2+ packages; assert package cards render in payments step
  - **Dependencies**: T-003
  - **Acceptance**: Test passes; packages visible; also test `offer=null` scenario still shows packages
  - **Complexity**: M

- [ ] **T-007** Write Vitest test — `tests/checkin/enroll-flow.test.ts` — assert kiosk `checkin-new` step order via `resolveEnrollStepKeys()`; table-driven: (a) with packages → includes package step, (b) without packages → skips package step
  - **Dependencies**: T-005
  - **Acceptance**: Both scenarios pass; matches spec requirement
  - **Complexity**: S

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| Phase 1: API Identity Fix | T-001, T-002 | Fix identity resolution + tests |
| Phase 2: Kiosk Package Picker | T-003 | Inline package picker in payments step |
| Phase 3: Client Wiring | T-004 | Verify CheckInQrClient sends userId |
| Phase 4: Step Resolver | T-005 | Verify/add step key + JSDoc |
| Phase 5: Component Tests | T-006, T-007 | RTL + Vitest verification |
| **Total** | **7** | |

### Implementation Order
1. **T-001 → T-002** (API fix + unit test, foundation)
2. **T-003** (UI — independent, core deliverable)
3. **T-004 + T-005** (wiring — small, can be parallel)
4. **T-006 + T-007** (tests — depend on implementation)

### Next Step
Ready for implementation (sdd-apply).
