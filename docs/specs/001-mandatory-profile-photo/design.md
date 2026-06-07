# SPEC-001 - Design

## Intent

Implement mandatory profile-photo behavior in kiosk-related flows without inventing new upload contracts or widening customer auth boundaries.

This feature should be a narrow extension of existing onboarding and avatar infrastructure.

## Architecture Principles

The implementation must follow:

- clean code
- SOLID principles
- reuse-first architecture
- minimal change surface

## Reuse Strategy

The implementation must reuse:

- existing avatar upload endpoints
- existing auth and permission helpers
- existing check-in and onboarding entry points
- existing profile and modal UI where practical

## Endpoint Strategy

Avatar upload is context-dependent:

- `kiosk_terminal`
  - use `PATCH /api/staff/users/[userId]/avatar`
  - allow existing terminal session authorization only for kiosk-scoped customer avatar updates
- `qr_phone`
  - use `POST /api/profile/avatar`
  - customer remains within self-service auth scope

No new upload endpoint should be introduced for this spec.

## Session Boundaries

- kiosk terminal session is device-scoped and persists across customers
- customer session must not persist on the shared kiosk
- terminal-managed customer avatar upload must not require customer sign-in on the kiosk
- qr phone self-service upload still requires a valid customer session
- exception: the kiosk may temporarily establish a customer session only when the existing `new-student` rule requires SMS phone verification
- that temporary customer session must always be cleared when the kiosk flow ends, is cancelled, times out, or returns to ready state

## Core Modules

### `photo-context-policy.ts`

Responsibilities:

- define `PhotoFlowContext`
- resolve the active context from existing onboarding signals
- return a typed photo policy

Policy output should include at least:

- `photoRequired`
- `allowCameraCapture`
- `allowGalleryUpload`
- `uploadMode`

### `camera-session.ts`

Responsibilities:

- start camera
- stop camera
- capture frame
- guarantee cleanup on unmount and navigation

### `avatar-upload.ts`

Responsibilities:

- choose the existing upload contract by context
- send `multipart/form-data`
- normalize upload responses and errors

This wrapper should not bypass existing auth rules.

### `ProfilePhotoCapture`

UI-only component.

Responsibilities:

- render the correct controls from policy
- manage capture interactions
- trigger upload through the upload wrapper
- expose completion state back to the parent flow

Business policy must stay outside the component.

## Flow Placement

The photo step must run only when upload is actually possible under the resolved contract.

That means:

- kiosk terminal flow must already know or create the target customer account before photo upload
- kiosk terminal flow must not require customer sign-in on the shared device for avatar upload
- QR phone flow must already have a valid customer session before self-service avatar upload
- if a new QR customer does not yet have an authenticated session, the flow must complete account preparation and sign-in before the photo step
- if `new-student` is selected, phone-based eligibility must be resolved during the contact-data step before photo and before payment
- if the customer does not qualify for `new-student`, or does not complete the required SMS verification, the flow must switch to the regular $20 path without restarting the process

Do not solve missing identity context by introducing a new avatar endpoint or by widening customer auth.

## Context Model

Define one explicit type:

`PhotoFlowContext = "kiosk_terminal" | "qr_phone" | "external_web"`

Avoid scattered booleans such as device flags, viewport checks, or route heuristics directly inside UI behavior.

## State Model

Recommended states:

- `idle`
- `camera_on`
- `captured`
- `uploading`
- `saved`
- `error`

Transitions must be explicit and cleanup-safe.

## Performance Considerations

- camera streams must never remain active in the background
- avoid unnecessary re-renders while camera is live
- keep the photo feature localized to the affected flow

## Logging

Capture and upload failures should use the existing logging style already present in the codebase.

## Non-Goals

This design does not include:

- face detection
- liveness
- image-content validation
- biometric trust scoring
