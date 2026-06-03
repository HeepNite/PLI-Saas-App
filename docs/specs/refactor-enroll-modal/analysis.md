# Analysis — refactor-enroll-modal

## Current File Snapshot
- Target: `components/front/courses/EnrollModal.tsx`
- Size: **3,833 LOC**
- Hooks density:
  - `React.useState`: **44**
  - `React.useEffect`: **28**
  - `React.useMemo`: **27**
  - `React.useCallback`: **22**
  - `React.useRef`: **12**
- Exported helpers:
  - `formatCheckInSummaryDateTime` (line ~161)
  - `computeCheckInAutofill` (line ~264)

## Responsibility Map (Single-file Overload)
1. Date/time pure helpers and check-in autofill logic.
2. Flow mode derivation (default/check-in/kiosk/personal/station).
3. Large local state ownership and reset orchestration.
4. Step orchestration and gated step transitions.
5. New-student verification and fallback logic.
6. Account preparation + photo requirement routing.
7. Checkout orchestration (stripe/cash/qr).
8. Kiosk QR polling + completion sync.
9. Sign-in/sms modal coordination.
10. Full UI rendering for all steps and overlays.

## State / Effects Clusters
- **Initialization cluster**: open/draft/prefill hydration, contact bootstrapping, step bootstrap.
- **Flow guard cluster**: service validity, new-student lock, participants clamp, sign-in resume.
- **Kiosk automation cluster**: inactivity timer, fast-path auto-advance/auto-submit, payment transition overlay.
- **Checkout cluster**: stripe/cash/qr start + retry + status polling + completion.
- **Cross-cutting danger**: many effects mutate overlapping state (`step`, `requiresSignIn`, `processing`, `kioskQrCheckout`), increasing temporal coupling risk.

## External Dependencies and Callers
- Main callers:
  - `components/front/courses/CourseAsideRight.tsx` (inline + modal variants)
  - `components/front/ui/CourseEnrollTrigger.tsx`
  - `components/front/checkin/CheckInQrClient.tsx` (check-in new/existing kiosk flows)
  - `components/front/profile/ProfilePageClient.tsx` (exists, out-of-scope for this change)
- Core dependencies include:
  - check-in flow helpers (`lib/checkin/enroll-flow`)
  - kiosk QR helpers (`lib/checkin/kiosk-qr-payment`)
  - draft hook, verification hook, Clerk auth, Stripe modal, photo capture, i18n.

## Existing Tests and Coverage Signals
- Direct pure-helper test coverage:
  - `tests/checkin/enroll-summary-format.test.ts` covers exported helper behavior.
- Relevant end-to-end flows:
  - `e2e/course-flow.spec.ts` (enroll flow reaches stripe modal)
  - `e2e/checkin.spec.ts` (check-in opens booking + timeout behavior)
- Gap: no focused component-level tests for EnrollModal step transitions, kiosk fast-path transitions, or sign-in resume routing.

## Diagnostic / TODO Evidence (do not remove yet)
- `console.log("[stepKeys-debug] ...") // TODO: REMOVE - diagnostic`
- `console.log("[step-debug] handleFormStepSubmit", ...) // TODO: REMOVE - diagnostic`
- `console.log("[step-debug] advancing to next step", ...) // TODO: REMOVE - diagnostic`
- `console.log("[EnrollModal] demo submit", payload)`
