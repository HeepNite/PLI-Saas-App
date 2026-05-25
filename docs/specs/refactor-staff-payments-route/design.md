# Refactor Staff Payments Route Design

## Current problem

`app/api/staff/payments/route.ts` is still a large route handler. The biggest design issue is not only file length; it mixes request parsing, mode decisions, temporal boundaries, Prisma loading, enrichment, and response mapping.

## Design direction

Use small modules named by responsibility:

| Responsibility | Module |
| --- | --- |
| Query parsing and mode validation | `app/api/staff/payments/payments-request.ts` |
| Today NY window calculation | `app/api/staff/payments/payments-time.ts` |
| Prisma purchase query construction | `app/api/staff/payments/payments-query.ts` |
| Response row mapping | `app/api/staff/payments/payments-row.ts` |

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

Today attendance session boundaries use `getStaffPaymentsTodaySessionBounds(todayNY)` instead of inline non-null assertions. The helper names the contract explicitly: `todayNY` must be a valid `YYYY-MM-DD` value produced by `getStaffPaymentsTodayWindow()`, and the fixed `00:00` / `23:59` times are valid `HH:mm` inputs for `buildSessionStartsAt`.

## Query model

`buildStaffPaymentsFindManyArgs(request, todayWindow)` owns purchase `where`, `orderBy`, and `take` construction for the staff payments board.

It preserves the existing mode contracts:

- today mode scopes purchases to the NY today window and optional text search.
- history mode scopes purchases to metadata date range and optional text search, fetching one extra row for truncation detection.
- user history mode scopes purchases to `userId` and optional selected metadata date range.

## Response row model

`buildStaffPaymentResponseRow(item, context)` owns the final visible payment row shape for the staff payments board.

The route still owns data loading and orchestration. The row mapper owns field derivation only: customer fallback values, payment channel/category, settlement status, attendance linkage, active package projection, student PIN fallback, funding payment linkage, and Stripe failure projection.

## Testing strategy

- Add direct unit tests for request parsing.
- Add direct unit tests for purchase query construction.
- Add direct unit tests for temporal helpers when they encode a contract.
- Add direct unit tests for response row mapping.
- Keep existing API tests as regression coverage.
- Run `npx tsc --noEmit` after each slice.

## Constraints

- No behavior changes.
- No schema changes.
- No auth/rate-limit changes.
- Do not touch active parallel refactors (`StaffUsersAdminClient`, `EnrollModal`).
