# Delta Spec: Staff Manual Data Override

## Purpose
Allow owner/admin staff to manually correct student attendance, payment, package, and stats data when automated flows fail or produce inconsistencies. Every override MUST generate an immutable audit log entry.

## Attendance

### Requirement: Manual Attendance Override
Staff MUST be able to add, remove, or modify attendance records for any student.

| Scenario | Given | When | Then |
|---|---|---|---|
| Add missing attendance | Student has no record for a session | Staff adds attendance with status checked_in | Record created; package credit consumed; audit log entry written |
| Remove erroneous attendance | Attendance record exists | Staff removes the record | Record deleted; package credit restored; audit log entry written |
| Change status | Status is scheduled | Staff changes to no-show | Status updated; credit restored if applicable; audit log entry written |
| Revert check-in | Status is checked_in | Staff reverts to scheduled | Check-in reverted; credit restored; audit log entry written |

## Payment

### Requirement: Manual Payment Override
Staff MUST be able to modify purchase amount, settlement status, outstanding balance, and payment method.

| Scenario | Given | When | Then |
|---|---|---|---|
| Modify amount | Purchase amount is $100 | Staff changes to $80 | Amount updated; outstanding balance recalculated; audit log written |
| Toggle settlement | Settlement is pending | Staff marks as paid | Settlement status and purchase status updated; audit log written |
| Adjust debt | Student owes $50 | Staff clears debt | Outstanding balance updated to $0; audit log written |
| Fix method | Method is cash | Staff changes to card | Payment method updated; audit log written |

## Package

### Requirement: Manual Package Override
Staff MUST be able to adjust package purchase usage, credits, expiration, and status.

| Scenario | Given | When | Then |
|---|---|---|---|
| Adjust used classes | Used 3 of 10 | Staff sets used to 4 | Used count updated; remainingCredits recalculated; audit log written |
| Modify credits | Remaining credits is 7 | Staff sets to 5 | remainingCredits updated; audit log written |
| Change expiration | Expires 2024-01-01 | Staff extends to 2024-02-01 | expiresAt updated; audit log written |
| Change status | Status is active | Staff pauses it | Status updated; audit log written |

## Stats

### Requirement: Manual Stats Correction
Staff MUST be able to correct derived statistics when they drift from ground truth.

| Scenario | Given | When | Then |
|---|---|---|---|
| Correct completed classes | Stat shows 45 but actual is 46 | Staff sets completed classes to 46 | Stat updated; audit log written |
| Correct package classes used | Stat shows 8 but actual is 9 | Staff sets used to 9 | Stat updated; package reconciled if needed; audit log written |

## Audit Log

### Requirement: Immutable Audit Trail
The system MUST record every manual override with complete context.

| Scenario | Given | When | Then |
|---|---|---|---|
| Log entry created | Any manual change is submitted | Staff confirms the change | Audit entry persisted with staffId, staffName, targetUserId, timestamp, entity, field, valueBefore, valueAfter, reason |
| Student timeline | Audit entries exist for a student | Staff views student profile | Timeline displays all manual changes sorted by timestamp desc |
| Admin global view | Multiple audit entries exist | Owner accesses audit log view | Filterable list by staff, date range, and entity type |

## Permissions

### Requirement: Role-Based Access Control
Manual overrides MUST be restricted to authorized roles.

| Scenario | Given | When | Then |
|---|---|---|---|
| Owner allowed | User role is owner | Owner attempts manual override | Operation permitted |
| Admin allowed | User role is admin | Admin attempts manual override | Operation permitted |
| Staff denied | User role is staff | Staff attempts manual override | Operation denied with 403 |
| Global audit owner-only | User role is owner | Owner views global audit log | Full access granted |
| Global audit hidden | User role is admin or staff | Non-owner views global audit log | Access denied with 403 |

## API Contract Sketches

### Endpoints
- `POST /api/staff/attendance/override` — Add, remove, or modify attendance
- `POST /api/staff/payments/:id/override` — Modify payment fields
- `POST /api/staff/packages/:id/override` — Modify package purchase
- `POST /api/staff/stats/:userId/override` — Correct derived stats
- `GET /api/staff/audit-log?userId=&entity=&staffId=&from=&to=` — Query audit log

### Request Schema (example)
```json
{
  "targetUserId": "uuid",
  "action": "add|remove|update",
  "entity": "attendance",
  "field": "status",
  "value": "checked_in",
  "valueBefore": "scheduled",
  "reason": "Student checked in late"
}
```

## Edge Cases & Error Handling
- **403**: Insufficient role for manual override or audit log access
- **404**: Target entity (attendance, payment, package) not found
- **409**: Concurrent modification detected via valueBefore mismatch
- **422**: Invalid value for the target field
- Attendance removal MUST restore PackageUsageLedger credits or delete the ledger entry
- Payment amount changes MUST recalculate outstanding balance atomically within the same transaction
- Package credit adjustments MUST NOT allow negative remainingCredits

## Non-Functional Requirements
- Audit log MUST be append-only; no update or delete endpoints allowed
- All override operations MUST be atomic (wrapped in a DB transaction)
- Audit log queries for student profile timelines MUST complete within 200ms
- Reason field SHOULD be required for destructive actions (removal, no-show, debt clearance)
