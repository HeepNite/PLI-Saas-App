# Validation — refactor-enroll-modal

## Validation Matrix

| Layer | Required | Scope |
|---|---|---|
| Unit (pure logic) | Yes | check-in autofill/date-time helpers, step transition guards, reducer/selectors, checkout mapper branches |
| Component-focused | Yes | EnrollModal container transitions (contact gate, sign-in resume, kiosk fast-path gate) |
| Callback timing | Yes | `CheckInQrClient` integration: `onPaymentsStepReadyAction`, `onKioskSessionCreated`, `onExistingUserDetected`, `onTimeoutAction`, `kioskSessionToken` propagation |
| Existing focused tests | Yes | `tests/checkin/enroll-summary-format.test.ts` |
| E2E smoke | Yes (before final merge) | `e2e/course-flow.spec.ts`, `e2e/checkin.spec.ts` |
| Scoped lint/typecheck | Yes | run eslint/tsc only for touched files/packages where possible |

## Required Checks by Slice
1. **Pure logic slices**: unit tests + focused typecheck.
2. **Reducer wiring slices**: unit + component-focused tests.
3. **Side-effect adapter slices**: callback timing tests must pass before replacing inline effect bodies.
4. **UI decomposition slices**: component-focused tests + e2e smoke.

## Phase 3 Validation Gate (must pass before closure)
- New callback timing tests for `CheckInQrClient` contracts pass.
- Current Phase 1/2 focused tests remain passing.
- `npx tsc --noEmit` passes.

## Callback Timing Guardrails
- `onPaymentsStepReadyAction` fires once per open session only after the existing target-step readiness contract is met.
- `onExistingUserDetected` fires before continuing the new-student kiosk flow when verification returns an existing user.
- `onKioskSessionCreated` forwards the EmbeddedSignIn session id immediately to `CheckInQrClient` registration.
- `onTimeoutAction` remains the station inactivity timeout action and continues to override `onCompletedAction` for timeout resets.
- `kioskSessionToken` continues to be included in checkout/check-in payloads when provided by `CheckInQrClient`.

## Temporary Adapter Status
- `field/set-*` remains an interim compatibility adapter during Phase 3.
- It is explicitly not the final destination architecture and must not be treated as completed decomposition.

## Optional / Expensive Checks
- Full e2e suite (`npm run test:e2e` all specs): optional during intermediate slices; required only if regressions are suspected beyond course/checkin scope.
- Full repo test suite (`npm run test` all units): optional per slice; strongly recommended for final integration PR.
- Broad lint over entire monorepo/app: optional mid-slice; final PR should pass standard CI scope.

## Pass Criteria
- No behavior regressions in targeted course/checkin flows.
- Public exports and caller contract remain stable.
- New tests cover moved logic before or during each risky move.
- Callback timing tests pass before reducer/effects changes are considered stable.
