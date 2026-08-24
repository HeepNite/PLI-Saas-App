# New Student Historical Check-in Production Port

## Status

`DRAFT`

## Objective

Port the Staff Board "New Student" flow from preview to production so authorized staff can create or reuse a student and optionally assign a class check-in, including a historical check-in.

## Scope

### In scope

- Staff Board access to the New Student flow.
- Student creation or reuse through the existing Clerk identity flow.
- Optional check-in assignment to a selected class session.
- Check-in date selection for New York today through the preceding 14 calendar days.
- Existing audit records for the student creator and the check-in/class assignment actor.
- Production-compatible preservation of the existing registration, package-credit, duplicate, authorization, rate-limit, and board-refresh behavior.

### Out of scope

- A cherry-pick of the preview board refactor.
- New database models or schema changes unless later analysis demonstrates they are indispensable.
- Changes to unrelated staff-board, payment, enrollment, or attendance flows.

## Functional Requirements

1. Authorized staff can start the New Student flow from the Staff Board.
2. The flow creates a student or reuses the existing student identity according to the established Clerk and database identity behavior.
3. The staff member may submit without a check-in, or may select a date and one class session to create the optional check-in.
4. Date availability and server validation use `America/New_York` calendar dates. The permitted inclusive range is today through 14 days before today.
5. The server rejects a future date, a date older than 14 days, an invalid date, or a session that is not valid for the submitted check-in request.
6. A historical check-in persists `Attendance.checkedInAt` as the selected class session's `startsAt`, not the operation timestamp.
7. The flow preserves duplicate attendance protection for `(userId, sessionId)`.
8. The flow preserves package-credit reservation behavior and `_staff_registration` semantics.
9. The flow refreshes the Staff Board after a successful submission.

## Security And Data Rules

- Preserve owner, admin, and front-desk authorization.
- Preserve rate limiting and server-side `sessionId` validation.
- Use the existing audit mechanism to record the staff actor who creates the student and the staff actor who assigns the check-in/class.
- Do not weaken Clerk identity handling, duplicate protection, or package-credit controls.

## Acceptance Criteria

- [ ] An authorized owner, admin, or front-desk staff member can create or reuse a student from the Staff Board with no check-in.
- [ ] An authorized staff member can submit an optional check-in for a valid session on a date from New York today through 14 days before today.
- [ ] A future date, a date older than 14 days, an invalid date, and an invalid session are rejected by the server.
- [x] A historical check-in stores the selected session start timestamp in `Attendance.checkedInAt`.
- [ ] A duplicate `(userId, sessionId)` check-in remains rejected.
- [ ] Existing audit records identify the student-creation actor and check-in/class-assignment actor.
- [ ] Existing `_staff_registration`, Clerk reuse, package-credit, rate-limit, authorization, and board-refresh behavior remains intact.

## Definition Of Done

- [ ] The implementation is a minimal production-compatible port, not a preview refactor cherry-pick.
- [ ] API, UI/integration, and historical-report regression tests cover the changed behavior.
- [ ] No unresolved contract ambiguity remains before implementation.

## Open Questions

- None identified from the confirmed source of truth. Any audit-field gap found during implementation must be resolved before introducing a schema change.
