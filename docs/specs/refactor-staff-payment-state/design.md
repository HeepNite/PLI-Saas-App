## Extraction Design
- Create `components/front/staff/paymentState.ts` as a pure helper module.
- Define small structural types in `paymentState.ts` instead of importing `PaymentRow` from the client file to keep coupling low.
- Preserve helper logic as-is; only relocate code.
- Create `components/front/staff/paymentTimelineTransforms.ts` as a pure timeline/payment-history transformer module.
- Define small structural row types in `paymentTimelineTransforms.ts` instead of importing large client-file types.
- Keep timeline transformer behavior byte-for-byte equivalent where practical; only relocate and wire imports/exports.

## Public Re-export Strategy
- Keep compatibility by re-exporting public helpers from `StaffUsersAdminClient.tsx`.
- Keep private helpers (`isCheckedInStatus`, `isPackageBackedDailyCheckIn`) non re-exported from `StaffUsersAdminClient.tsx`.
- Re-export timeline transformer helpers from `StaffUsersAdminClient.tsx` so existing test imports remain stable.

## Validation Plan
- Run targeted vitest suite for `StaffUsersAdminClient` and helper exports.
- Run focused eslint on touched files when practical.
- Report any pre-existing typecheck baseline issues separately if typecheck is run.
