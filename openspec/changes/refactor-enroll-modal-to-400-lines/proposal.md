# Proposal: Refactor EnrollModal to 400-Line Orchestrator

## Problem

`components/front/courses/EnrollModal.tsx` is a P0 monolith of **~3,497 lines** containing:

| Metric | Count |
|--------|-------|
| `useEffect` | 29 |
| `useCallback` | 37 |
| `useMemo` | 25 |
| `return` statements | 101 |

All booking paths (public, profile, check-in new/existing, kiosk terminal, QR/card/cash, PIN/SMS, consecutive offer, photo, draft, calendar, payments) live inline. This makes the file untestable in isolation, unsafe to change, and impossible to review in a single PR.

## Goals

- Reduce `EnrollModal.tsx` to ≤ 400 lines — an orchestrator that only composes already-extracted units.
- Extract cohesive slices into named hooks and sub-components under `components/front/courses/enroll/`.
- Preserve 100% of existing booking/flow behavior — no functional changes.
- Each extraction slice must be independently reviewable (≤ 400 changed lines per PR).

## Non-Goals

- No new features, UI changes, or API contract changes.
- No changes to `openspec/specs/` capability contracts — this is a pure refactor.
- No changes to tests not directly covering extracted units.
- No changes to runtime files outside the `courses/` subtree unless a shared hook is extracted.
- Tests directly covering extracted units may live under the existing `tests/checkin/` suite.

## Scope

### In Scope
- Extract shared prerequisite logic: `resolveStepValid` and modal-local type declarations.
- Extract side-effects into focused hooks: initialization, consecutive offer lookup, kiosk inactivity, and QR polling.
- Extract booking-surface UI into stateless sub-components: sidebar, overlays, and step router.
- Reduce `EnrollModal.tsx` to a ≤ 400-line shell that routes between extracted components.
- Add/extend unit tests for each extracted hook.

### Out of Scope
- Refactoring the model layer (`enroll/model/*`) — already extracted.
- Changes to `enroll/effects/checkout-api.ts` or `enroll/effects/kiosk-qr-poller.ts` behavior.
- Any server-side or API changes.
- Renaming public booking flows or modal props.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None — pure internal refactor; no spec-level behavior changes.

## Existing Seams (confirmed present)

| File | Role |
|------|------|
| `enroll/model/enroll-flow.reducer.ts` | State machine — extraction target for hook |
| `enroll/model/enroll-flow.types.ts` | Shared types |
| `enroll/model/enroll-selectors.ts` | Derived state |
| `enroll/model/enroll-services.ts` | API calls |
| `enroll/model/enroll-pricing.ts` | Pricing logic |
| `enroll/model/enroll-calendar.ts` | Calendar logic |
| `enroll/model/enroll-validation.ts` | Validation |
| `enroll/model/checkout-payload.ts` | Checkout assembly |
| `enroll/model/checkin-autofill.ts` | Check-in autofill |
| `enroll/effects/checkout-api.ts` | Payment effect |
| `enroll/effects/kiosk-qr-poller.ts` | QR poll effect |
| `enroll/steps/EnrollInfoStep.tsx` | Extracted step |
| `courses/hooks/useEnrollDraft.ts` | Draft hook |
| `courses/hooks/useNewStudentVerification.ts` | Verification hook |

## Proposed Approach

1. **Audit phase** — map all 29 `useEffect` / 37 `useCallback` / 25 `useMemo` to logical groups.
2. **Slice extraction** — each slice becomes one PR ≤ 400 lines:
   - Slice 1a: pure `resolveStepValid` extraction plus focused unit tests.
   - Slice 1b: type-only modal props extraction.
   - Slice 2a: consecutive-offer hook.
   - Slice 2b: initialization ref-scaffolding hook; Slice 2c moves the open-triggered initialization body. Keep `resetForm` inline unless a later slice explicitly budgets it.
   - Slice 3: kiosk inactivity and QR-poller hooks.
   - Slice 4a: sidebar and overlay sub-components.
   - Slice 4b: step-router sub-component.
   - Slice 5: orchestrator trim — `EnrollModal.tsx` cut to ≤ 400 lines.
3. Each slice ships as an independent chained PR: PR1a targets `codex/develop`,
   each follow-up PR targets the previous slice branch, and final integration
   returns the completed chain to `codex/develop`.
4. Keep `useReducer(enrollFlowReducer)` ownership in the orchestrator during this change; do not introduce a `useEnrollFlow` mega-hook.
5. No slice touches more than one logical concern.

## Delivery Strategy

- **Review budget**: 400 changed lines per PR (project standard).
- **This change exceeds budget**: ~3,100 lines of extraction expected across all slices.
- **Recommended**: 8+ chained PRs, each ≤ 400 lines; PR1a targets `codex/develop`, follow-ups target the previous slice branch, and the completed chain integrates back to `codex/develop`.
- **Chain order**: PR1a → PR1b → PR2a → PR2b → PR2c → PR3 → PR4a → PR4b → PR5 (`resetForm` remains deferred unless a later slice explicitly budgets it).
- **Decision gate before apply**: `sdd-tasks` must confirm exact slice boundaries before any code moves.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Behavior regression in one of the 10+ booking paths | High | Snapshot/integration tests per slice before extraction |
| Merge conflicts across 7 chained PRs | Medium | Rebase each slice on the previous before opening PR |
| Hidden coupling between inline effects | Medium | Audit phase maps dependencies before any extraction |
| Extracted hook rerenders differently than inline | Low | React DevTools profile before/after per slice |
| Kiosk or PIN/SMS path broken silently | Medium | Manual smoke test checklist per slice |

## Rollback Plan

Each chained PR is independently revertable. If a slice causes a regression:
1. Revert the offending PR branch on `codex/develop`.
2. The orchestrator `EnrollModal.tsx` from the previous slice remains valid.
3. No database or API changes exist to rollback.

## Acceptance Criteria

- [ ] `EnrollModal.tsx` is ≤ 400 lines after all slices land.
- [ ] `tsc --noEmit` passes with zero new errors.
- [ ] All existing Vitest tests pass green.
- [ ] ESLint reports zero new violations.
- [ ] Public booking, profile booking, check-in new/existing, kiosk terminal, QR/card/cash, PIN/SMS, consecutive offer, photo, draft, calendar, and payments flows verified manually or via tests.
- [ ] Each chained PR diff is ≤ 400 changed lines.
- [ ] No new `useEffect` / `useCallback` / `useMemo` added beyond what existed inline.
