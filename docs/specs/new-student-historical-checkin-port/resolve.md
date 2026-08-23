# New Student Historical Check-in Production Port - Resolution

## Resolved Contract

| Topic | Decision |
|---|---|
| Delivery strategy | Extend the existing Staff Board New Student vertical slice on `origin/main`. Do not cherry-pick or port the preview board refactor. |
| UI point | Add the optional date/session controls to `CreateStudentModal` and retain `useStaffCreateStudentAdmin` as its state and submit owner. The existing panel header button remains the only entry point. |
| Read contract | Port `GET /api/staff/students/sessions?date=...` from the preview contract. It returns only persisted `ClassSession` rows in the allowed window and uses `authorizeStudentOperationalRequest`. Do not reuse the owner/admin and pre-existing-user sessions route. |
| Authorization | Both session selection and create/assignment authorize through `authorizeStudentOperationalRequest`: owner, admin, and front desk remain allowed; other staff remain denied. |
| Rate limit | Retain `staff:students:create`, IP keying, 30 requests per 60 seconds, and `Retry-After` on the create submission. Apply an independently named, bounded limiter to the new selection read following existing read-route conventions. |
| Identity | Keep Clerk lookup/create/update and `upsertUserByIdentifiers`. The implementation must distinguish local creation from local reuse before emitting a creation audit; Clerk `isExisting` alone is insufficient. |
| Check-in range | Interpret the supplied date as an `America/New_York` calendar date. Accept only today through today minus 14 calendar days, inclusive. Reject future, invalid, and older dates server-side. |
| Session trust boundary | Treat `sessionId` and date as untrusted. Resolve a persisted `ClassSession` server-side and require its `startsAt` to fall on the submitted New York date and inside the allowed window. |
| Attendance | Create one optional attendance row with the existing unique `(userId, sessionId)` rule. Set `checkedInAt` from the resolved `ClassSession.startsAt`, never from request execution time. |
| Package credit | When a reused identity has an eligible package for the selected class, reserve credit and write its ledger entry through `reservePackageCreditForAttendanceTx` in the same transaction as attendance. Evaluate package validity at `session.startsAt`. |
| Registration deposit | Preserve `_staff_registration` exactly for a positive creation amount. It remains independent from the optional class assignment. |
| Audit | `StudentDataAudit` is the compatible existing mechanism. Write distinct `profile.created` and `attendance` entries with their respective staff actor data, target user, entity IDs, values, reason, and IP. Do not add a model or migration. On reuse, do not emit a false profile-creation event. |
| Refresh | Preserve the hook's existing `onSuccess` path to `refreshPaymentsBoard`, after the combined operation completes successfully. |

## Rejected Reuse

- Do not use the attendance override route: its owner/admin authorization and execution-time timestamp violate this contract.
- Do not use fast class action: it resolves only the current terminal class and is not historical.
- Do not use the existing user-session route for the modal: it cannot serve a not-yet-created student or front desk.

## No Schema Blocker

`ClassSession.startsAt`, `Attendance.checkedInAt`, the attendance uniqueness constraint, `PackageUsageLedger`, and `StudentDataAudit` provide the required persistence. The only required code-level clarification is returning whether `upsertUserByIdentifiers` created the local row so the existing audit table is not populated with an inaccurate creator event.
