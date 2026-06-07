# Payroll Attendance Integrity (P0) — Canonical Hours + On-Demand Closure Design

## Technical Intent

P0 standardizes payroll hours on `StaffClockEntry` and eliminates auth/session-derived hours as an authority. Because no scheduler/cron infrastructure exists in the repository, P0 uses **idempotent on-demand closure** executed immediately before payroll read paths.

Policy defaults: `graceMinutes=15`, `overtimeThresholdMinutes=15`, `maxDailyPayableMinutes=600 (10h)`.

## Current-State Constraints (Driving Design)

1. `StaffClockEntry` is currently write-once from explicit check-in and is not auto-closed by active code.
2. `deriveHoursWorked` only counts entries with `actualClockOutAt != null`; open entries contribute `0` hours.
3. Payroll APIs already rely on `deriveHoursWorked` and therefore require deterministic closure before read.
4. Staff profile/user surfaces still read legacy `publicMetadata.staffPayroll.hoursWorked`, creating dual-source inconsistency.
5. Existing `force_logout` mutates metadata-derived hours from `staffLastCheckInAt`, which conflicts with canonical DB policy.

## P0 Architecture

### 1) Canonical Source Rule

- Authoritative payroll hours SHALL come from `StaffClockEntry` only.
- Legacy metadata (`publicMetadata.staffPayroll.hoursWorked`) is compatibility-only during migration and MUST NOT drive payroll decisions.

### 2) On-Demand Closure Service (Idempotent)

Introduce a service layer operation (e.g., `closeOpenClockEntriesForPayroll(...)`) that:

1. Finds open entries (`actualClockOutAt == null`) in the payroll read scope.
2. Computes deterministic closure timestamp:
   - `candidateA = now`
   - `candidateB = expectedClockOutAt + 15m`
   - `candidateC = clockInAt + 600m`
   - `closureAt = min(candidateA, candidateB, candidateC)`
3. Writes closure fields atomically for still-open entries only.
4. Stores closure metadata (`closureReason`, `autoClosedAt`, policy snapshot).

Idempotency contract:
- If an entry is already closed, service performs no mutation.
- Repeated invocation yields the same final closed state (no double-count expansion).

### 3) Closure Reason Metadata

Persist closure audit fields in `metadata` for P0:
- `closureReason`: `on_demand_expected_grace` | `on_demand_daily_cap` | `on_demand_now_guardrail` | `admin_adjustment` | `manual_checkout`
- `autoClosedAt`
- `policySnapshot`: `{ graceMinutes, overtimeThresholdMinutes, maxDailyPayableMinutes }`
- `closureSource`: `payroll-read-entries` | `payroll-run-payday` | `payroll-me`

### 4) Invocation Points (P0 Required)

Invoke closure service immediately before any payroll hour derivation in:
- payroll entries read path
- payroll run-payday path
- `me/payroll` (staff self payroll summary)

Ordering rule:
1. Close open entries (idempotent)
2. Re-query/read closed+open set
3. Derive hours from canonical entries

## Legacy Metadata Bridge/Deprecation

### Goal

Remove dual-source inconsistency without breaking existing consumers abruptly.

### P0 Bridge

1. Payroll computation endpoints: canonical DB only.
2. `users/profile` staff payroll hours field:
   - Preferred: map from canonical `StaffClockEntry` aggregate.
   - Transitional fallback (only if unavoidable): return metadata but mark as deprecated/non-authoritative in contract and logs.
3. Disable or constrain `force_logout` metadata hour mutation so it cannot conflict with canonical payroll totals.

### Deprecation Path

- Mark `publicMetadata.staffPayroll.hoursWorked` as deprecated in spec + API docs.
- Keep temporary compatibility read only while bridge consumers migrate.
- Remove metadata dependency in later phase after consumers confirmed.

## Edge Cases / Safety

### Weak Expected Clock-Out Anchors

If `expectedClockOutAt` is missing, invalid, or implies zero/negative duration:
- Service MUST apply a safe fallback timestamp policy (non-future, bounded by cap).
- Service MUST set explicit audit reason/code for fallback path.
- Final fallback formula remains an open resolve item (see `resolve.md`).

### Presence Policy

Valid P0 presence evidence remains limited to:
- explicit check-in
- real panel activity
- admin/owner adjustment

Auth session presence alone SHALL NOT be treated as work presence.

## Why No Scheduler in P0

No scheduler/cron infrastructure currently exists in this repository. Introducing infra in P0 increases scope and operational risk. On-demand closure provides deterministic correctness at payroll read time with minimal architecture expansion.

Scheduler-based proactive closure is explicitly deferred as a future optional enhancement.

## Testability Hooks

P0 implementation should be testable via:
- idempotency tests for repeated closure calls
- deterministic closure timestamp tests across boundary cases
- invocation-order tests proving closure runs before derive-hours
- bridge tests proving profile/payroll surfaces do not diverge silently
