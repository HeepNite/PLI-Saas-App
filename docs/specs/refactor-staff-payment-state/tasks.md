## Refactor Slice Checklist
- [x] Add minimal spec docs for requirements, design, and tasks.
- [x] Create `components/front/staff/paymentState.ts` with extracted helpers.
- [x] Update `StaffUsersAdminClient.tsx` to import internal helper usage from `./paymentState`.
- [x] Re-export public payment-state helpers from `StaffUsersAdminClient.tsx`.
- [x] Run focused validation (tests; eslint if practical) and capture results.

## Timeline Transform Extraction Slice
- [x] Extend this spec to include timeline/payment-history transformer extraction scope.
- [x] Create `components/front/staff/paymentTimelineTransforms.ts` with pure timeline/payment-history transformers.
- [x] Update `StaffUsersAdminClient.tsx` to import timeline/payment-history transformers from `./paymentTimelineTransforms`.
- [x] Re-export timeline/payment-history transformer helpers from `StaffUsersAdminClient.tsx`.
- [x] Run focused validation (vitest + eslint on touched files) and capture results.
