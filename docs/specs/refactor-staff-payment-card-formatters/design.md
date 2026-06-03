## Extraction Design
- Create `components/front/staff/studentPaymentCardFormatters.ts` as a pure helper module.
- Keep formatter logic byte-equivalent where practical; relocate only.
- Keep private helper dependencies (`normalizeClockTime`, `formatClockLabel`) local to the new module.

## Public Re-export Strategy
- Re-export `formatStudentPaymentCardSlotLabel` and `formatStudentPaymentCardDateTimeLabel` from `StaffUsersAdminClient.tsx`.
- Keep existing import paths stable for tests and external callers.

## Validation Plan
- Run focused vitest suites for `StaffUsersAdminClient` and helper exports.
- Run focused eslint on touched files.
