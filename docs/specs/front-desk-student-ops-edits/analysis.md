# Analysis

## Existing Implementation

- `app/staff/portal/page.tsx` passes `authResult.role` into the staff admin client as `currentRole`.
- `lib/security/staff-access.ts` allows `staff + front_desk` to access `students`, `terminals`, and `profile`, but not `users`.
- `components/front/staff/StaffStudentsBoardPanel.tsx` renders student card `Edit info` only for `owner` or `admin` and when the card has `userId`.
- `app/api/staff/users/[userId]/profile/route.ts` allows non-self profile GET/PATCH only when `canAccessStaffPortalSection(role, category, "users")` is true.
- `lib/audit/student-data-audit.ts` already writes student data audit records with `staffClerkId` and `staffName`.
- Attendance add/remove/update routes already write student-data audit records with the acting staff user.
- Settlement mark-paid/pending routes already use `authorizeStaffPortalSectionRequest("students")`, so `staff + front_desk` can access those settlement operations.
- The student audit-log route returns actor fields such as `staffClerkId`, `staffName`, `reason`, and `ipAddress`.
- Profile PATCH currently writes staff role audit records for role/category changes, but does not write `StudentDataAudit` for operational profile field edits.

## Affected Files

- `lib/security/staff-access.ts`
- `components/front/staff/StaffStudentsBoardPanel.tsx`
- `components/front/staff/useStaffStudentsBoardAdmin.ts`
- `app/api/staff/users/[userId]/profile/route.ts`
- Existing staff/student tests around card visibility and profile edit authorization.

## Architecture Constraints

- UI permission checks and API authorization must use the same policy concept.
- Student operational permission must not be modeled as broad staff user-management permission.
- Audit behavior must remain server-side and not depend on client claims.

## Spec/Code Conflicts

- Current code treats student `Edit info` as owner/admin-only.
- Current profile API treats editing another user profile as `users` section access, which excludes front desk.
- Product requirement says front desk must edit operational student data with audit accountability.
- Several operational routes are already audited, so implementation must reuse the existing audit layer instead of duplicating it.
- Widening the profile API gate without field-level restrictions would over-grant staff-management capabilities to front desk.

## Recommended Next Focus

Define a focused permission helper for student operational edits, use it in both the student card UI and server routes, and only add new audit writes where they are missing: profile operational field changes.
