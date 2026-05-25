# Refactor Staff Payments Route Design

## Current problem

`app/api/staff/payments/route.ts` is still a large route handler. The biggest design issue is not only file length; it mixes request parsing, mode decisions, temporal boundaries, Prisma loading, enrichment, and response mapping.

## Design direction

Use small modules named by responsibility:

| Responsibility | Module |
| --- | --- |
| Query parsing and mode validation | `app/api/staff/payments/payments-request.ts` |
| Today NY window calculation | `app/api/staff/payments/payments-time.ts` |
| Prisma query construction | Future slice |
| Response row mapping | Future slice |

## Request model

`parseStaffPaymentsRequest(req)` returns a discriminated union:

- `mode: "today"`
- `mode: "history"` with `historyRange`
- `mode: "userHistory"` with `userHistoryId`
- an error variant for invalid history input

This avoids `historyRange!` and makes mode-specific state explicit.

## Temporal model

`getStaffPaymentsTodayWindow()` computes:

- `todayNY`
- `startOfTodayNY`
- `endOfTodayNY`

The request parser does not import date helpers. This keeps parser tests pure and fast.

## Testing strategy

- Add direct unit tests for request parsing.
- Keep existing API tests as regression coverage.
- Run `npx tsc --noEmit` after each slice.

## Constraints

- No behavior changes.
- No schema changes.
- No auth/rate-limit changes.
- Do not touch active parallel refactors (`StaffUsersAdminClient`, `EnrollModal`).
