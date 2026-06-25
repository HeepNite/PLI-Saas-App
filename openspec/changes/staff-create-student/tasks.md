# Staff Create Student - Tasks

## Status

`COMPLETE`

## Implementation Plan

### 1. API foundation and validation

- [x] Add focused API test coverage for `POST /api/staff/students` authorization, invalid identity input, invalid amount, and missing payment mode.
- [x] Create `app/api/staff/students/route.ts` with `authorizeStudentOperationalRequest()` and request parsing.
- [x] Add a local validation helper for email/phone/name/amount/payment mode with clear `400` responses.
- [x] Add rate-limit protection consistent with nearby staff mutation routes if an existing helper is available.

Slice note: route/validation skeleton is complete. Valid creation currently returns `501 NOT_IMPLEMENTED`; Clerk, DB user, Purchase, Stripe, audit, and UI work remain pending for later chained slices.

### 2. Clerk + local student identity

- [x] Add focused API tests for email-only creation, phone-only creation, and existing identity reuse.
- [x] Reuse `findClerkUserByIdentifiers()` before creation.
- [x] Extend or wrap `ensureClerkUser()` so phone-only creation is supported safely when the phone is E.164.
- [x] Ensure created/reused Clerk users do **not** receive staff role/category/subcategory metadata.
- [x] Link/create the local DB `User` with `upsertUserByIdentifiers()`.
- [x] Trigger Clerk-managed email invitation/activation for email input using the existing `client.invitations.createInvitation()` pattern with a student-facing redirect.
- [x] Return activation metadata for email invitation attempted and phone sign-in availability.

Slice note: Clerk/local identity is complete for zero-amount student creation. Amounts greater than zero still return `501 PAYMENT_NOT_IMPLEMENTED` until the Purchase/Stripe/audit slice lands.

### 3. Audit and purchase domain behavior

- [x] Add focused API tests for zero-amount, cash purchase, card QR purchase, and audit writes.
- [x] For zero amount, create only the student identity and profile audit entry.
- [x] For cash, create a pending `Purchase` using sentinel `courseSlug: "_staff_registration"` and metadata `source: "staff_created_student"`, `paymentMode: "cash"`, `isRegistrationDeposit: true`.
- [x] For card QR, create a pending `Purchase`, create a Stripe Checkout Session, store the session id in the supported model field or metadata, and return the checkout URL.
- [x] Configure card QR checkout expiry at 30 minutes.
- [x] Ensure Stripe metadata includes `purchaseId`, `userId`, `source`, and `isRegistrationDeposit`.
- [x] Write actor-aware `StudentDataAudit` entries for student creation and payment creation without logging full checkout URLs.

Slice note: Purchase, Stripe Checkout, and audit behavior are complete. The full backend API surface is implemented. Rate-limit protection remains pending.

### 4. Staff panel UI integration

- [x] Add focused UI tests for `New student` visibility by role/category and modal validation.
- [x] Add a `New student` action to `StaffStudentsBoardPanel` for owner/admin/front_desk via the existing operational permission boundary.
- [x] Add `useStaffCreateStudentAdmin.ts` to own modal/form state, submission, result state, QR state, and board refresh callback.
- [x] Thread create-student props through the existing staff users/admin composition and prop builder.
- [x] Add the create-student modal to the existing staff modal overlay composition.
- [x] Render success states for reused identity, cash pending payment, card QR expiry copy, email invitation attempted, and phone verification availability.
- [x] Refresh the relevant staff/student/payment board state after successful creation rather than optimistic-inserting duplicate aggregation logic.

Slice note: Frontend UI complete. Hook, modal, panel button, composition wiring, QR rendering via external QR API, and full-board refresh on success are all in place. UI-specific tests remain pending.

### 5. Payment board labeling/sentinel safety

- [x] Add or update focused tests proving `_staff_registration` records are labeled as registration deposits and not treated as class enrollment/attendance purchases.
- [x] Update payment/student board mapping only where needed to display a registration-deposit label for `source: "staff_created_student"` or `_staff_registration`.
- [x] Verify existing settlement flow can mark the pending cash registration deposit paid without class-specific side effects.

Slice note: Settlement routes now skip attendance/class-session creation for sentinel slugs starting with `_`. The board already displays `courseTitle` ("Staff Registration") as the course label, which is distinguishable without additional mapping changes.

### 6. Final validation

- [x] Run focused API tests for staff-create-student behavior.
- [x] Run focused UI tests for the staff student panel/modal behavior.
- [x] Run changed-file ESLint.
- [x] Run `npx tsc --noEmit`.
- [x] Run `git diff --check`.
- [x] Update this task checklist with completed items and any implementation notes.

## Review Workload Forecast

- Estimated changed lines: 650-950 lines.
- 400-line budget risk: High.
- Chained PRs recommended: Yes.
- Decision needed before apply: Yes.

Suggested PR/slice boundary:

1. **Backend slice**: API route, Clerk/local identity helper changes, purchase/Stripe/audit behavior, and API tests.
2. **Frontend slice**: staff panel action, modal/hook wiring, QR/success states, board refresh, and UI tests.
3. **Polish/sentinel slice** if needed: registration-deposit labeling/filtering and settlement-flow safety tests if the backend/frontend slices expose broader board changes.

Because the estimate exceeds the 400-line review budget, implementation should not start until the maintainer chooses chained PRs or approves a `size:exception`.

## Risks

- Clerk phone-only creation may require careful helper extraction because the current helper path is email-first.
- Stripe Checkout creation is an external side effect after local purchase creation; implementation must make failure states retryable and staff-visible.
- `_staff_registration` sentinel records can leak into class enrollment UI unless labeling/filtering is tested.
- UI composition may touch several staff panel files; keep the first apply slice backend-only to protect review focus.
