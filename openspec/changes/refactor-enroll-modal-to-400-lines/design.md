# Design: Refactor EnrollModal to 400-Line Orchestrator

## Technical Approach

Split `components/front/courses/EnrollModal.tsx` (~3,497 lines) into a thin
orchestrator plus focused hooks and sub-components under
`components/front/courses/enroll/`. Each extraction is a self-contained
chained PR ≤ 400 changed lines. No functional changes; the orchestrator
re-exports the same public surface after every slice.

---

## Architecture Decisions

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| State ownership | Keep `useReducer(enrollFlowReducer)` in orchestrator; pass `flowState + dispatchFlow` down | Move reducer into hook | Reducer already extracted; hook would just be a thin wrapper — not worth the indirection for Slice 1 |
| Hook granularity | One hook per cohesive concern (flow init, consecutive offer, kiosk inactivity, kiosk QR poll) | Single `useEnrollFlow` mega-hook | Mega-hook recreates the monolith; single-concern hooks are independently testable |
| `stepValid()` prerequisite | Move `stepValid` into `enroll/model/enroll-step-valid.ts` **before** extracting sidebar/stepper | Extract stepValid inline with sidebar | Sidebar, breadcrumb NAV, and step routing all read `stepValid`; extracting without sharing it would force prop-drilling or duplication |
| Sub-component props API | Flat explicit props (no Context) | React Context for flow state | Context adds indirection and testing complexity; with ≤ 400-line slices, explicit props remain manageable |
| `ConsecutiveOfferData` type | Keep import from `checkin/ConsecutiveClassOffer.tsx` in a follow-up; do not move during refactor | Move type to `enroll/model/` in this change | Moving the type touches non-sanity-audit files and risks cross-team conflicts — deferred per non-goals |

---

## Target Module Architecture

```
components/front/courses/
├── EnrollModal.tsx                         ← ORCHESTRATOR (≤ 400 lines after Slice 5)
├── enroll/
│   ├── model/
│   │   ├── enroll-flow.reducer.ts          ← EXISTING — untouched
│   │   ├── enroll-flow.types.ts            ← EXISTING — untouched
│   │   ├── enroll-selectors.ts             ← EXISTING — untouched
│   │   ├── enroll-services.ts              ← EXISTING — untouched
│   │   ├── enroll-pricing.ts               ← EXISTING — untouched
│   │   ├── enroll-calendar.ts              ← EXISTING — untouched
│   │   ├── enroll-validation.ts            ← EXISTING — untouched
│   │   ├── checkout-payload.ts             ← EXISTING — untouched
│   │   ├── checkin-autofill.ts             ← EXISTING — untouched
│   │   └── enroll-step-valid.ts            ← NEW (Slice 1 prerequisite)
│   ├── effects/
│   │   ├── checkout-api.ts                 ← EXISTING — untouched
│   │   └── kiosk-qr-poller.ts             ← EXISTING — untouched
│   ├── hooks/
│   │   ├── useEnrollInit.ts                ← NEW (Slice 2) — open/reset/prefill init effect
│   │   ├── useConsecutiveOffer.ts          ← NEW (Slice 2) — consecutive offer fetch effect
│   │   ├── useKioskInactivity.ts           ← NEW (Slice 3) — inactivity + station completion timers
│   │   └── useKioskQrPoller.ts             ← NEW (Slice 3) — QR poll effect wiring
│   ├── steps/
│   │   ├── EnrollInfoStep.tsx              ← EXISTING — untouched
│   │   ├── EnrollSidebar.tsx               ← NEW (Slice 4) — left aside: stepper nav + summary
│   │   ├── EnrollStepRouter.tsx            ← NEW (Slice 4) — main section: per-step content
│   │   ├── EnrollSignInOverlay.tsx         ← NEW (Slice 4) — requiresSignIn overlay
│   │   └── EnrollFlowPopup.tsx             ← NEW (Slice 4) — flowPopup modal
│   └── types/
│       └── enroll-modal-props.ts           ← NEW (Slice 1) — extracted Props type + local types
├── hooks/
│   ├── useEnrollDraft.ts                   ← EXISTING — untouched
│   └── useNewStudentVerification.ts        ← EXISTING — untouched
```

---

## Component / Hook Responsibility Boundaries

| Module | Owns | Does NOT own |
|--------|------|-------------|
| `EnrollModal.tsx` (orchestrator) | `useReducer` call, `useState` for ephemeral UI flags (stripe, pin, photo, kiosk transition), render root, callback composition, prop forwarding | Step content, sidebar content, overlay content |
| `enroll-step-valid.ts` | Pure `stepValid(stepKey, context)` function and `StepValidContext` type | UI state, side effects |
| `enroll-modal-props.ts` | `EnrollFlowVariant`, `EnrollCompletionMode`, `EnrollCheckInContext`, `EnrollPrefillSelection`, `PreparedAccountState`, `NewStudentVerifyResponse`, `FlowPopupState`, and the full `EnrollModalProps` type | Runtime logic |
| `useEnrollInit` | `open`-triggered initialization effect + `resetForm` callback | Reducer dispatch beyond init fields |
| `useConsecutiveOffer` | Fetch consecutive offer by `(courseSlug, date, time)`, manage abort controller | Consecutive state decisions (accept/decline handled by orchestrator) |
| `useKioskInactivity` | Station completion timeout, kiosk inactivity controller wiring | Kiosk QR payment logic |
| `useKioskQrPoller` | `createKioskQrPoller` lifecycle: start/stop/outcome dispatch | QR UI rendering |
| `EnrollSidebar` | Left aside: step breadcrumb nav (using `stepValid`), booking summary, calendar links (success state) | Form controls, submit logic |
| `EnrollStepRouter` | Switch on `activeStepKey` to render the correct step panel | State mutation, effect firing |
| `EnrollSignInOverlay` | `requiresSignIn` overlay: sign-in copy, `EmbeddedSignIn`, dismiss | Sign-in state management (orchestrator owns) |
| `EnrollFlowPopup` | `flowPopup` modal: title, message, Continue button | Flow popup state (orchestrator owns) |

---

## Data Flow

```
EnrollModalProps
       │
       ▼
EnrollModal (orchestrator)
  ├─ useReducer(enrollFlowReducer) → flowState, dispatchFlow
  ├─ useState (date, time, coupon, pin, stripe, photo, kiosk flags...)
  ├─ useEnrollDraft(...)
  ├─ useNewStudentVerification()
  ├─ useEnrollInit({ open, flowState, dispatchFlow, ... })
  ├─ useConsecutiveOffer({ courseSlug, date, time, consecutiveOffer })
  │     └─ returns { fetchedOffer, offerLoading }
  ├─ useKioskInactivity({ open, isStationCompletion, success, ... })
  ├─ useKioskQrPoller({ open, isKioskTerminalFlow, ... dispatchFlow })
  │
  ├─ stepValid(stepKey, ctx)           ← pure fn from enroll-step-valid.ts
  │
  ├─ EnrollSidebar
  │     props: { steps, stepIcons, step, setStep,
  │              stepValid, success, course, activeStepKey,
  │              isInline, isKioskTerminalFlow, t, ... }
  │
  ├─ EnrollStepRouter
  │     props: { activeStepKey, flowState, dispatchFlow,
  │              date, time, setDate, setTime,
  │              course, ... all per-step data ... }
  │
  ├─ EnrollSignInOverlay
  │     props: { requiresSignIn, signInPurpose, onDismiss,
  │              contact, isCheckInFlow, isKioskTerminalFlow,
  │              signInReturnTo, onKioskSessionCreated }
  │
  └─ EnrollFlowPopup
        props: { popup, onContinue }
```

---

## Extraction Dependency Graph

```
Slice 1 (prerequisite)
  enroll-step-valid.ts      ← no upstream deps (pure fn)
  enroll-modal-props.ts     ← no upstream deps (types only)
         │
         ▼
Slice 2 (effect hooks)
  useEnrollInit             ← depends on: flowState shape, dispatchFlow, model/*
  useConsecutiveOffer       ← depends on: ConsecutiveOfferData type, fetch
         │
         ▼
Slice 3 (kiosk hooks)
  useKioskInactivity        ← depends on: kiosk-inactivity lib
  useKioskQrPoller          ← depends on: kiosk-qr-poller effect
         │
         ▼
Slice 4 (UI sub-components)
  EnrollSidebar             ← depends on: enroll-step-valid.ts, steps shape
  EnrollStepRouter          ← depends on: all step components + flowState
  EnrollSignInOverlay       ← depends on: flowState fields
  EnrollFlowPopup           ← depends on: FlowPopupState type
         │
         ▼
Slice 5 (orchestrator trim)
  EnrollModal.tsx           ← imports all of the above; cut to ≤ 400 lines
```

---

## PR Slice Design

### Slice 1a — Prerequisite `stepValid` Model (~180 raw changed lines)

**Goal**: Unblock sidebar and step-router extraction by centralizing the
`stepValid` pure function first.

| File | Action | Est. Lines |
|------|--------|-----------|
| `enroll/model/enroll-step-valid.ts` | Create | ~60 |
| `tests/checkin/enroll-step-valid.test.ts` | Create focused unit coverage | ~90 |
| `EnrollModal.tsx` | Import `resolveStepValid`; delete inlined switch | ~30 |

**`StepValidContext` shape**:
```ts
type StepValidContext = {
  steps: Array<{ key: EnrollStepKey }>
  participants: number
  availableServices: EnrollmentOption[]
  service: string
  date: string
  time: string
  consecutiveOfferLoading: boolean
  contact: EnrollmentContact
  studentPin: string
  studentPinConfirm: string
  requiresPhotoStep: boolean
  photoSaved: boolean
  consecutiveChoiceMade: boolean
  paymentMethod: PaymentMethod
}
export const resolveStepValid = (stepIndex: number, ctx: StepValidContext): boolean
```

**Test strategy**: Pure function — unit test all 8 `stepKey` branches with
boundary values in the existing `tests/checkin/` suite. Zero React dependency.

**Rollback**: Revert PR1a; EnrollModal re-inlines `stepValid`.

---

### Slice 1b — Type-only Props Extraction (~180 raw changed lines)

**Goal**: Move modal-local types out of the orchestrator without changing any
runtime behavior.

| File | Action | Est. Lines |
|------|--------|-----------|
| `enroll/types/enroll-modal-props.ts` | Create type-only props module | ~80 |
| `EnrollModal.tsx` | Import props/supporting types; delete inline type declarations | ~100 raw |

**Test strategy**: Type-only extraction — `tsc --noEmit` and focused eslint.

**Rollback**: Revert PR1b; PR1a remains valid and EnrollModal re-inlines types.

---

### Slice 2a — Effect Hook: Consecutive Offer (≤400 changed lines including tests)

**Goal**: Extract the consecutive-offer fetch/reset effect first because it is
the smallest Slice 2 concern and has isolated tests.

| File | Action | Est. Lines |
|------|--------|-----------|
| `enroll/hooks/useConsecutiveOffer.ts` | Create | ~80 |
| `EnrollModal.tsx` | Replace consecutive-offer effect with hook call | ~40 |
| `tests/checkin/use-consecutive-offer.test.tsx` | Create focused hook tests | ~120 |

> **Budget gate**: The final PR diff must include tests and remain ≤400 changed
> lines against PR1b branch.

**`useConsecutiveOffer` signature**:
```ts
useConsecutiveOffer(input: {
  courseSlug: string
  date: string
  time: string
  consecutiveOffer: ConsecutiveOfferData | undefined
  enabled: boolean
  resetChoice: () => void
  resetAccepted: () => void
  resetAddedCents: () => void
}): {
  fetchedOffer: ConsecutiveOfferData | null
  offerLoading: boolean
}
```

**Behavior to preserve**:
- Do not fetch when `consecutiveOffer` prop is provided.
- Do not fetch when the flow is not enabled for the current booking path.
- Reset fetched offer/loading/choice/accepted/added-cents when date or time is missing.
- Abort the in-flight request on cleanup.

**Test strategy**:
- Reuse existing hook test style with `createRoot` + `act`.
- Assert disabled/no-date/no-time paths do not fetch and reset state.
- Assert successful fetch updates offer/loading and resets prior acceptance.
- Assert cleanup aborts the request.

**Rollback**: Revert PR2a; PR1a + PR1b state remains valid.

---

### Slice 2b — Effect Hook: Open Initialization (≤400 changed lines including tests)

**Goal**: Extract the open-triggered initialization/ref-sync logic after the
consecutive-offer behavior is isolated.

| File | Action | Est. Lines |
|------|--------|-----------|
| `enroll/hooks/useEnrollInit.ts` | Create | ~180+ |
| `EnrollModal.tsx` | Replace open initialization/ref-sync effects with hook call | ~90 |
| `tests/checkin/use-enroll-init.test.tsx` | Create focused hook tests | ~140+ |

> **Budget gate**: The final PR diff must include tests and remain ≤400 changed
> lines against PR2a branch. If `resetForm` extraction pushes this over budget,
> leave `resetForm` inline for Slice 2b and schedule Slice 2c.

**`useEnrollInit` signature**:
```ts
useEnrollInit(input: {
  open: boolean
  draftKey: string
  useDraft: boolean
  isKioskTerminalFlow: boolean
  isCheckInNewFlow: boolean
  isCheckInExistingFlow: boolean
  isCheckInFlow: boolean
  isQrMobileCompactFlow: boolean
  checkInContextDate: string
  checkInContextTime: string
  effectiveInitialStep: number
  initialServiceId: string
  availableServices: EnrollmentOption[]
  course: CourseEnrollmentData
  sourceCourses: CourseEnrollmentData[]
  prefillContactRef: React.RefObject<Partial<EnrollmentContact>>
  prefillSelectionRef: React.RefObject<EnrollPrefillSelection | undefined>
  userContactRef: React.RefObject<Partial<EnrollmentContact>>
  dispatchFlow: React.Dispatch<EnrollFlowAction>
  setDate: Dispatch<SetStateAction<string>>
  setTime: Dispatch<SetStateAction<string>>
  setCouponInput: Dispatch<SetStateAction<string>>
  setAppliedCoupon: Dispatch<SetStateAction<Coupon>>
  setCheckInScheduleNotice: Dispatch<SetStateAction<string | null>>
  setKioskStepHydrating: Dispatch<SetStateAction<boolean>>
  kioskFastPathAdvanceTriggeredRef: React.RefObject<boolean>
  kioskFastPathSubmitTriggeredRef: React.RefObject<boolean>
}): void
```

**Test strategy**:
- Mock sessionStorage + dispatch; assert initial field values dispatched on `open` flip.
- Cover default booking, check-in new flow, kiosk hydrating, and QR mobile compact today-only autofill.

**Reset-form decision**:
- `resetForm` is currently broad and touches kiosk, stripe, PIN, photo,
  consecutive, popup, refs, and reducer setters.
- Do not force it into Slice 2b if the signature or diff becomes noisy.
- If needed, create Slice 2c for reset cleanup after `useEnrollInit` lands.

**Rollback**: Revert PR2b; PR2a remains valid.

---

### Slice 3 — Kiosk Hooks: Inactivity + QR Poller (≤400 changed lines including tests)

**Goal**: Extract kiosk-specific timer and QR poll effects.

| File | Action | Est. Lines |
|------|--------|-----------|
| `enroll/hooks/useKioskInactivity.ts` | Create | ~110 |
| `enroll/hooks/useKioskQrPoller.ts` | Create | ~90 |
| `EnrollModal.tsx` | Replace inline effects with hook calls | ~80 |

> **Budget gate**: The final PR diff must include tests and remain ≤400
> changed lines against PR2 branch; split into 3a/3b if the test-inclusive
> diff exceeds budget.

**`useKioskInactivity` signature**:
```ts
useKioskInactivity(input: {
  open: boolean
  isStationCompletion: boolean
  success: boolean
  kioskQrPhase: KioskQrCheckoutState["phase"]
  onCompletedAction?: () => void | Promise<void>
  onTimeoutAction?: () => void
  stationCompletionTimeoutRef: React.RefObject<number | null>
}): void
```

**`useKioskQrPoller` signature**:
```ts
useKioskQrPoller(input: {
  open: boolean
  isKioskTerminalFlow: boolean
  kioskQrCheckoutPending: boolean
  sessionId: string | null
  onOutcome: (outcome: KioskQrPollerOutcome) => void
}): void
```

**Test strategy**:
- `useKioskInactivity`: fake timers; assert `onTimeoutAction` fires after
  inactivity window, resets on activity events, pauses during QR phase.
- `useKioskQrPoller`: mock `createKioskQrPoller`; assert poller started when
  `kioskQrCheckoutPending = true` and stopped on cleanup.

**Rollback**: Revert PR3; PR1a + PR1b + PR2 state still valid.

---

### Slice 4a — UI Sub-components: Sidebar + Overlays (~200 changed lines)

**Goal**: Extract the sidebar and overlay JSX into named stateless sub-components.

| File | Action | Est. Lines |
|------|--------|-----------|
| `enroll/steps/EnrollSidebar.tsx` | Create | ~160 |
| `enroll/steps/EnrollSignInOverlay.tsx` | Create | ~50 |
| `enroll/steps/EnrollFlowPopup.tsx` | Create | ~30 |
| `EnrollModal.tsx` | Replace sidebar and overlay JSX with component calls | ~60 budget reduction net |

**Test strategy**:
- `EnrollSidebar`: RTL snapshot; assert breadcrumb renders correct active/done
  states for a given `step` value and `stepValid` mock.
- `EnrollSignInOverlay` / `EnrollFlowPopup`: RTL; assert visibility and dismiss
  callback wiring.

**Rollback**: Revert PR4a; previous hook slices remain valid.

---

### Slice 4b — Step Router Sub-component (~200 changed lines)

**Goal**: Extract the main step-routing JSX into a named stateless sub-component.

| File | Action | Est. Lines |
|------|--------|-----------|
| `enroll/steps/EnrollStepRouter.tsx` | Create | ~160 |
| `EnrollModal.tsx` | Replace inline step routing with component call | ~40 budget reduction net |

**Test strategy**:
- `EnrollStepRouter`: RTL per-step render check; assert each `stepKey` renders
  its panel without throwing.

**Rollback**: Revert PR4b; PR4a remains valid.

---

### Slice 5 — Orchestrator Trim to ≤ 400 Lines (~200 changed lines)

**Goal**: Delete remaining inline code now covered by extracted modules;
assert `EnrollModal.tsx` line count ≤ 400.

| File | Action | Est. Lines |
|------|--------|-----------|
| `EnrollModal.tsx` | Remove dead import lines, inline helpers now in `enroll/model/`, inline callbacks now in hooks | ~200 removed |

**Test strategy**:
- Run `wc -l EnrollModal.tsx` in CI gate (or a Vitest file-size assertion).
- Full smoke test checklist: public booking, profile booking, check-in
  new/existing, kiosk terminal, QR/card/cash, PIN/SMS, consecutive offer,
  photo, draft, calendar, payments.
- `tsc --noEmit`, `vitest run`, `eslint` — zero new errors.

**Rollback**: Revert PR5; PR4 state is a valid ≤ 800-line orchestrator.

---

## File Changes Summary

| File | Action | Slice |
|------|--------|-------|
| `enroll/model/enroll-step-valid.ts` | Create | 1 |
| `enroll/types/enroll-modal-props.ts` | Create | 1 |
| `enroll/hooks/useEnrollInit.ts` | Create | 2 |
| `enroll/hooks/useConsecutiveOffer.ts` | Create | 2 |
| `enroll/hooks/useKioskInactivity.ts` | Create | 3 |
| `enroll/hooks/useKioskQrPoller.ts` | Create | 3 |
| `enroll/steps/EnrollSidebar.tsx` | Create | 4 |
| `enroll/steps/EnrollStepRouter.tsx` | Create | 4 |
| `enroll/steps/EnrollSignInOverlay.tsx` | Create | 4 |
| `enroll/steps/EnrollFlowPopup.tsx` | Create | 4 |
| `EnrollModal.tsx` | Modify (each slice) | 1–5 |

---

## Prerequisites and Coupling Notes

### `stepValid()` Prerequisite — MUST land in Slice 1

`stepValid` is currently an inline closure at line 2125 of EnrollModal. It reads
from closure scope (`steps`, `participants`, `service`, `contact`, `studentPin`,
`studentPinConfirm`, `requiresPhotoStep`, `photoSaved`, `consecutiveChoiceMade`,
`paymentMethod`, `consecutiveOfferLoading`).

The sidebar breadcrumb NAV uses it at lines 2332 and 2385. The continue gate
reads it at line 2156. Any extraction of `EnrollSidebar` or the step gate
without first externalizing `stepValid` would require duplicating the logic or
threading a private callback — both anti-patterns.

**Mandated order**: `enroll-step-valid.ts` ships in Slice 1 before sidebar or
step-gate extractions begin.

### `ConsecutiveOfferData` Type Coupling — Deferred Follow-up

`ConsecutiveOfferData` is defined in
`components/front/checkin/ConsecutiveClassOffer.tsx` (line 4), a non-courses
component. EnrollModal imports it directly (line 81). Extracting
`useConsecutiveOffer` will carry this cross-boundary import forward.

**Decision**: Do not move the type during this refactor. Schedule a follow-up
task after all 7 PRs land to promote `ConsecutiveOfferData` to a shared
location (e.g., `lib/checkin/consecutive-offer.types.ts`) and update all
consumers. That task is independent and non-blocking.

---

## Constraints — Behavior Preservation

- No new `useEffect` / `useCallback` / `useMemo` beyond what existed inline.
- Extracted hooks MUST preserve the exact dependency arrays of their inlined
  equivalents; lint rule `react-hooks/exhaustive-deps` must stay clean.
- No runtime changes outside the `courses/` subtree (except shared type follow-up,
  which is out of scope here). Direct tests may live under the existing
  `tests/checkin/` suite.
- `EnrollModal.tsx` public export signature (props interface) must not change.
- Exported re-exports `formatCheckInSummaryDateTime` and `computeCheckInAutofill`
  (currently lines 147–148) must remain exported from `EnrollModal.tsx`.
- All 10+ booking paths must be manually smoke-tested after each PR.

---

## Rollback Strategy

Each chained PR is independently revertable:

1. Identify the offending slice by bisecting the PR chain on `codex/develop`.
2. `git revert <slice-merge-commit>` on `codex/develop`.
3. The orchestrator from the previous slice is still a valid working state.
4. No database or API changes exist — rollback is purely file-level.
5. Re-run `tsc --noEmit` and `vitest run` to confirm the reverted state is green.

---

## Open Questions

- [ ] `ConsecutiveOfferData` type relocation: confirm timeline and target path
  after all 7 PRs land — assign as a separate tracked task.
