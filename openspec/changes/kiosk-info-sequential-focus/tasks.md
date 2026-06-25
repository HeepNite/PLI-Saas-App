# Tasks: Kiosk Info Sequential Focus Flow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 280-320 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-always |
| Chain strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Complete sequential focus flow implementation | PR 1 | All phases, testing, animation; self-contained |

## Phase 1: Foundation Model (Infrastructure)

- [x] 1.1 Create `components/front/courses/enroll/model/kiosk-info-phase.ts` with `KioskInfoPhase` type and `nextKioskInfoPhase` function
- [x] 1.2 Create `components/front/courses/enroll/model/kiosk-info-phase.test.ts` with unit tests for all phase transitions
- [x] 1.3 Run `npx vitest run` to verify model tests pass

## Phase 2: Core Implementation (Sequential Phase Logic)

- [x] 2.1 Add `kioskInfoPhase` state and `nextKioskInfoPhase` import to `EnrollInfoStep.tsx`
- [x] 2.2 Extract field render helpers (`NameEmailFields`, `PhoneField`, `PinFields`) within component file
- [x] 2.3 Add framer-motion phase variants (`phaseVariants`, `pillVariants`) with entry/exit animations
- [x] 2.4 Implement phase 1 (name-email) render block with global Continue validation
- [x] 2.5 Implement phase 2 (phone) render block with inline `KioskNumericKeypad`
- [x] 2.6 Implement phase 3 (pin) render block with inline `KioskNumericKeypad` for new-student service

## Phase 3: Integration and Automation (Wiring)

- [x] 3.1 Wrap all phases in `AnimatePresence mode="wait"` container
- [x] 3.2 Wire global Continue for phone→pin transition without duplicate internal buttons
- [x] 3.3 Implement summary pill component with Edit button functionality
- [x] 3.4 Add Edit handler: reset to phase 1 + clear `activeNumericField`
- [x] 3.5 Guard all new behavior behind `isKioskTerminalFlow` conditional

## Phase 4: Verification and Testing

- [ ] 4.1 Test kiosk flow: verify phase 1→2→3 transitions work with animations
- [ ] 4.2 Test global Continue: fill phone with 10 digits, confirm Continue advances to pin phase
- [ ] 4.3 Test edit functionality: navigate to phase 2/3, tap Edit, confirm return to phase 1
- [ ] 4.4 Test non-new-student: verify phone→done flow skips pin phase entirely
- [ ] 4.5 Test non-kiosk flow: verify `isKioskTerminalFlow=false` shows all fields simultaneously
- [ ] 4.6 Run complete test suite: `npx vitest run` to ensure no regressions
