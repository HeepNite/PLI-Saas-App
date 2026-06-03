# Tasks — refactor-enroll-modal

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 900–1,500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 tests+pure model, PR2 container/reducer wiring, PR3 UI step decomposition |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units
| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Lock current behavior with focused tests + extract pure helpers | PR 1 | Lowest risk; no JSX decomposition yet |
| 2 | Introduce reducer/state model and keep UI behavior | PR 2 | Must preserve caller contract |
| 3 | Split step/overlay components after logic stability | PR 3 | Mostly structural, lower behavior risk |

## Phase 1 — Guardrails and Pure Logic Extraction
- [x] 1.1 Audit planned model logic against `lib/checkin/enroll-flow.ts`, `kiosk-qr-payment.ts`, `new-student-flow.ts`, `photo-context-policy.ts`, `kiosk-inactivity.ts`, and `package-offer-integration.ts`; document missing logic before creating `components/front/courses/enroll/model/*`.
- [x] 1.2 Add focused unit tests for reused `lib/checkin/*` contracts: step validation/transition, kiosk fast-path/masking/readiness, photo policy, new-student service selection, package-offer prefill, inactivity timeout.
- [x] 1.3 Extract only missing date/time and check-in autofill pure logic to `components/front/courses/enroll/model/checkin-autofill.ts`; import existing `lib/checkin/*` decisions instead of duplicating them.
- [x] 1.4 Keep `EnrollModal.tsx` re-export compatibility for existing imports.
- [x] 1.5 Run targeted tests: `tests/checkin/enroll-summary-format.test.ts` + new focused unit tests.
- [x] 1.6 No reducer or UI decomposition starts until Phase 1 tests prove behavior is locked.
- Rollback boundary: revert new model files and test additions only.
- Suggested commit: `test(enroll): lock checkin autofill and step guard behavior`

## Phase 2 — State Model / Reducer Introduction (Closed)
- [x] 2.1 Treat `components/front/courses/hooks/useEnrollDraft.ts` and its setter bundle as a critical seam; add coverage or a compatibility adapter before changing draft restore/save wiring.
- [x] 2.2 Create `enroll-flow.types.ts` and `enroll-flow.reducer.ts` for transition-critical state; reducer must call/reuse existing `lib/checkin/*` policies for check-in decisions.
- [x] 2.3 Introduce selectors in `enroll-selectors.ts` (totals, canContinue, step keys/index helpers) without reimplementing `lib/checkin/enroll-flow.ts` or `lib/checkin/kiosk-qr-payment.ts`.
- [x] 2.4 Wire reducer into container while preserving external props and callbacks.
- [x] 2.5 Add focused tests for reducer transitions (sign-in resume, kiosk transition flags, payment path guards) and draft seam behavior.
- [x] 2.6 Run targeted tests + scoped typecheck for touched files.
- Rollback boundary: revert reducer wiring while retaining pure helper tests.
- Suggested commit: `refactor(enroll): introduce reducer-driven flow state`
- Phase closure note: Phase 2 is approved/closed for planning; keep behavior unchanged while Phase 3 proceeds.

## Phase 3 — Side-Effect Adapter Isolation (Pending)
- [x] 3.1 Add callback timing tests for `CheckInQrClient` contracts: `onPaymentsStepReadyAction`, `onKioskSessionCreated`, `onExistingUserDetected`, `onTimeoutAction`, and `kioskSessionToken`.
- [x] 3.2 Verify pre-extraction gate: callback timing tests + current Phase 1/2 suites + `npx tsc --noEmit` must all pass.
- [x] 3.3 Extract checkout/checkin API calls into `effects/checkout-api.ts` only after 3.1/3.2 pass; preserve `kioskSessionToken` payload propagation.
- [x] 3.4 Extract kiosk QR polling orchestration into `effects/kiosk-qr-poller.ts` only after phase/status contract coverage exists; reuse `lib/checkin/kiosk-qr-payment.ts` decisions (no duplication).
- [x] 3.5 Keep EnrollModal behavior identical; replace inline effect bodies with adapter calls only after prior gates pass.
- [x] 3.6 Keep `field/set-*` as a temporary compatibility adapter during Phase 3; do not treat it as the final architecture destination.
- [x] 3.7 Add focused tests for adapter/mappers introduced in 3.3/3.4 (response-to-state mapping, retry branch decisions).
- Rollback boundary: revert adapter usage and keep reducer/model.
- Suggested commit: `refactor(enroll): isolate checkout and kiosk side effects`

Phase 3 guardrails (must hold):
- Do not extract checkout/checkin API calls before callback timing tests pass.
- Do not extract kiosk QR poller before phase/status contract coverage is in place.
- Do not start UI decomposition work in this phase.

## Phase 4 — UI Decomposition After Logic Stabilization
- [ ] 4.1 Start only after reducer/effects are stable and tested; do not use UI decomposition to change behavior.
- [ ] 4.2 Extract step components under `steps/` without behavior/copy changes.
  - Progress: info/contact step extracted to `components/front/courses/enroll/steps/EnrollInfoStep.tsx`; remaining steps still inline.
- [ ] 4.3 Extract summary/overlay rendering into `ui/` modules.
- [ ] 4.4 Remove only obsolete internal indirection; keep diagnostics removal for dedicated cleanup task.
- [ ] 4.5 Run focused tests + existing e2e smoke (`e2e/course-flow.spec.ts`, `e2e/checkin.spec.ts`) before merge.
- Rollback boundary: revert component extraction only.
- Suggested commit: `refactor(enroll): split steps and overlays after logic extraction`
