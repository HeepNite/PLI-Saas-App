# Design — refactor-enroll-modal

## Technical Approach
Move EnrollModal from monolithic mixed-responsibility component to a container + pure-domain modules + step components. Keep behavior and props contract stable while clarifying transitions and reducing unnecessary memo/state scattering.

Design guardrail: reuse existing `lib/checkin/*` policies before creating new logic under `components/front/courses/enroll/model/`. New model files may coordinate enroll-specific state, but they must not duplicate check-in flow, kiosk QR, new-student, photo-context, inactivity, or package-offer decisions already present in `lib/checkin`.

## Reuse-First Guardrails
| Existing module | Must reuse for |
|---|---|
| `lib/checkin/enroll-flow.ts` | step keys, initial step clamping, photo-step inclusion, contact-gate, post-photo routing |
| `lib/checkin/kiosk-qr-payment.ts` | kiosk QR phases/state, fast-path eligibility, info masking/auto-advance, payment transition timing, resolving overlay readiness, QR status mapping |
| `lib/checkin/new-student-flow.ts` | phone normalization, regular fallback lock, new-student service selection |
| `lib/checkin/photo-context-policy.ts` | photo context parsing/resolution, upload mode, photo-required policy |
| `lib/checkin/kiosk-inactivity.ts` | station inactivity timeout/controller behavior |
| `lib/checkin/package-offer-integration.ts` | package-offer scenario resolution, package offer context, EnrollModal prefill selection |

If a behavior looks missing, first extend the appropriate `lib/checkin/*` module with tests. Only add `components/front/courses/enroll/model/*` logic for EnrollModal-specific reducer events, selectors, or payload composition that has no existing check-in owner.

## Target Structure (proposed)
Under `components/front/courses/enroll/`:

- `EnrollModalContainer.tsx` — orchestration shell; preserves current external API.
- `model/enroll-flow.types.ts` — flow state/events/types.
- `model/enroll-flow.reducer.ts` — reducer for transition-critical state.
- `model/enroll-selectors.ts` — pure EnrollModal selectors only; import `lib/checkin/enroll-flow` and `lib/checkin/kiosk-qr-payment` for existing step/kiosk decisions.
- `model/checkin-autofill.ts` — only extracted pure time/date + autofill logic not already owned by `lib/checkin/*` (re-exported by `EnrollModal.tsx`).
- `model/checkout-payload.ts` — pure payload builders/mappers.
- `effects/checkout-api.ts` — fetch wrappers for checkout/checkin endpoints.
- `effects/kiosk-qr-poller.ts` — polling adapter; phase/state decisions stay aligned with `lib/checkin/kiosk-qr-payment.ts`.
- `steps/*.tsx` — step-focused render components (`PartyStep`, `DateTimeStep`, `InfoStep`, `PhotoStep`, `PackagesStep`, `ConsecutiveStep`, `PaymentsStep`, `ReviewStep`).
- `ui/EnrollSummaryPanel.tsx` and `ui/EnrollOverlays.tsx` — summary/sidebar + overlay rendering isolation.

`components/front/courses/EnrollModal.tsx` remains as compatibility entrypoint (exports + wrapper).

## Reducer / Model Plan
- Phase 2 must treat `components/front/courses/hooks/useEnrollDraft.ts` and its setter bundle as a critical seam. Do not change draft restore/save timing while introducing reducer state; first cover the seam with tests or an explicit compatibility adapter.
- Reducer owns transition-critical fields:
  - step, service/package/addons/participants
  - contact and payment selection
  - sign-in gate flags and resume intent
  - kiosk QR phase container + processing/error markers
  - success/completion state
- UI-local fields may stay local/ref-based:
  - visual loading shimmers, active keypad field focus, transient animation toggles.

## Data Flow (post-refactor)
UI event → dispatch(domain event) → reducer(next state) → effect adapters (if needed) → dispatch(result event) → render selectors.

## File Changes (planned)
| File | Action | Description |
|---|---|---|
| `components/front/courses/EnrollModal.tsx` | Modify | Convert to compatibility wrapper + re-exports |
| `components/front/courses/enroll/*` | Create | New architecture modules and step components |
| `tests/checkin/enroll-summary-format.test.ts` | Modify (minimal) | Keep helper import path stable or validate re-export stability |
| `tests/checkin/*` (focused new) | Create | Unit/component tests for extracted flow logic |

## Testing Strategy
- **Unit**: pure model/selectors/checkin-autofill/checkout mapper branches.
- **Component-focused**: step transition and gate behavior via EnrollModal container interactions.
- **Callback timing contract**: preserve `CheckInQrClient` integration timing for `onPaymentsStepReadyAction`, `onKioskSessionCreated`, `onExistingUserDetected`, `onTimeoutAction`, and `kioskSessionToken` propagation before moving reducer/effects.
- **E2E smoke (existing)**: `e2e/course-flow.spec.ts`, `e2e/checkin.spec.ts` unchanged as regression guard.

## Migration / Rollback
- Migrate in slices with compatibility wrapper always compiling.
- Rollback boundary per slice: if behavior drifts, revert latest slice without touching established modules.
- No schema/config migration required.
