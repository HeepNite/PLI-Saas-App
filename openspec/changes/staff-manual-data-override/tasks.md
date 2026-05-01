# Tasks: Staff Manual Data Override

## Phase 1: Database & Auth Foundation

- [x] 1.1 Add `StudentDataAudit` model to `prisma/schema.prisma` with fields: targetUserId, staffClerkId, staffName, entity, entityId, field, valueBefore (Json), valueAfter (Json), reason (String, required), ipAddress, createdAt. Indexes on (targetUserId, createdAt), (staffClerkId, createdAt), (entity, createdAt).
- [x] 1.2 Run `npx prisma migrate dev --name add_student_data_audit` and `npx prisma generate`.
- [x] 1.3 Create `authorizeOwnerOrAdminRequest()` in `lib/security/staff-portal-auth.ts` — allows role === "owner" || role === "admin" (reuse `isStaffAdminRole`), returns `StaffPortalAuthResult`.
- [x] 1.4 Create `lib/audit/student-data-audit.ts` with `writeStudentDataAudit()` helper following `writePayrollAudit` pattern — accepts params + optional PrismaTransaction, creates `studentDataAudit` record.

## Phase 2: API Endpoints

- [x] 2.1 Create `app/api/staff/students/[userId]/attendance/route.ts` — PATCH handler: authorizeOwnerOrAdminRequest, validate payload (action: add|remove|update, status, reason), atomic transaction updating Attendance + StudentDataAudit. Handle 403/404/409/422.
- [x] 2.2 Create `app/api/staff/students/[userId]/payments/route.ts` — PATCH handler: authorizeOwnerOrAdminRequest, validate payload (amount, settlementStatus, outstandingBalance, paymentMethod, reason), atomic transaction updating Purchase + StudentDataAudit. Recalculate outstanding balance atomically.
- [x] 2.3 Create `app/api/staff/students/[userId]/packages/route.ts` — PATCH handler: authorizeOwnerOrAdminRequest, validate payload (usedClasses, remainingCredits, expiresAt, status, reason), atomic transaction updating PackagePurchase + StudentDataAudit. Guard against negative remainingCredits.
- [x] 2.4 Create `app/api/staff/students/[userId]/stats/route.ts` — PATCH handler: authorizeOwnerOrAdminRequest, validate payload (completedClasses, packageClassesUsed, reason), atomic transaction updating stats + StudentDataAudit.
- [x] 2.5 Create `app/api/staff/students/[userId]/audit-log/route.ts` — GET handler: authorizeOwnerOrAdminRequest, query StudentDataAudit filtered by targetUserId, sorted by createdAt desc. Support pagination.
- [x] 2.6 Create `app/api/staff/audit-log/route.ts` — GET handler: authorizeOwnerRequest (owner-only), query StudentDataAudit with filters: staffId, entity, date range (from/to). Return 403 for non-owner.

## Phase 3: UI Integration

- [x] 3.1 Create `components/front/staff/StudentDataOverrideModal.tsx` — Modal with entity tabs (attendance|payment|package|stats), dynamic fields per entity, required reason textarea (max 500 chars), confirmation dialog, submit/cancel actions. Follows existing custom modal patterns (not shadcn Dialog).
- [x] 3.2 Integrate modal trigger into student profile card in `StaffUsersAdminClient.tsx` — add "Override data" button visible only to owner/admin users, plus "Show audit timeline" toggle button.
- [x] 3.3 Wire modal submit to appropriate PATCH endpoint based on selected entity, handle success/error states (403/404/409/422), show success confirmation with option for another override.
- [x] 3.4 Create `components/front/staff/AuditTimeline.tsx` — fetch from audit-log endpoint, display entries sorted by timestamp desc with expandable before/after values, staff name, entity badge, reason, pagination with load-more.

## Phase 4: Tests

- [x] 4.1 Unit test `writeStudentDataAudit` helper in `tests/lib/student-data-audit.test.ts` — verify record creation with mocked prisma, test with/without transaction, JsonNull normalization, all entity types.
- [x] 4.2 Unit test `authorizeOwnerOrAdminRequest` in `tests/lib/staff-portal-auth.test.ts` — owner allowed, admin allowed, staff denied (403), unauthenticated (401), DB mirror fallback, session expiry.
- [x] 4.3 API test attendance PATCH in `tests/api/staff-student-attendance-override.test.ts` — permission checks (403/401), add/remove/update scenarios, audit entry created, 409 on duplicate/concurrent, 404 student/session.
- [x] 4.4 API test payment PATCH in `tests/api/staff-student-payments-override.test.ts` — amount change recalculates balance, settlement toggle, payment method, ownership check (403), validation errors (400).
- [x] 4.5 API test package PATCH in `tests/api/staff-student-packages-override.test.ts` — credit adjustment, negative credit guard, expiration change, status change, unlimited package bypass, ownership check.
- [x] 4.6 API test stats PATCH in `tests/api/staff-student-stats-override.test.ts` — completed classes correction, package usage correction, both stats together, validation errors.
- [x] 4.7 API test audit-log GET in `tests/api/staff-audit-log.test.ts` — owner-only global view (403 for admin), student timeline query, filter by entity/date/staffId, pagination metadata.
- [x] 4.8 Integration test: full override flow in `tests/integration/staff-override-flow.test.ts` — attendance add/remove with credit consumption/restoration, payment multi-field audit, package multi-field audit, stats computation, audit timeline verification.
