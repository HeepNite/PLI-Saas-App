# Design: Staff Manual Data Override

## Technical Approach

Follow existing codebase patterns: `authorizeOwnerRequest()` for permission, `StaffPayrollAudit`-style audit model, per-entity PATCH endpoints under `/api/staff/students/[userId]/*`. UI as modal triggered from student profile card.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Audit model | Single `StudentDataAudit` model | Per-entity audit tables | Unified querying, consistent pattern with `StaffPayrollAudit` |
| Permission check | `authorizeOwnerRequest()` | New permission type | Reuse existing helper; owner+admin-manager already have portal access |
| API structure | PATCH per entity | Single unified endpoint | Matches existing patterns (`/payments/[id]`, `/payroll/entries/[id]`) |
| Reason field | Required on write | Optional | Audit compliance, accountability |

## Data Flow

```
Staff UI (Modal)
      │
      ▼
PATCH /api/staff/students/[userId]/{entity}
      │
      ├─► authorizeOwnerRequest()
      │
      ├─► Validate payload + load current entity
      │
      ├─► prisma.$transaction([
      │       entity.update(...),
      │       studentDataAudit.create(...)
      │   ])
      │
      └─► Return updated entity
```

## Database Schema

```prisma
model StudentDataAudit {
  id             String   @id @default(cuid())
  targetUserId   String               // Student being modified
  staffClerkId   String               // Staff who made the change
  staffName      String               // Denormalized for display
  entity         String               // "attendance" | "payment" | "package" | "stats"
  entityId       String?              // ID of modified record (null for stats)
  field          String               // Field name modified
  valueBefore    Json?
  valueAfter     Json?
  reason         String               // REQUIRED
  ipAddress      String?
  createdAt      DateTime @default(now())

  @@index([targetUserId, createdAt])
  @@index([staffClerkId, createdAt])
  @@index([entity, createdAt])
}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `StudentDataAudit` model |
| `lib/audit/student-data-audit.ts` | Create | Audit helper (matches `writePayrollAudit` pattern) |
| `app/api/staff/students/[userId]/attendance/route.ts` | Create | PATCH attendance (status, add, remove) |
| `app/api/staff/students/[userId]/payments/route.ts` | Create | PATCH payment (amount, status, method) |
| `app/api/staff/students/[userId]/packages/route.ts` | Create | PATCH package (credits, expiry, status) |
| `app/api/staff/students/[userId]/stats/route.ts` | Create | PATCH computed stats (manual correction) |
| `app/api/staff/students/[userId]/audit-log/route.ts` | Create | GET audit history for student |
| `components/staff/student-override-modal.tsx` | Create | Modal UI for all override actions |

## Interfaces / Contracts

```typescript
// Audit helper
type WriteStudentDataAuditParams = {
  targetUserId: string
  staffClerkId: string
  staffName: string
  entity: "attendance" | "payment" | "package" | "stats"
  entityId?: string | null
  field: string
  valueBefore: unknown
  valueAfter: unknown
  reason: string
  ipAddress?: string | null
}

// PATCH request body (example: attendance)
type PatchAttendanceBody = {
  action: "update_status" | "remove"
  attendanceId: string
  status?: "scheduled" | "checked_in" | "checked_out" | "no_show"
  reason: string
}

// PATCH request body (example: package)
type PatchPackageBody = {
  action: "adjust_credits" | "extend_expiry" | "change_status"
  packagePurchaseId: string
  remainingCredits?: number
  expiresAt?: string  // ISO date
  status?: "active" | "expired" | "cancelled"
  reason: string
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `writeStudentDataAudit` helper | Mock prisma, verify audit row shape |
| API | Permission checks | Mock auth, verify 403 for non-owner |
| API | Audit logging | Verify transaction writes both entity update + audit |
| E2E | Modal flow | Playwright: open modal, submit, verify UI update |

## Migration / Rollout

1. Run `prisma migrate dev` to create `StudentDataAudit` table
2. No data migration needed (new feature)
3. Feature flag optional but not required (owner-only feature)

## Open Questions

- [ ] Should stats corrections also update `PackageUsageLedger`? (recommend: no, audit only)
- [ ] Max reason length? (recommend: 500 chars)
