## Outcome
Extract payment-state helper logic from `StaffUsersAdminClient.tsx` into a focused module without changing runtime behavior or public helper import paths.

Follow-up slice: extract timeline/payment-history transformer helpers from `StaffUsersAdminClient.tsx` into a focused module, preserving behavior and helper import paths from `StaffUsersAdminClient.tsx`.

## Requirements
- Move the payment-state helper logic into `components/front/staff/paymentState.ts`.
- Keep existing behavior exactly the same for all moved helpers.
- Keep test-facing/public helper imports stable from `@/components/front/staff/StaffUsersAdminClient` via re-export.
- Keep extraction scope limited to payment-state helpers only; do not include unrelated refactors.
- Move timeline/payment-history transformer helpers into `components/front/staff/paymentTimelineTransforms.ts`.
- Keep existing behavior exactly the same for moved timeline/payment-history helpers.
- Keep test-facing/public helper imports stable from `@/components/front/staff/StaffUsersAdminClient` via re-export for timeline/payment-history helpers.

## Acceptance Criteria
- `paymentState.ts` contains:
  - `isCheckedInStatus`
  - `isPackageBackedDailyCheckIn`
  - `isPaymentPaidForUi`
  - `paymentStateLabel`
  - `resolveDailyVisiblePayment`
  - `checkInStateTone`
  - `resolveStudentPinTone`
- `StaffUsersAdminClient.tsx` re-exports public helpers:
  - `isPaymentPaidForUi`
  - `paymentStateLabel`
  - `resolveDailyVisiblePayment`
  - `checkInStateTone`
  - `resolveStudentPinTone`
- Internal uses in `StaffUsersAdminClient.tsx` consume helpers from `./paymentState`.
- Focused tests pass for existing helper coverage.
- `paymentTimelineTransforms.ts` contains:
  - `transformPaymentRowsToEvents`
  - `transformPaymentRowsToAttendance`
  - `resolveAttendanceHistoryRows`
  - `resolvePaymentHistoryRows`
- `StaffUsersAdminClient.tsx` re-exports these helpers from `./paymentTimelineTransforms`.
