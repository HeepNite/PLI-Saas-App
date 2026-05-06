# Tasks: Monthly Reset

## Phase 1: Foundation (Schema & Utilities)

- [x] 1.1 Add MonthlyBoundary model to `prisma/schema.prisma` with fields: id, year, month, closedAt, closedByClerkId, notes, createdAt, unique constraint on [year, month], index on closedAt
- [x] 1.2 Generate and apply Prisma migration: `prisma migrate dev -n add_monthly_boundary`
- [x] 1.3 Create `lib/monthly-boundary.ts` with getMonthBoundariesNY(year, month) function using America/New_York timezone
- [x] 1.4 Add getCurrentMonthBoundariesNY() helper function to get current month boundary
- [x] 1.5 Add formatMonthKey(date) helper function for month display formatting
- [x] 1.6 Add runMonthClose(year, month, actor, notes?) function with upsert + override clearing logic

## Phase 2: Core API Implementation

- [x] 2.1 Create `app/api/admin/month-close/route.ts` with POST handler using authorizeOwnerOrAdminRequest() auth
- [x] 2.2 Add month-close endpoint input validation for year, month, notes parameters
- [x] 2.3 Integrate runMonthClose() in month-close endpoint with transaction and audit logging
- [x] 2.4 Create `app/api/staff/reports/monthly/route.ts` with GET handler for CSV generation
- [x] 2.5 Add monthly report endpoint query parameters: year, month, format with validation
- [x] 2.6 Implement CSV builder in monthly report endpoint mirroring audit-log pattern

## Phase 3: Board Query Scoping

- [ ] 3.1 Modify `app/api/staff/payments/route.ts` completedAttendances query to filter by current month boundaries
- [ ] 3.2 Modify globalPurchases query to filter by metadata.date within current month (with createdAt fallback)
- [ ] 3.3 Modify today-mode slotAttendances query to scope by current month
- [ ] 3.4 Update `components/front/staff/historyCardAggregates.ts` to accept optional currentMonthKey parameter
- [ ] 3.5 Implement month-scoped aggregation in historyCardAggregates for daily view mode

## Phase 4: UI Components & History

- [ ] 4.1 Create `components/front/staff/MonthDivider.tsx` component for month headers in Spanish format
- [ ] 4.2 Modify `StaffUsersAdminClient.tsx` to add month dividers in attendance history popup
- [ ] 4.3 Add month dividers to payment history popup in StaffUsersAdminClient
- [ ] 4.4 Add "Close Month" button to reports UI area in StaffUsersAdminClient
- [ ] 4.5 Connect close month button to month-close API with loading states and error handling
- [ ] 4.6 Add monthly report download button with year/month selection UI

## Phase 5: Testing

- [ ] 5.1 Write `tests/lib/monthly-boundary.test.ts` with DST edge cases (March 9, November 2)
- [ ] 5.2 Write `tests/api/admin-month-close.test.ts` covering idempotency, audit trails, authorization
- [ ] 5.3 Write `tests/api/staff-reports-monthly.test.ts` for CSV format, data scoping, permissions
- [ ] 5.4 Add integration test for board scoping: seed April+May data, verify May-only results
- [ ] 5.5 Add test for cross-month history dividers rendering correctly
- [ ] 5.6 Add test for override clearing with proper audit log creation

## Phase 6: Documentation & Polish

- [ ] 6.1 Document month-close workflow in staff guide
- [ ] 6.2 Add JSDoc comments to monthly-boundary.ts helper functions
- [ ] 6.3 Create stub `/api/cron/month-close` route for future automation (documented only)
- [ ] 6.4 Update AGENTS.md or project docs with monthly reset feature description