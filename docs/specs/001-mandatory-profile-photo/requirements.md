# SPEC-001 - Mandatory Profile Photo In Kiosk/QR Context

## Status

`ALIGNED - READY FOR PLAN`

## Objective

Ensure that profiles created through school-operated kiosk and kiosk-assisted QR onboarding flows include a recognizable profile photo.

The business goal is fast front-desk recognition during check-in and customer support workflows.

This feature must reuse existing avatar infrastructure and must not introduce new persistence models, new auth models, or biometric verification.

## Scope

### In scope

- Mandatory photo policy in kiosk-related onboarding contexts.
- Explicit context model for `kiosk_terminal`, `qr_phone`, and `external_web`.
- Context-based rules for live camera vs gallery upload.
- Reuse of existing avatar upload endpoints by auth context.
- UI gating so required flows cannot complete without a saved photo.
- Camera lifecycle cleanup.

### Out of scope

- Face recognition.
- Human/liveness verification.
- Image-content analysis of gallery photos.
- ID-document verification.
- New database schema.
- New avatar upload endpoints.

## Context Definition

The feature must resolve a single explicit context value and pass that value through the onboarding flow.

Allowed values:

- `kiosk_terminal`
- `qr_phone`
- `external_web`

This context must not be inferred through scattered booleans across multiple components.

## Context Rules

### 1. Kiosk terminal

Device: school-owned tablet or terminal device used in the venue.

Rules:

- profile photo is required
- photo must come from live camera capture
- gallery or file upload is not allowed
- flow completion is blocked until the photo is saved
- if camera is unavailable or permission is denied, there is no gallery fallback in this context

### 2. Phone via kiosk QR

Device: customer phone after entering through the kiosk QR flow.

Rules:

- profile photo is required
- live camera capture is allowed
- gallery upload is allowed
- flow completion is blocked until the photo is saved

### 3. External web

Device: standard desktop or non-kiosk web onboarding.

Rules:

- current behavior remains unchanged
- no new mandatory-photo requirement is introduced

## Functional Requirements

- Required-photo gating applies only in `kiosk_terminal` and `qr_phone`.
- After any successful terminal-registered action, the kiosk must reset customer state, sign out any residual customer session, and return to its ready state while preserving the terminal session.
- The camera stream must stop when the user captures, cancels, closes the modal, leaves the screen, or the component unmounts.
- Retake must discard the temporary captured image and return to camera mode.
- Upload failures must show a retry path.
- All new user-facing copy introduced by this feature must be in English.

### New-Student Decision Timing

New-student eligibility must be resolved during the contact-data step, before photo and before payment.

The flow must perform early phone-based eligibility verification.

Outcomes:

- if the phone is not eligible for `new-student`, show a popup explaining that the customer does not qualify for the new-student price, switch the flow to the regular $20 price, and continue without restarting the process
- if the phone may qualify for `new-student` but phone verification is still required, require SMS phone verification at that point in the flow before the customer can continue under the `new-student` price
- if SMS verification is not completed, show a popup, switch the flow to the regular $20 price, and continue without restarting the process
- only fully eligible and phone-verified customers may continue under `new-student`

## Flow Sequencing

Photo upload must happen only after the flow has enough account context to use the correct authorized avatar endpoint.

Context-specific sequencing:

- `kiosk_terminal`
  - upload is terminal-managed
  - the target customer account must already be resolved or created before the avatar upload step runs
  - the customer is not part of the normal kiosk sign-in flow
  - exception: when `new-student` requires SMS phone verification under the existing rule, the kiosk may temporarily establish a customer session only for that verification step
- `qr_phone`
  - upload is customer self-service
  - the customer must already have a valid authenticated session before the avatar upload step runs
  - for new customers, account preparation may happen before payment so the existing sign-in flow can establish the required session

This feature does not widen customer auth boundaries to make uploads work earlier in the flow.

## Policy Enforcement

The context policy must be resolved through one shared policy mechanism.

All UI consumers must rely on that shared policy.

The system must not duplicate photo rules across unrelated components.

## File Validation

Uploaded files must follow existing server-side validation rules already enforced by the avatar endpoints.

Typical constraints:

- accepted image MIME types are controlled by the existing endpoint
- maximum file size is controlled by the existing endpoint

No new validation rules should be introduced in this spec.

## API Contract

The feature must reuse the existing avatar upload contracts by auth context.

### Kiosk terminal upload contract

Endpoint:

`PATCH /api/staff/users/[userId]/avatar`

Usage:

- only for terminal-managed kiosk flow
- only after the target user is known
- may be authorized by the existing terminal session for kiosk-scoped customer avatar upload
- customer sign-in on the kiosk is not required for avatar upload

### QR phone upload contract

Endpoint:

`POST /api/profile/avatar`

Usage:

- only for customer-authenticated QR phone flow
- only when a valid customer session exists

Constraints:

- no new upload endpoint may be introduced
- no customer auth boundary may be widened
- request format remains `multipart/form-data` with `file`

## Data Model

- no Prisma schema change required
- no new Clerk user fields required
- only the final image file is stored
- no raw camera stream is persisted

## UX States

The photo flow must support:

- `idle`
- `camera_on`
- `captured`
- `uploading`
- `saved`
- `error`

## Error States

The feature must handle:

- camera permission denied
- no camera available
- capture failure
- invalid file type
- upload failure
- required photo missing

## Security Rules

The implementation must preserve:

- existing auth and permission rules
- existing rate limits
- existing server-side file validation

Frontend gating is required for UX, but backend validation remains authoritative.

This spec does not include biometric verification or any image-content trust decision.

## Acceptance Criteria

- [ ] `kiosk_terminal` requires live camera capture and hides gallery upload.
- [ ] `qr_phone` allows either live camera capture or gallery upload.
- [ ] `external_web` behavior remains unchanged.
- [ ] Required kiosk/QR flows cannot complete without a saved photo.
- [ ] After any successful terminal-registered action, the kiosk returns to ready state for the next customer and no customer session remains active on the device.
- [ ] Camera streams are always released after capture, cancel, close, unmount, or navigation.
- [ ] No customer auth boundary is widened and no new avatar endpoint is added.
- [ ] No database migration is introduced.

## Definition Of Done

- [ ] acceptance criteria are satisfied
- [ ] no schema change was introduced
- [ ] no new endpoint was added
- [ ] existing avatar endpoints were reused by context
- [ ] relevant tests cover policy, upload gating, and cleanup behavior
- [ ] no unrelated external-web onboarding behavior changed
