# Tasks: Back-to-Back Class Pricing

## Phase 1: Foundation — Schema & Data Layer

- [x] 1.1 Add `CourseLink` model to `prisma/schema.prisma` with fields `courseSlugA`, `courseSlugB`, `dropInConsecutiveCents`, `packageHolderConsecutiveCents`, `active`, timestamps, unique constraint on `[courseSlugA, courseSlugB]`, and indexes on both slugs.
- [x] 1.2 Generate and apply Prisma migration for `CourseLink` table (`npx prisma migrate dev`).
- [x] 1.3 Create `lib/course-links.ts` with `findConsecutiveLink(courseSlugA, courseSlugB)`, `findLinkedCourses(courseSlug)`, and `computeDiscountPercent(regularPriceCents, consecutivePriceCents)` with null/zero guards.

## Phase 2: Core API — Consecutive Pricing Logic

- [x] 2.1 Create `lib/catalog-courses.ts` helpers: `getCourseLinkForPair(courseSlugA, courseSlugB)` and `getLinkedCoursesForCourse(courseSlug)` querying `CourseLink` where `active = true`. (Already implemented in Phase 1 as `lib/course-links.ts` with `findConsecutiveLink` and `findLinkedCourses`.)
- [x] 2.2 Create `app/api/checkin/terminal/today-classes/route.ts` (GET) returning all active `CourseCatalog` entries with sessions scheduled for today, including `availableTimes` resolved to actual session times.
- [x] 2.3 Modify `app/api/checkin/qr/bootstrap/route.ts` to accept optional `linkedFromCourseSlug`, query `CourseLink` for that course, check prior attendance via `hasAttendedCourseToday`, and return `consecutiveOffer` object (or null) in bootstrap response.
- [x] 2.4 Modify `app/api/checkin/qr/dropin/route.ts` to accept `consecutiveDiscountApplied` + `linkedFromCourseSlug`, validate that `CourseLink` exists and price matches `dropInConsecutiveCents`, reject on price mismatch, create `Purchase` + `Attendance` for Class B.
- [x] 2.5 Modify `app/api/checkin/qr/package/route.ts` to handle consecutive package-holder add-on: validate `PackagePlan.courseSlugs[]` includes Class B, charge `packageHolderConsecutiveCents` as separate payment, create `Attendance` for Class B (no credit deduction).

## Phase 3: Terminal UI — Multi-Class Picker

- [x] 3.1 Modify `components/front/staff/StaffTerminalShell.tsx` to remove `forcedCourseSlug` single-course constraint, fetch today's classes from new endpoint, and render a class-picker grid before check-in panel.
- [x] 3.2 Create `components/front/checkin/ClassPickerCard.tsx` component displaying selectable class cards with course title, time, and visual selection state.
- [x] 3.3 Add empty state to `StaffTerminalShell` showing "No classes scheduled for today" when zero active courses exist.
- [x] 3.4 Update `components/front/checkin/useCheckInDisplayData.ts` to accept selected course slug and expose it as the active check-in context.

## Phase 4: Check-in UI — Consecutive Offer Flow

- [x] 4.1 Create `components/front/checkin/ConsecutiveClassOffer.tsx` component rendering the back-to-back offer card/modal with course name, discounted price, computed discount percentage, and accept/decline buttons.
- [x] 4.2 Modify `components/front/checkin/CheckInQrClient.tsx` to render `ConsecutiveClassOffer` after successful check-in when `bootstrap.consecutiveOffer` is present and `hasAttendedFirstClass` is true.
- [x] 4.3 Wire accept/decline handlers in `CheckInQrClient`: accept calls dropin/package consecutive endpoint, decline returns to class picker.

## Phase 5: Admin UI — CourseLink Management

- [x] 5.1 Add "Consecutive Classes" section to `components/front/staff/StaffUsersAdminClient.tsx` course editor form with linked-course selector, price inputs for `dropInConsecutiveCents` and `packageHolderConsecutiveCents`, and active toggle. Shows existing links both as A (this course → next) and as B (previous → this course).
- [x] 5.2 Create `app/api/staff/school/course-links/route.ts` with POST (create), PUT (update), DELETE (remove) endpoints. Validates no self-links (`courseSlugA !== courseSlugB`), rejects duplicate pairs (unique constraint P2002), verifies both courses exist.
- [x] 5.3 Wire admin UI to the CourseLink API with loading states, error states, success feedback. Client-side validation: prevent self-linking, validate prices are non-negative numbers, convert USD input to cents for storage.

## Phase 6: Testing

- [x] 6.1 Write unit tests for `computeDiscountPercent()`: normal case, zero regular price, null/undefined consecutive price, null/undefined regular price, NaN guards, rounding edge cases, equal prices (0% discount). (19 tests in `tests/lib/course-links.test.ts`)
- [x] 6.2 Write unit tests for `hasAttendedCourseToday()`: checked_in status, checked_in_no_package status, no attendance, query shape verification, slug normalization. Also `hasPurchaseForCourseToday()`: paid/succeeded/completed statuses, no purchase, query shape verification. (12 tests in `tests/lib/checkin/consecutive-class.test.ts`)
- [x] 6.3 Write integration test: `GET /api/checkin/terminal/today-classes` returns correct courses for today's weekday, excludes courses not scheduled today, excludes courses with no times, filters invalid time formats, returns empty array when no courses, returns 500 on DB error. (6 tests in `tests/api/checkin-terminal-today-classes.test.ts`)
- [x] 6.4 Write integration test: bootstrap returns `consecutiveOffer` when `CourseLink` exists and student attended Class A today; returns null when no link exists, when student hasn't attended Class A, when student already purchased Class B, when linkedFromCourseSlug not provided. (5 tests in `tests/api/checkin-qr-bootstrap-consecutive.test.ts`)
- [x] 6.5 Write integration test: drop-in with consecutive discount validates price matches CourseLink (rejects mismatch 400), rejects when Class A attendance not found (403), rejects when no active link (400), rejects when linkedFromCourseSlug missing (400), creates attendance + purchase on success (200). (5 tests in `tests/api/checkin-qr-dropin-consecutive.test.ts`)
- [x] 6.6 Write integration test: package consecutive add-on creates separate charge (NOT package credit deduction), validates CourseLink price (rejects mismatch 400), rejects when no Class A attendance (403), rejects when linkedFromCourseSlug missing (400), rejects when no active link (400), rejects when no active package (409). (6 tests in `tests/api/checkin-qr-package-consecutive.test.ts`)
- [x] 6.7 Write admin API test: POST creates link successfully, rejects self-link (400), rejects duplicate pair (409 via P2002), rejects missing fields (400), rejects nonexistent course (404). PUT updates link, rejects self-link on update (400), rejects missing ID (400), rejects nonexistent link (404). DELETE removes link, rejects missing ID (400), rejects nonexistent link (404). (12 tests in `tests/api/staff-course-links.test.ts`)

## Phase 7: Cleanup & Polish

- [x] 7.1 Add TypeScript types for `ConsecutiveOffer`, `DropinPayload` extension, and `CoursePayload` extension to `components/front/checkin/checkin.types.ts`.
- [x] 7.2 Update barrel export in `components/front/checkin/index.ts` to include `ConsecutiveClassOffer` (ClassPickerCard already added in Phase 3).
- [x] 7.3 Verify no regression on existing single-class check-in flows — ran full test suite (`npx vitest run`): 942 tests passing, 65 pre-existing failures in unrelated areas (payroll, Stripe, staff auth). Zero new failures caused by our changes.
