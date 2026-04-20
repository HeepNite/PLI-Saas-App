# Delta Specification: kiosk-ux-improvements

This delta spec documents the scoped changes to improve the kiosk user experience. It lists testable requirements, key scenarios (happy path and edge cases), acceptance criteria, and an API contract for the new PIN-check endpoint introduced in Point 5.

## Scope and context
- Stack: Next.js 15 App Router, TypeScript, Prisma ORM, Clerk auth, Vitest, strict_tdd: false
- Change name: kiosk-ux-improvements
- Active topic_key: sdd/kiosk-ux-improvements/spec
- Artifact store: engram

## 1) Numeric keyboard (LOW)
### Requirement
- Ensure numeric and phone inputs render with appropriate keyboards: use inputMode="tel" for phone fields and inputMode="numeric" for PIN fields. Affects: lib/checkin/sign-in-inputs.ts, EnrollModal.tsx, EmbeddedSignIn.tsx.

### Key scenarios
- Happy path: User taps a phone field; device shows telephone keypad; User taps a PIN field; device shows numeric keypad.
- Edge: User copy-pastes non-numeric characters into PIN field; input rejects non-numeric input where possible.

### Acceptance criteria
- inputMode attributes are present on all relevant fields.
- No crashes or layout shifts when keyboards change.
- Accessibility: screen readers announce the field type correctly via aria-labels.

### Notes
- If the device does not support inputMode hints, behavior gracefully falls back to default keyboards.

## 2) Prevent modal close on outside click (LOW)
### Requirement
- In kiosk new-student mode, clicking outside EnrollModal must NOT close the modal.
- The overlay close behavior currently wired at EnrollModal.tsx:2228-2233 should be disabled for the kiosk flow variant.

### Key scenarios
- Happy path: Click outside when not in kiosk mode closes overlay as before.
- Edge: In kiosk mode, outside clicks produce no close action.

### Acceptance criteria
- EnrollModal outside-click handler is conditionally disabled when variant === 'kiosk'.
- User flow cannot accidentally exit the modal during kiosk new-student.

### Notes
- Ensure unit/UI tests cover both kiosk and non-kiosk modes.

## 3) Camera consent popup (MEDIUM)
### Requirement
- Introduce a friendly consent step in ProfilePhotoCapture before requesting getUserMedia.
- Message: "We'll take a quick photo to speed up your next visit and provide a better experience" with a Continue button.
- Only after Continue is clicked, request camera permission.

### Key scenarios
- Happy path: ProfilePhotoCapture shows consent; user clicks Continue; getUserMedia is invoked.
- Edge: User declines permission; show a friendly fallback and guidance.

### Acceptance criteria
- Consent modal is shown prior to any camera access.
- getUserMedia is called only after user consents.
- Proper error handling/UX if permission is denied or unavailable.

### Notes
- Update tests to simulate permission prompts in a headless environment.

## 4) PIN reminder placement (LOW)
### Requirement
- Move the "remember your PIN" message from payments step to the info step, ensuring the text is in English.
- Current Spanish text at EnrollModal.tsx:3054-3067 must be removed.

### Key scenarios
- Happy path: PIN reminder appears near the PIN input in the info step.
- Edge: User switches to a different language; message remains English for this delta scope.

### Acceptance criteria
- PIN reminder text is visible in info step and no longer shown in payments step.
- Text is English and suitable for localization in the future.

### Notes
- Update UI tests to verify placement and locales.

## 5) Early PIN duplicate validation (MEDIUM)
### Requirement
- Add a new endpoint POST /api/checkin/pin/check to validate PIN uniqueness during the info step (on blur or before advancing to payment).
- Use lib/security/student-pin.ts helpers for validation.
- Consider rate limiting on this endpoint.
- The endpoint must not mutate user state beyond validation.

### API contract (Point 5)
- Path: /api/checkin/pin/check
- Method: POST
- Request body (JSON):
  - phone: string (E.164 or normalized local format, as used in the sign-in flow)
  - pin: string
  - kioskVariant?: boolean (optional flag to indicate kiosk mode, for server-side flow adjustments)
- Response body (JSON):
  - valid: boolean
  - reason?: string (present if valid == false)
  - next?: string (optional hint for next step, e.g., "go_to_payment" or "retry_pin")
- Headers: appropriate CORS and auth as per existing API conventions; rate limiting applies per IP/user per minute
- Security considerations: reuse existing PIN validation utilities; do not write PINs to logs; ensure no timing leaks visible to attackers.

### Key scenarios
- Happy path: PIN is unique; valid = true; next guides to payment.
- Duplicate PIN: valid = false; reason explains duplication; front-end prompts user to change PIN.
- Edge: PIN empty or invalid format; valid = false with reason.
- Rate limiting: exceed threshold returns 429 with a clear message.

### Acceptance criteria
- Endpoint exists and returns correct JSON for valid/duplicate/invalid inputs.
- Front-end calls are wired to info step (on blur/before navigation to payment).
- Rate limiting protects the endpoint; appropriate error surfaced to user.

### Notes
- Reuse lib/security/student-pin.ts helpers for validation; ensure consistency with existing flows.

## 6) Post-purchase new student → reset to idle (MEDIUM)
### Requirement
- After a successful new-student purchase, kiosk must reset to idle/start screen after a brief delay.
- Do not route back into the existing flow; always perform a clean station completion.
- Packages handling remains outside of this delta (separate SDD).

### Key scenarios
- Happy path: purchase succeeds; wait a few seconds; UI returns to idle screen.
- Edge: purchase process interrupted; ensure reset still happens when complete state is achieved.

### Acceptance criteria
- After purchase success, call station completion and render idle screen after a defined timeout (e.g., 3s).
- The next user starts from idle state, not from prior flow steps.

### Notes
- Tests should simulate end-to-end purchase and verify the final UI state.

## 7) Prevent "save password" prompts (LOW)
### Requirement
- Disable password managers from offering to save PINs by setting autoComplete="off" and using non-login-like field names for PIN inputs.
- Affects PIN and confirm PIN inputs in EnrollModal.

### Key scenarios
- Happy path: PIN fields do not trigger password-saving prompts.
- Edge: Browser autofill still behaves gracefully; avoid leaking sensitive data.

### Acceptance criteria
- PIN fields include autoComplete="off" and sanitized/neutral name attributes.
- No prompts suggesting password storage for PIN fields.

### Notes
- Update tests to verify input attributes.

## 8) Registered user bypass fix (BUG - MEDIUM)
### Requirement
- Verify that COMPLETED_PURCHASE_STATUSES is canonical and matches lib/purchase-status.ts (e.g., includes "paid", "succeeded" but not "completed" if not canonical).
- Ensure the fallback_regular → existing_detected → PIN screen flow uses the canonical statuses.

### Key scenarios
- Happy path: Status includes canonical values; flow progresses to PIN screen as expected.
- Edge: If a non-canonical value appears, system uses canonical mapping.

### Acceptance criteria
- Code references lib/purchase-status.ts for canonical statuses; tests cover mapping.
- End-to-end flow correctly reaches PIN screen after status evaluation.

### Notes
- This is a bug fix to ensure consistent status handling across the flow.


## Next steps
- Implement the delta in code (per the delta spec) and run the test suite.
- Update docs/specs/kiosk-ux-improvements/resolve.md with any contract reconciliations if needed.
