# Resolution

## Contract Decisions

- Front-desk staff may perform student operational edits from the student board.
- Front-desk staff must not receive full `users` section authorization as a side effect.
- The authorization contract should be named around the capability, not around the UI button.
- Auditability is mandatory: successful mutations must record the acting staff user.
- Existing student-data audit behavior is the source of truth for actor tracking; do not create a parallel audit mechanism.

## Context Strategy

- Add or reuse a policy helper in `lib/security/staff-access.ts` for student operational edits.
- Use that policy in UI visibility and server authorization.
- Keep existing owner/admin access intact.

## Minimal Architectural Changes

- Introduce a student-operation permission check separate from `canAccessStaffPortalSection(..., "users")`.
- Update `StaffStudentsBoardPanel` and `useStaffStudentsBoardAdmin` to use the resolved permission instead of hard-coded owner/admin checks.
- Update profile GET/PATCH authorization so front desk can access allowed student operational edits without granting broad team management rights.
- Reuse existing audited operational routes where they already record actor details.
- Add `StudentDataAudit` writes for profile operational field changes because profile PATCH currently lacks that student audit trail.
- Reject staff-management-only profile fields for front-desk callers.

## Spec Adjustments

- The current open question is field scope inside the existing profile modal. Implementation must avoid exposing staff-management-only edits to front desk.

## Implementation Preconditions

- Add tests first for front-desk visibility and server authorization.
- Confirm existing audit entries include the acting staff user for profile edits.
- Treat profile field scope as the main implementation risk: front desk should edit student operational info, not staff roles/categories/payroll/payment preferences.
