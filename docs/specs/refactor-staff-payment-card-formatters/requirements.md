## Outcome
Extract student payment-card date/time formatting helpers from `StaffUsersAdminClient.tsx` into a focused pure module without behavior changes or breaking current test import paths.

## Requirements
- Move `formatIsoDateLong`, `formatStudentPaymentCardSlotLabel`, and `formatStudentPaymentCardDateTimeLabel` into `components/front/staff/studentPaymentCardFormatters.ts`.
- Keep helper behavior unchanged.
- Keep test-facing/public imports stable from `@/components/front/staff/StaffUsersAdminClient` via re-export.
- Keep extraction scope limited to these formatters only.

## Acceptance Criteria
- `studentPaymentCardFormatters.ts` contains extracted formatter helpers and local private dependencies.
- `StaffUsersAdminClient.tsx` imports internal usage from `./studentPaymentCardFormatters`.
- `StaffUsersAdminClient.tsx` re-exports `formatStudentPaymentCardSlotLabel` and `formatStudentPaymentCardDateTimeLabel`.
- Focused staff helper tests continue passing.
