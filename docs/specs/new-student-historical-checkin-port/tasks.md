# New Student Historical Check-in Production Port - Tasks

## Review Workload Forecast

| Metric | Forecast |
|---|---|
| Estimated changed lines | 761 before remediation; first-slice diff requires a clean PR boundary |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |
| Decision needed before apply | No — user selected the feature-branch chain |

This remediation is the first child slice. It targets only correctness blockers in the existing New Student historical check-in port and its direct evidence; it must not include later integration or unrelated Staff Board work.

## Implementation Order

1. [x] Update `lib/users.ts` so `upsertUserByIdentifiers` reports whether it created the local `User`; retain all current identifier merge behavior and callers.
2. [x] Port `app/api/staff/students/sessions/route.ts` as the bounded persisted-session selection read, authorized by `authorizeStudentOperationalRequest` and protected by its dedicated read limiter.
3. [x] Extend the same route's POST payload and validation with optional New York date plus `sessionId`; preserve the existing `staff:students:create` 30-per-minute IP limiter, Clerk flow, response fields, and `_staff_registration` purchase behavior.
4. [x] In `app/api/staff/students/route.ts`, resolve the persisted `ClassSession` server-side; enforce the inclusive `[today - 14 days, today]` New York calendar window and reject a mismatched, missing, future, invalid, or too-old session/date.
5. [x] In the POST transaction, create the optional attendance with `checkedInAt: session.startsAt`, preserve the `(userId, sessionId)` conflict, reserve eligible package credit through `reservePackageCreditForAttendanceTx` at `session.startsAt`, and create the attendance audit through `writeStudentDataAudit`.
6. [x] In `app/api/staff/students/route.ts`, write `profile.created` only for a new local student and keep it separate from the attendance audit, including each event's actor, entity identifiers, values, reason, and request IP.
7. [x] Update `components/front/staff/useStaffCreateStudentAdmin.ts` to own optional date/session state, fetch constrained sessions, build the optional POST fields, preserve errors, and call its existing `onSuccess` only after success.
8. [x] Update `components/front/staff/CreateStudentModal.tsx` to render the optional assignment controls. Retain the existing modal, payment controls, and no-check-in submit path.
9. [x] Update `components/front/staff/StaffStudentsBoardPanel.tsx` and `components/front/staff/buildStaffStudentsBoardPanelProps.ts` only as required by the expanded modal/hook props; retain the existing owner/admin/front-desk gate and `refreshPaymentsBoard` callback.

## Required Tests

1. [x] Extend `tests/api/staff-students-create.test.ts` for owner, admin, and front-desk success; denied staff; create and Clerk/local reuse; no-check-in compatibility; `_staff_registration` preservation; create limiter and `Retry-After`.
2. [x] In `tests/api/staff-students-create.test.ts`, cover the inclusive New York today and 14-days-ago boundaries; future, invalid, too-old, missing, and date-mismatched sessions; duplicate `(userId, sessionId)` conflict; and `checkedInAt === ClassSession.startsAt`.
3. [x] In `tests/api/staff-students-create.test.ts`, cover package reservation and ledger behavior at `session.startsAt`, plus distinct profile-creation and attendance audit calls with their actor data. Assert that local reuse does not emit a false `profile.created` audit.
4. [x] Add or extend a focused UI test for `components/front/staff/CreateStudentModal.tsx` or `components/front/staff/useStaffCreateStudentAdmin.ts` covering optional controls, selected-session request body, server error display, and exactly one successful refresh.
5. [x] Extend `components/front/staff/__tests__/StaffStudentsBoardPanel.test.tsx` only if prop wiring changes; retain the existing visibility coverage in `tests/ui/staff-create-student.test.ts`.
6. [x] Add a payment-board/reporting regression in the existing staff-payments test surface proving the historical check-in appears on the selected class date through `Attendance.checkedInAt`.

## Validation

- [x] Verify every acceptance criterion in `requirements.md` against the implemented production slice.
- [x] Run only the focused API, UI/hook, panel, and payment/reporting test files above.
- [x] Confirm no Prisma schema or migration change, preview-board refactor, override-route change, or unrelated board change entered the diff.

## First Feature-Chain Remediation Slice

- [x] Restore the established `upsertUserByIdentifiers` return shape and retain local-creation state through a compatible internal query.
- [x] Reject package selection and reservation when `purchasedAt` is after the persisted historical session start.
- [x] Add focused runtime route coverage for New York-today success and nonexistent persisted-session rejection.
- [x] Render the optional date/session controls and apply advisory client-side min/max bounds derived from the New York calendar date; server-side validation remains authoritative.
- [x] Run focused API, package, UI, and board tests; typecheck; and diff integrity checks.
