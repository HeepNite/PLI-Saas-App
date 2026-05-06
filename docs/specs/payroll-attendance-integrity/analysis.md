# Payroll Attendance Integrity (P0) — Analysis

## Objective

Validate current behavior against required contract: login must not be attendance check-in, and clock closure should be automatic.

## Evidence (current code-path reconstruction)

1. `app/staff/log-in/page.tsx` renders `StaffCheckInClient` with `mode="login"`.
2. `components/front/staff/StaffCheckInClient.tsx` `submitPin` posts to `/api/staff/checkin/pin` in both login and check-in modes; login uses `skipSession=false`; success copy indicates check-in recorded.
3. `app/api/staff/checkin/pin/route.ts` always mutates check-in/presence metadata and creates teacher `StaffClockEntry` before sign-in token.
4. `lib/clock/teacher-clock.ts` `createTeacherClockEntryWithSlugs` creates `StaffClockEntry` with `clockInAt`, `expectedClockOutAt`, `totalExpectedMinutes`, status `clocked_in`.
5. `lib/payroll/hours.ts` counts worked time only when `actualClockOutAt != null`.
6. No active route found that updates `StaffClockEntry.actualClockOutAt` and status `clocked_out` in normal flow.
7. `app/api/staff/users/[userId]/route.ts` `force_logout` separately approximates hours from `staffLastCheckInAt` into `publicMetadata.staffPayroll.hoursWorked`.

## Contract Gaps Identified

### G1. Auth-attendance coupling

Login flow currently traverses attendance check-in route and mutates attendance/payroll clock data.
Impact: authentication-only intent is violated; payroll inputs become noisy.

### G2. No reliable closure path

Worked hours logic requires closed entries (`actualClockOutAt`), but open entries appear not to be closed automatically in active path.
Impact: hours can be undercounted or missing for payroll.

### G3. Dual source of truth for hours

System uses both `StaffClockEntry` and metadata approximation (`staffLastCheckInAt` → `staffPayroll.hoursWorked`).
Impact: divergent totals, audit ambiguity, and reconciliation overhead.

### G4. UX/semantic mismatch

Login mode displays check-in semantics/success messaging, reinforcing wrong mental model.

## Risk Classification

- **P0 data integrity risk**: payroll hours contaminated or incomplete.
- **Operational risk**: staff forgetting manual checkout can leave indefinite `clocked_in` entries.
- **Audit risk**: inability to trace authoritative worked-hours origin.

## Constraints from Product Direction

- User decision: manual staff checkout is not required/preferred.
- Preferred direction: automatic closure to prevent forgotten logout/check-out.
- Admin/owner correction is allowed as fallback.
