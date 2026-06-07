# Resolution

## Contract Decisions

1. This feature will reuse the existing avatar upload infrastructure.
2. `kiosk_terminal` will continue using:
   - `PATCH /api/staff/users/[userId]/avatar`
3. `qr_phone` will continue using:
   - `POST /api/profile/avatar`
4. No new avatar upload endpoint will be introduced.
5. No Prisma schema change is allowed for this spec.
6. `external_web` will not receive any new mandatory-photo behavior in this spec.
7. The previous "no auth widening" rule is refined as follows:
   - no customer auth boundary will be widened
   - kiosk terminal may use the existing terminal session as an authorized kiosk actor for kiosk-scoped customer avatar upload
8. Existing payment endpoints may be extended only to support a pre-payment account preparation step when required by this feature. No new payment endpoint is introduced.

## Session Strategy

1. Kiosk terminal session and customer session are separate concerns.
2. The kiosk terminal must remain signed in as a terminal device, not as a customer.
3. A customer must never remain signed in on the shared kiosk after the flow ends.
4. After any successful terminal-registered action, the kiosk must reset customer state and return to its ready state for the next customer while preserving the terminal session.
5. Terminal-registered actions for this spec include:
   - successful card purchase finalization
   - successful cash purchase registration
   - successful package check-in completion
   - successful drop-in check-in completion
6. Explicit cancellation, modal close, or timeout must also reset the customer flow locally, even if no business action was registered.

## Context Strategy

1. One explicit `PhotoFlowContext` will be used:
   - `kiosk_terminal`
   - `qr_phone`
   - `external_web`
2. Context will be computed once from the existing onboarding and routing signals.
3. UI components must consume the resolved policy object instead of re-deriving rules locally.

## Flow Decisions

### `kiosk_terminal`

1. The terminal flow is terminal-managed.
2. For a new customer:
   - collect contact data
   - resolve early phone-based `new-student` eligibility during the contact-data step
   - if the customer is not eligible for `new-student`, show a popup, switch the flow to the regular $20 price, and continue without restarting the process
   - if the customer may qualify for `new-student` but phone verification is still required, complete the existing SMS phone verification step at that point in the flow
   - if SMS verification is not completed, show a popup, switch the flow to the regular $20 price, and continue without restarting the process
   - resolve or create the target customer account before photo
   - require live camera capture if the account has no avatar
   - continue to payment only after required photo is saved
3. For an existing customer:
   - resolve the target customer account during the identity step
   - if the account already has an avatar, skip the photo step
   - if the account does not have an avatar, require live camera capture before payment
4. Customer gallery upload is not allowed in `kiosk_terminal`.
5. Customer sign-in is not part of the normal kiosk flow.
6. Exception:
   - when the existing `new-student` rule requires SMS phone verification, the kiosk may temporarily establish a customer session only for that verification step
   - that temporary customer session must be cleared when the flow completes, is cancelled, times out, or returns to kiosk-ready state
7. Customer sign-in on the kiosk is not required for avatar upload.

### `qr_phone`

1. The QR phone flow remains customer self-service.
2. For a new customer:
   - collect contact data
   - resolve early phone-based `new-student` eligibility during the contact-data step
   - if the customer is not eligible for `new-student`, show a popup, switch the flow to the regular $20 price, and continue without restarting the process
   - if the customer may qualify for `new-student` but phone verification is still required, complete the existing SMS phone verification step at that point in the flow
   - if SMS verification is not completed, show a popup, switch the flow to the regular $20 price, and continue without restarting the process
   - prepare the account before payment
   - establish a valid customer session through the existing phone sign-in flow
   - require photo upload before payment if the account has no avatar
3. For an existing customer:
   - if sign-in is required, complete sign-in first
   - if the account already has an avatar, continue to payment
   - if the account has no avatar, require photo upload before payment
4. In `qr_phone`, live camera capture is preferred and gallery upload is allowed as fallback.
5. If a new QR user abandons the flow after account creation but before payment, the account may remain created without a completed purchase. This is acceptable and does not count as a completed sale or class entitlement.

## API And Auth Clarifications

### `PATCH /api/staff/users/[userId]/avatar`

1. This endpoint remains the terminal upload contract.
2. It may be authorized by either:
   - existing staff portal auth
   - existing authorized terminal session, only for kiosk-scoped customer avatar updates
3. When authorized by terminal session:
   - it must only allow updates for non-staff customer accounts
   - it must reject staff accounts
   - it must remain scoped to kiosk flow usage
4. No customer session is required for terminal avatar upload.

### `POST /api/profile/avatar`

1. This endpoint remains unchanged.
2. It still requires a valid authenticated customer session.
3. It remains the only QR phone self-service avatar upload contract in this spec.

### Pre-payment Account Preparation

1. Existing checkout infrastructure may support a pre-payment account preparation mode.
2. This mode must:
   - resolve an existing account or create a new customer account as required by context
   - avoid creating a Stripe payment intent when running in preparation-only mode
   - avoid creating a purchase record when running in preparation-only mode
   - return the minimum account metadata required by the flow
3. The preparation step must not, by itself:
   - complete a purchase
   - consume new-student eligibility
   - grant class access

## Minimal Architectural Changes

1. Add `photo-context-policy.ts` for context and policy resolution.
2. Add `camera-session.ts` for camera lifecycle and cleanup.
3. Add `avatar-upload.ts` as a typed wrapper over the existing upload endpoints.
4. Add `ProfilePhotoCapture` as a focused UI component.
5. Integrate the photo step into the existing onboarding flow only after the flow has enough account context to perform the correct upload.

## Spec Adjustments

1. The previous terminal assumption is corrected:
   - the kiosk terminal does not keep the customer signed in as part of the normal flow
   - it resolves or creates the customer account and uploads the avatar as a terminal-managed action
2. The previous QR assumption is corrected:
   - a new QR customer may require account preparation plus sign-in before avatar upload
3. The previous absolute auth statement is replaced with a narrower rule:
   - no customer auth widening
   - terminal session may authorize kiosk-scoped customer avatar upload
4. External web behavior remains unchanged.
5. Human-face validation, liveness, and image-content analysis remain outside this spec.

## Implementation Preconditions

1. In `kiosk_terminal`, the target customer account must be resolved or created before avatar upload begins.
2. In `kiosk_terminal`, the customer must not remain signed in on the shared device after the flow ends.
3. In `qr_phone`, a valid customer session must exist before `POST /api/profile/avatar` runs.
4. If camera access fails in `kiosk_terminal`, the flow remains blocked because gallery upload is not allowed there.
5. All new user-facing copy introduced by this feature must be English-only.
