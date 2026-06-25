# Design: Kiosk Info Sequential Focus Flow

## Technical Approach

Add a small kiosk info phase state machine owned by `EnrollModal` and rendered by `EnrollInfoStep.tsx`. The phase state lives with the global Continue/Back footer controls so the footer can advance `name-email → phone → pin → next step` without duplicate internal buttons.

A pure transition function (`nextKioskInfoPhase`) computes the next phase from current phase + service. The component renders one of three phase blocks per render, plus an animated summary pill stack for completed phases. The keypad is rendered inline inside phase 2 and phase 3 blocks (not at the bottom of the form).

Maps directly to proposal Approach (Option A) and spec scenarios "Phase 1 Initial State" through "Non-Kiosk Flow Unchanged".

## Architecture Decisions

### Decision: Phase state lives in `EnrollModal`, rendering lives in `EnrollInfoStep`

| Option | Tradeoff | Decision |
|---|---|---|
| Lift to EnrollModal | Allows global Continue/Back footer to drive sub-phases; adds a small prop contract | **Chosen** |
| Local state in EnrollInfoStep | Self-contained, but forces duplicate internal Continue/Back buttons or blocks the footer | Rejected |

**Rationale**: Phase is still UI choreography, but the actual controls are in `EnrollModal`'s footer. Keeping the state in the parent prevents duplicate buttons and lets validation match the visible phase.

### Decision: Preserve values in parent state while rendering one visible phase

| Option | Tradeoff | Decision |
|---|---|---|
| Conditional render one visible phase | Keeps the visual tree simple; safe because values live in parent React state | **Chosen** |
| Keep all fields mounted but visually hidden | More DOM and focus complexity; no longer needed once the footer validation is phase-aware | Rejected |

**Rationale**: `resolveStepValid` reads `contact`, `studentPin`, and `studentPinConfirm` from React state. Values persist even when only one phase is rendered. `AnimatePresence mode="wait"` ensures only one phase animates at a time.

### Decision: Pure transition function extracted to model layer

Extract `nextKioskInfoPhase(current, service)` to `components/front/courses/enroll/model/kiosk-info-phase.ts`. Single responsibility, fully unit-testable, no React imports.

### Decision: Inline summary pill component (not extracted)

Pill is ~30 lines, used only here, has no reuse potential outside this step. Extracting adds indirection without payoff. If reuse emerges later, extract then.

### Decision: Global Continue drives phase changes

| Option | Tradeoff | Decision |
|---|---|---|
| Auto-advance when phone is complete | Surprising with Back; can jump back to PIN after user returns to phone | Rejected |
| Global Continue advances visible sub-phases | Predictable; matches visible footer controls; avoids duplicate buttons | **Chosen** |

## Data Flow

```
User taps digit
  → EnrollModal.handleNumpadDigit updates contact.phone
  → EnrollModal canContinueCurrentStep enables when phone is complete
  → User taps global Continue
  → EnrollModal calls nextKioskInfoPhase('phone', service)
  → setKioskInfoPhase('pin') + setActiveNumericField('pin')
  → EnrollInfoStep renders the pin phase with AnimatePresence

Edit button on summary pill
  → setPhase('name-email') + setActiveNumericField(null)
  → AnimatePresence: current phase exits, name-email enters
  → Field values preserved in EnrollModal state (untouched)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `components/front/courses/enroll/model/kiosk-info-phase.ts` | Create | Pure `KioskInfoPhase` type + `nextKioskInfoPhase(current, service)` transition function |
| `components/front/courses/enroll/model/kiosk-info-phase.test.ts` | Create | Unit tests for transition function (all 3 phases × new-student/other) |
| `components/front/courses/enroll/steps/EnrollInfoStep.tsx` | Modify | Render controlled phase, AnimatePresence wrappers, inline keypad cards, summary pill. Guard ALL new behavior behind `isKioskTerminalFlow` |

Minimal `EnrollModal` changes are required to let the existing footer Continue/Back controls drive the kiosk info sub-phases. No new dependencies.

## Interfaces / Contracts

```ts
// components/front/courses/enroll/model/kiosk-info-phase.ts
export type KioskInfoPhase = 'name-email' | 'phone' | 'pin'

export function nextKioskInfoPhase(
  current: KioskInfoPhase,
  service: string,
): KioskInfoPhase | 'done' {
  if (current === 'name-email') return 'phone'
  if (current === 'phone') return service === 'new-student' ? 'pin' : 'done'
  return 'done' // pin → done (outer modal handles)
}
```

```ts
// Inside EnrollModal — kiosk path only
const [kioskInfoPhase, setKioskInfoPhase] = React.useState<KioskInfoPhase>('name-email')

if (isKioskTerminalFlow && activeStepKey === 'info') {
  const nextPhase = nextKioskInfoPhase(kioskInfoPhase, service)
  if (nextPhase !== 'done') {
    setKioskInfoPhase(nextPhase)
    setActiveNumericField(nextPhase === 'phone' ? 'phone' : 'pin')
    return
  }
}
```

```ts
// Framer-motion variants (shared)
const phaseVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.18, ease: 'easeIn' } },
}
const pillVariants = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2 } },
}
```

**Render structure (kiosk branch only)**:

```
<div>
  <AnimatePresence>
    {kioskInfoPhase !== 'name-email' && <SummaryPill name={...} email={...} onEdit={...} />}
  </AnimatePresence>

  <AnimatePresence mode="wait">
    {kioskInfoPhase === 'name-email' && <motion.div key="name-email" {...phaseVariants}>...fields...</motion.div>}
    {kioskInfoPhase === 'phone'      && <motion.div key="phone"      {...phaseVariants}>...phone + KioskNumericKeypad inline...</motion.div>}
    {kioskInfoPhase === 'pin'        && <motion.div key="pin"        {...phaseVariants}>...pin fields + KioskNumericKeypad inline...</motion.div>}
  </AnimatePresence>

  {/* Non-kiosk branch: existing layout unchanged */}
</div>
```

Field values remain in `EnrollModal` state while only the current visual phase is rendered. `EnrollInfoStep` uses inline `nameEmailFields`, `phoneField`, and `pinFields` render helpers to avoid duplicating inputs.

**Edit handler**:
```ts
const handleEdit = () => {
  setKioskInfoPhase('name-email')
  setActiveNumericField(null)
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `nextKioskInfoPhase` transitions | Jest/Vitest — table-driven (3 phases × 2 services) |
| Component | Phase advances on Continue tap | RTL — render with `isKioskTerminalFlow=true`, fill fields, click Continue, assert phone field visible |
| Component | Continue after 10 phone digits | RTL — fill phone, click global Continue, assert pin phase |
| Component | Edit button resets to phase 1 | RTL — advance to phase 2, click Edit, assert name-email block visible + values preserved |
| Component | Non-kiosk flow unchanged | RTL — render with `isKioskTerminalFlow=false`, assert all fields visible simultaneously |
| Component | Non-new-student skips phase 3 | RTL — service=`drop-in`, complete phone, assert NO pin block appears |

## Migration / Rollout

No migration required. Single-file refactor + one new pure model file. Feature is gated by `isKioskTerminalFlow` (existing prop) — non-kiosk users see zero change. Rollback = revert the commit.

## Open Questions

None.
