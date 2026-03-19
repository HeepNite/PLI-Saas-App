# SPEC-001 - Implementation Tasks

## Phase 1 - Flow Wiring

- [ ] wire the feature into the existing kiosk terminal entry point
- [ ] wire the feature into the existing QR phone entry point
- [ ] identify the first safe moment where kiosk flow already knows the target user
- [ ] identify the first safe moment where QR phone flow already has a valid customer session
- [ ] define the kiosk-ready reset behavior after any terminal-registered action
- [ ] identify the minimum pre-payment account-preparation step needed for new QR customers before photo upload
- [ ] place early `new-student` eligibility resolution in the contact-data step
- [ ] define the fallback path from `new-student` to the regular $20 flow without restarting the process

## Phase 2 - Context And Policy

- [ ] add a dedicated `photo-context-policy.ts`
- [ ] define the explicit `PhotoFlowContext`
- [ ] centralize policy resolution for:
  - `photoRequired`
  - `allowCameraCapture`
  - `allowGalleryUpload`
  - upload mode by auth context

## Phase 3 - Upload Contract Wrapper

- [ ] add `avatar-upload.ts`
- [ ] support `PATCH /api/staff/users/[userId]/avatar` for `kiosk_terminal`
- [ ] support `POST /api/profile/avatar` for `qr_phone`
- [ ] support the kiosk terminal upload path under terminal-session authorization for kiosk-scoped customer avatar updates
- [ ] support a preparation-only account step through existing checkout infrastructure without creating payment or purchase records
- [ ] normalize upload errors into one typed result shape

## Phase 4 - Camera Session

- [ ] add `camera-session.ts`
- [ ] implement start camera
- [ ] implement stop camera
- [ ] implement frame capture
- [ ] guarantee cleanup on close, unmount, and navigation

## Phase 5 - UI Integration

- [ ] add or extend `ProfilePhotoCapture`
- [ ] render camera controls only when policy allows
- [ ] hide gallery upload in `kiosk_terminal`
- [ ] allow gallery upload in `qr_phone`
- [ ] keep all new UI copy in English

## Phase 6 - Flow Placement And Gating

- [ ] place the photo step only after upload is possible under the resolved contract
- [ ] block completion when photo is required but not saved
- [ ] unblock once upload succeeds
- [ ] reset kiosk customer state after any successful terminal-registered action while preserving the terminal session
- [ ] ensure explicit cancel, close, or timeout also clears the local customer flow state
- [ ] require early `new-student` eligibility handling before photo and before payment
- [ ] show popup and switch to the regular $20 flow when `new-student` is not allowed or phone verification is not completed
- [ ] keep `external_web` unchanged

## Phase 7 - Tests

- [ ] unit test context and policy resolution
- [ ] unit test camera lifecycle cleanup
- [ ] integration test upload visibility by context
- [ ] integration test completion blocking
- [ ] integration test kiosk reset and no residual customer session
- [ ] integration test QR new-customer account preparation without purchase creation
- [ ] integration test `new-student` fallback to the regular $20 flow
- [ ] integration test phone-verification-required path before photo and before payment
- [ ] e2e test kiosk terminal flow
- [ ] e2e test QR phone flow
- [ ] e2e test unchanged external flow

## Phase 8 - Final Validation

- [ ] verify no schema changes were introduced
- [ ] verify no new endpoint was added
- [ ] verify no customer auth boundary was widened and terminal authorization stayed kiosk-scoped
- [ ] verify acceptance criteria from `requirements.md`
