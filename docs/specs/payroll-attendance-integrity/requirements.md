# Payroll Attendance Integrity (P0) — Requirements

## Purpose

Define a strict contract between staff authentication, attendance, and payroll hours so payroll data is not contaminated by non-attendance actions.

## Scope

- In scope: login vs check-in separation, clock-entry creation rules, and canonical payroll hours from `StaffClockEntry`.
- In scope: P0 on-demand automatic closure invoked by payroll read paths (no scheduler/cron in P0).
- In scope: P0 policy defaults (grace, threshold, cap, valid presence sources).
- Out of scope (Phase 2 candidate): rich admin correction UX, advanced attendance exception handling, and scheduler-based periodic closure.

## Requirements

### R1. Login MUST authenticate only

Staff login MUST only perform authentication/session creation.
Login MUST NOT create, update, or close attendance/payroll time records.

#### Acceptance Criteria

1. Logging in from staff login screen does not create a `StaffClockEntry`.
2. Logging in does not mutate attendance metadata fields used as check-in proxies (e.g., `staffLastCheckInAt`, `staffCheckInCount`).
3. Login success copy/messages do not state that check-in was recorded.

### R2. Check-in MUST be explicit

Attendance check-in MUST happen only from an explicit staff check-in action.

#### Acceptance Criteria

1. Check-in endpoint is invoked only by explicit check-in flow (not by login flow).
2. Check-in creates/updates attendance artifacts exactly once per intended check-in event.
3. Multiple logins without explicit check-in do not change attendance state.

### R3. Payroll hours MUST use one canonical source

Payroll computed worked hours MUST come from one explicitly defined canonical source.
For P0, canonical source SHALL be `StaffClockEntry` entries with deterministic closure and `actualClockOutAt` set.

#### Acceptance Criteria

1. Canonical source of truth for payroll hours is `StaffClockEntry` only.
2. Payroll APIs derive hours from `StaffClockEntry` (not `publicMetadata.staffPayroll.hoursWorked`) and totals are reproducible from DB entries alone.
3. Any legacy metadata field used by profile surfaces is explicitly treated as compatibility-only and MUST NOT be authoritative for payroll.

### R4. Automatic checkout/clock closure is REQUIRED

Staff manual checkout MUST NOT be required to close worked-time entries.
System MUST automatically close open entries via an idempotent on-demand closure step executed before payroll reads.

#### Acceptance Criteria

1. Open clock entries are auto-closed without staff action when payroll data is requested.
2. P0 closure timestamp default is deterministic: `min(now, expectedClockOutAt + 15m, clockInAt + 10h/600m cap)`.
3. Closure operation is idempotent: running it multiple times on already-closed entries does not change hours.
4. Forgotten logout/check-out cannot leave indefinite open entries that produce `0` hours in payroll due to missing `actualClockOutAt`.
5. Weak/invalid schedule anchors (e.g., zero-duration or missing `expectedClockOutAt`) MUST trigger a safe fallback policy and audit flag.

### R5. Admin/Owner correction path SHOULD exist

Admin/owner correction capability SHOULD be available as a fallback for exceptions (late corrections, wrong auto-closure).

#### Acceptance Criteria

1. Contract permits correction authority for admin/owner roles under existing auth boundaries.
2. If not delivered in P0, correction path is explicitly marked Phase 2 with no conflict to P0 automation.

### R6. P0 hybrid overtime policy defaults MUST be enforced

P0 payroll-attendance integrity MUST apply a fixed default policy for overtime classification and payable-hour safeguards.

#### Acceptance Criteria

1. Grace period default is **15 minutes** after expected clock-out before overtime review rules apply.
2. Overtime review threshold default is **15 minutes** (overtime under threshold remains classified but does not require escalation by default policy).
3. Maximum daily payable cap default is **10 hours**; any excess must be flagged for review and audit.
4. P0 valid work-presence evidence sources are limited to: **explicit check-in**, **real panel activity**, and **admin/owner adjustment**.
5. Logged-in/session-open state alone is explicitly invalid as work presence and MUST NOT increase payable hours.
6. Policy defaults are marked as P0 baseline values and MAY be refined in later phases using production evidence.

### R7. Legacy metadata hours MUST be deprecated as authority

`publicMetadata.staffPayroll.hoursWorked` MUST NOT be used as authoritative payroll hours in P0.

#### Acceptance Criteria

1. Payroll calculation endpoints ignore legacy metadata as primary source.
2. `users/profile` and related staff-facing reads either bridge from canonical `StaffClockEntry` totals or clearly label metadata as compatibility/deprecated.
3. Legacy writers that mutate metadata hours from auth/session heuristics are removed or constrained to non-authoritative compatibility behavior.

## Non-Functional / Security Constraints

1. Existing authentication/authorization boundaries MUST be preserved.
2. Attendance and payroll mutations MUST remain auditable.
3. No cross-school data mutation exposure may be introduced.
