# Requirements — refactor-enroll-modal

## Goal
Behavior-preserving refactor of `components/front/courses/EnrollModal.tsx` (3,833 LOC) to reduce cognitive load, isolate business logic, and make state transitions explicit without changing user-visible behavior.

## In Scope
- Refactor internal structure of EnrollModal into smaller, testable modules.
- Preserve existing runtime behavior for:
  - default course enrollment flow
  - check-in new/existing variants
  - kiosk terminal fast paths, QR checkout, sign-in/sms gates, photo gate
- Preserve existing public exports from `EnrollModal.tsx`:
  - `formatCheckInSummaryDateTime`
  - `computeCheckInAutofill`
  - default `EnrollModal`
- Add/adjust focused tests to lock behavior before and during risky movement.

## Functional Requirements
1. Refactor MUST preserve all current EnrollModal props contract and callback semantics used by existing callers.
2. Refactor MUST keep step routing behavior equivalent for all generated step keys (`party`, `datetime`, `info`, `photo`, `packages`, `consecutive`, `payments`, `review`).
3. Refactor MUST preserve current API usage/sequence (`/api/checkout/*`, `/api/checkin/*`) and payload fields.
4. Refactor MUST preserve all kiosk-specific timing/transition semantics (inactivity, payment transition overlay, QR polling cadence).
5. Logic extraction MUST prioritize pure model/selector functions over UI-only file splitting.
6. State management MUST reduce scattered local state ownership by introducing an explicit state model (reducer or equivalent state machine-like transition model) where it simplifies reasoning.
7. `useMemo` usage MUST be retained only where it prevents real recomputation/churn; ornamental memoization MUST be removed during apply phase.

## Non-Goals (Hard Constraints)
- No staff/profile feature mixing or expansion.
- No endpoint changes.
- No database schema changes.
- No auth boundary changes.
- No UX copy/content changes (movement/reuse allowed if exact behavior/copy preserved).
- No broad unrelated refactors.

## Quality Requirements
- Refactor plan MUST produce reviewable slices with rollback boundaries.
- Each risky logic move MUST have test coverage first (or same slice red/green).
- Resulting architecture SHOULD separate:
  - pure decision logic
  - side-effect adapters (network/session/timers)
  - client rendering components
