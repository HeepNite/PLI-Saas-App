# Payroll Attendance Integrity (P0) — Tasks

> Documentation/planning artifact only. No application code changes in this phase.

## Implementation Slices (ordered)

1. **Closure service (idempotent, canonical)**
   - Implement on-demand closure service for open `StaffClockEntry` records.
   - Apply deterministic timestamp formula: `min(now, expectedClockOutAt+15m, clockInAt+600m)`.
   - Persist closure reason metadata + policy snapshot.
   - Define safe fallback path for weak/invalid expected anchors.

2. **Invoke closure before payroll reads (required P0 paths)**
   - payroll entries read endpoint/path
   - payroll run-payday endpoint/path
   - `me/payroll` endpoint/path
   - Enforce call order: close -> read -> derive hours.

3. **Canonical hours enforcement**
   - Ensure payroll derivation uses `StaffClockEntry` exclusively.
   - Remove dual-source authority from metadata-based approximations.

4. **Bridge/deprecate `publicMetadata.staffPayroll.hoursWorked`**
   - Update `users/profile` behavior to prefer canonical aggregate.
   - Keep compatibility behavior explicit and non-authoritative if temporary fallback is needed.
   - Add deprecation notes/contract language.

5. **Neutralize conflicting legacy writer behavior**
   - Constrain/remove `force_logout` metadata-hour mutation that conflicts with canonical DB policy.
   - Preserve auditability of any compatibility actions.

6. **Tests (P0 minimum set)**
   - Idempotent closure tests (repeat invocation no drift).
   - Closure timestamp boundary tests (grace/cap/now precedence).
   - Payroll invocation tests proving closure runs before derive-hours in all required paths.
   - Canonical-source tests (payroll ignores metadata authority).
   - Bridge tests for profile consistency/deprecation behavior.
   - Weak-expected-anchor fallback tests.

7. **Optional future slice (NOT P0): scheduler/cron**
   - Design and implement periodic closure only after infra exists.
   - Trigger based on operational need/metrics; keep separate from P0 delivery.

## Acceptance Gate Checklist

- [ ] Open entries no longer remain unpaid due to missing `actualClockOutAt` when payroll is read.
- [ ] Closure is deterministic, idempotent, and auditable.
- [ ] Payroll read paths (entries, run-payday, me/payroll) invoke closure before deriving hours.
- [ ] Payroll authority is canonical `StaffClockEntry` only.
- [ ] `publicMetadata.staffPayroll.hoursWorked` is deprecated as authority and bridged safely.
- [ ] Conflicting `force_logout` metadata-hour mutation is neutralized.
- [ ] Weak expected-clock-out fallback behavior is explicitly implemented and tested.
- [ ] No scheduler/cron dependency is required for P0 correctness.

## Dependencies / Open Items Before Implementation

1. Confirm exact fallback formula + reason codes for missing/zero/invalid `expectedClockOutAt`.
2. Confirm `users/profile` contract for canonical-hour bridge and deprecation messaging.
3. Confirm timezone/day-boundary policy for cap and grace evaluation.
