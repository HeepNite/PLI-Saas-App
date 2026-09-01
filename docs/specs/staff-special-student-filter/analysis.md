# Analysis

- The payments auxiliary loader already fetches catalog location and drop-in price by course slug.
- `parseScheduleRules` is the canonical safe parser and requires a rules array.
- The response row is assembled in `buildStaffPaymentResponseRow`; its context is built by `loadStaffPaymentsData`.
- Today category and History content filtering converge in `resolveStudentCardPayments`.
- Global profile fallback is controlled by `useStudentGlobalSearch`; it currently runs for any non-History category with no local match.
- History filter state is reducer-owned and rendered in `StaffPaymentsBoardControls`.
