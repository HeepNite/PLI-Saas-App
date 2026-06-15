# Proposal: Kiosk Info Sequential Focus Flow

## Intent

The kiosk new-student info step overwhelms users with all fields visible at once and a keypad buried below the viewport. This change introduces a 3-phase sequential focus flow where each phase shows only relevant fields with the keypad positioned inline — directly below the active input.

## Scope

### In Scope
- Add `kioskInfoPhase` state machine (3 phases) controlled by `EnrollModal` and rendered by `EnrollInfoStep.tsx`
- Phase 1 (name-email): first name, last name, email fields with keyboard input
- Phase 2 (phone): phone field only + `KioskNumericKeypad` inline below
- Phase 3 (pin): PIN + confirm PIN fields + `KioskNumericKeypad` inline below
- `AnimatePresence` animated transitions between phases (entry/exit with y + opacity)
- Compact summary pill (collapsed phases) with "Edit" button → back to phase 1
- Global Continue advances phone → pin when phone reaches 10 digits
- Guard: all behavior gated behind `isKioskTerminalFlow === true`

### Out of Scope
- API or DB schema changes
- Regular web flow / QR mobile flow (unchanged)
- New npm dependencies

## Capabilities

### New Capabilities
None — this is a UX layout refactor of an existing step; no new spec-level capability is introduced.

### Modified Capabilities
- `kiosk-terminal-ui`: The info-step input layout and keypad placement behavior changes for `isKioskTerminalFlow`. Existing spec covers label threading only; a delta is needed for sequential phase UX.

## Approach

Footer-controlled phase state. `kioskInfoPhase: 'name-email' | 'phone' | 'pin'` lives in `EnrollModal` because the visible Continue/Back controls live in the modal footer. `EnrollInfoStep` renders the controlled phase and inline keypad sections.

**Why this is safe for `canContinue`**: The parent computes phase-specific continuation rules for kiosk info (`name/email`, then `phone`, then full step validation for `pin`). Non-kiosk flows continue using the existing `resolveStepValid` gate.

**Phase transitions:**
- Phase 1 → 2: global `EnrollModal` Continue validates name + email
- Phase 2 → 3: global `EnrollModal` Continue is enabled after `isCompleteUSPhone` is true
- Phase 3 → done: global `EnrollModal` Continue handles final validation + submission
- Edit: summary pill "Edit" → reset to phase 1, `activeNumericField` = null

**Animation:** `framer-motion AnimatePresence` + `motion.div`. Entry: `{ opacity: 0, y: 12 }` → `{ opacity: 1, y: 0 }`. Exit: `{ opacity: 0, y: -8, scale: 0.97 }`. Summary pill: slide from left with opacity fade.

**Keypad:** `KioskNumericKeypad` rendered inline within phase 2 and phase 3 sections. Replaces existing `max-h-0 / max-h-400px` CSS trick.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/front/courses/EnrollModal.tsx` | Modified | Owns kiosk sub-phase state and footer Continue/Back behavior |
| `components/front/courses/enroll/steps/EnrollInfoStep.tsx` | Modified | Controlled phase rendering, AnimatePresence layout, inline keypad placement |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `canContinue` gate blocks during sub-phases | Low | All fields stay mounted — values in state, gate works normally |
| Edit button returns to phase 1 with stale keypad focus | Low | Reset `activeNumericField` to `null` on back-transition |
| Footer Continue advances the wrong layer | Medium | Parent intercepts kiosk info sub-phases before advancing the overall modal step |
| PIN phase conditional (new-student service only) | Low | Existing `showPinFields` conditional unchanged |

## Rollback Plan

Small UI-only change. Revert `EnrollModal.tsx`, `EnrollInfoStep.tsx`, and the kiosk phase model files. No DB migrations, no API changes, no new dependencies.

## Dependencies

- `framer-motion` v12.29.2 — already installed (used in `CourseServicesSection.tsx`). No new install needed.

## Success Criteria

- [ ] Kiosk new-student info step shows only Phase 1 fields on load
- [ ] Tapping global "Continue" from Phase 1 advances to Phase 2 with animation
- [ ] Completing phone (10 digits) enables global Continue; tapping it advances to Phase 3
- [ ] Keypad is visible directly below the active field (no scroll required)
- [ ] Summary pill appears for completed phases with working "Edit" button
- [ ] Regular web flow and QR mobile flow render identically to before
- [ ] `EnrollModal` canContinue gate passes when all fields are valid
