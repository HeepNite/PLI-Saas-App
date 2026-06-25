# Front desk student operational edits

## Status

`DRAFT`

## Objective

Allow front-desk staff to perform day-to-day student operational corrections from the staff student board while preserving a clear audit trail of who made each change.

## Scope

### In scope

- Show the student card `Edit info` action to staff members who are allowed to operate the student desk.
- Allow front-desk staff to make operational student corrections needed at the desk, including attendance corrections and money/settlement corrections already supported by the existing student admin flows.
- Preserve audit logging for operational changes, including the acting staff user.

### Out of scope

- Granting front-desk staff full team/user administration access.
- Allowing front-desk staff to change staff roles, categories, payroll settings, or owner/admin profiles.
- Bypassing existing validation, rate limits, or audit requirements.

## Context

The current UI hides `Edit info` unless the logged-in staff role is `owner` or `admin`. A `staff` user with category `front_desk` can access the `students` section, but cannot open the student edit workflow from the card. Product intent is that front desk users must be able to correct operational student state, as long as the system records who performed the action.

## Functional Requirements

- Front-desk staff with access to the `students` section MUST see the student card `Edit info` action when the card has a `userId`.
- Front-desk staff MUST be allowed to submit student operational profile/edit changes that are part of the student desk workflow.
- Front-desk staff MUST NOT receive broad access to the `users` staff-management section.
- Owner/admin behavior MUST remain unchanged.
- Existing audit records MUST identify the staff actor who performed the correction.

## Constraints

- Reuse existing staff access helpers where possible.
- Keep authorization changes scoped to student operational edits, not staff management.
- Do not introduce new third-party libraries.
- Do not change database schema unless implementation proves existing audit records cannot capture the required actor.

## Security Rules

- Front-desk staff may edit operational student information only through authorized student workflows.
- Front-desk staff must not edit owner/admin/staff management metadata unless explicitly allowed by a separate spec.
- Server-side authorization must match UI visibility; hiding or showing the button alone is not sufficient.
- Audit logging must include the acting staff user id/name when available.

## Acceptance Criteria

- [ ] Given a logged-in `staff` user with category `front_desk`, when viewing a student card with `userId`, then `Edit info` is visible.
- [ ] Given a front-desk user submits an allowed student operational edit, then the request succeeds when validation passes.
- [ ] Given a front-desk user attempts staff-management-only edits, then the request is rejected.
- [ ] Given any successful operational edit, then the audit trail records who made the change.
- [ ] Existing owner/admin student edit behavior still works.

## Definition Of Done

- [ ] implementation matches accepted behavior
- [ ] relevant tests exist and pass
- [ ] unresolved ambiguity is documented

## Open Questions

- Which fields in the current profile modal are considered operational student fields versus staff-management fields?
