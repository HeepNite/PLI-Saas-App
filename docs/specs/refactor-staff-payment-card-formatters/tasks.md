## Refactor Slice Checklist
- [x] Add minimal spec docs for requirements, design, and tasks.
- [x] Create `components/front/staff/studentPaymentCardFormatters.ts` with extracted date/time format helpers.
- [x] Update `StaffUsersAdminClient.tsx` to import formatter usage from `./studentPaymentCardFormatters`.
- [x] Re-export public formatter helpers from `StaffUsersAdminClient.tsx`.
- [x] Run focused validation (vitest + eslint on touched files) and capture results.
