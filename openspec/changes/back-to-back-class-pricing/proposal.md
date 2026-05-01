# Proposal: Back-to-Back Class Pricing

## Intent

When a student attends two consecutive classes on the same day (e.g., Salsa 8pm then Salsa 9pm), the current system has no concept of this relationship. Students see only one class at the terminal, can't pick between multiple same-day sessions, and receive no discount incentive to stay for the second class. This change introduces consecutive-class linking with configurable discounted pricing for both drop-in buyers and package holders, plus a multi-class terminal view.

## Scope

### In Scope
- New `CourseLink` DB table linking course pairs with configurable discounted prices
- Terminal shows ALL classes for the day — student picks which one to check into
- Drop-in students who checked into Class A see a discount offer for Class B
- Package holders who checked into Class A are prompted to add Class B at a configurable price
- UI shows discount as a computed percentage (e.g., "40% off") — NOT a flat dollar amount
- Admin UI to link courses and configure `dropInConsecutiveCents` + `packageHolderConsecutiveCents` per pair

### Out of Scope
- Automatic check-in (student always confirms explicitly)
- Global/fixed discount constants (prices are per course-pair)
- Multi-hop chains (A→B→C); only direct A↔B pairs
- Changes to package plan rules or credit deduction logic beyond the consecutive-class prompt
- Refactoring of `PackagePurchase.courseSlug` legacy field (separate debt)

## Capabilities

### New Capabilities
- `consecutive-class-pricing`: `CourseLink` model, admin UI for course linking, configurable per-pair pricing
- `terminal-multi-class-view`: Terminal shows all today's classes; student selects session before check-in

### Modified Capabilities
- `checkin-dropin`: Adds consecutive-class purchase prompt after first class check-in
- `checkin-package`: Adds consecutive-class add-on prompt for package holders after Class A attendance

## Approach

Introduce a `CourseLink` Prisma model (`courseSlugA`, `courseSlugB`, `dropInConsecutiveCents`, `packageHolderConsecutiveCents`, `active`). Unique constraint on `[courseSlugA, courseSlugB]`. Percentage discount is COMPUTED at render time: `Math.round((1 - consecutive/regular) * 100)` — never stored.

**Terminal**: `StaffTerminalShell` stops passing a single `forcedCourseSlug`. A new API endpoint returns all `CourseCatalog` entries active for today. The terminal renders a class-picker card before showing the check-in panel.

**Post-check-in prompt**: After successful Class A check-in, the bootstrap response includes the `CourseLink` for that class pair (if any). The UI conditionally renders a "Back-to-Back offer" modal/card with the appropriate price (drop-in vs package-holder rate).

**Prior attendance check**: Bootstrap receives `userId + courseSlugA + date` and returns `hasAttendedClassA: boolean` to drive eligibility.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | New | Add `CourseLink` model + migration |
| `app/api/checkin/qr/bootstrap/route.ts` | Modified | Return linked class + prior attendance flag |
| `app/api/checkin/qr/dropin/route.ts` | Modified | Handle consecutive drop-in purchase at discounted price |
| `app/api/staff/school/courses/route.ts` | Modified | CRUD for `CourseLink` entries |
| `lib/catalog-courses.ts` | Modified | Query `CourseLink` relationships |
| `components/front/staff/StaffTerminalShell.tsx` | Modified | Multi-class picker, remove `forcedCourseSlug` single-course constraint |
| `components/front/checkin/CheckInQrClient.tsx` | Modified | Render back-to-back offer after successful check-in |
| `components/front/checkin/useCheckInDisplayData.ts` | Modified | Expose consecutive-class data + discount percentage |
| `components/front/staff/StaffUsersAdminClient.tsx` | Modified | Course-link admin section (link courses, set prices) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bootstrap double-query slows terminal | Med | Index `[courseSlugA]` + `[courseSlugB]` on `CourseLink`; single JOIN query |
| `forcedCourseSlug` removal breaks existing terminals | Med | Feature flag or backward-compat fallback during rollout |
| Duplicate purchase guard blocks consecutive session | Low | `hasExistingPurchaseForSession` is session-scoped — different sessions not blocked |
| `PackagePurchase.courseSlug` legacy gap misroutes package check | Med | Scope consecutive package prompt to confirmed active plans via `PackagePlan.courseSlugs[]` |
| Admin misconfigures A=B (self-link) | Low | DB unique constraint + UI validation prevent same-slug pairs |

## Rollback Plan

1. Disable `CourseLink` admin UI (feature flag or deploy revert)
2. Revert `StaffTerminalShell` to single `forcedCourseSlug` behavior
3. Drop `CourseLink` table via Prisma migration rollback (`prisma migrate resolve --rolled-back`)
4. No data loss — `Attendance` and `Purchase` records are unchanged

## Dependencies

- Prisma migration capability (no blockers — no pending migrations in conflict)
- `PackagePlan.courseSlugs[]` field must be correctly populated for package holder prompt to work

## Success Criteria

- [ ] Terminal with 2+ same-day classes shows all of them; student can pick one
- [ ] Drop-in student who checked into Class A sees Class B offer at configured discounted price
- [ ] Package holder who attended Class A sees "Add next class?" prompt at package-holder price
- [ ] UI displays discount as percentage (computed, not stored)
- [ ] Admin can link courses and configure both prices per pair
- [ ] Consecutive purchase creates a valid `Purchase` + `Attendance` record for Class B session
- [ ] No regression on existing single-class check-in flows
