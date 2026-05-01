# Design: Back-to-Back Class Pricing

## Technical Approach

Introduce a `CourseLink` join table to model consecutive course relationships with configurable pricing per pair. Extend the bootstrap API to detect prior same-day attendance and return linked class offers. Terminal UI gains a multi-class picker before check-in. Admin course editor gets a "Consecutive Classes" section.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Course linking model | New `CourseLink` join table | Self-referential field on CourseCatalog; scheduleRules JSON | Clean FK-like querying, no denormalization, extensible |
| Discount storage | Absolute cents only (`dropInConsecutiveCents`, `packageHolderConsecutiveCents`) | Store percentage | Cents are auditable; percentage computed at render: `Math.round((1 - consecutive/regular) * 100)` |
| Terminal multi-class | Fetch all today's active courses via new endpoint | Extend `StaffTerminal.defaultCourseSlug` to array | Avoid terminal schema change; simpler MVP |
| Prior attendance detection | Query `Attendance` for `userId + courseSlugA + today's date range` at bootstrap | Client-side detection | Server is source of truth; single extra indexed query |
| Offer display | Post-check-in modal/card in `CheckInQrClient` | Separate page | Inline UX, no navigation, matches existing patterns |

## Data Model

```prisma
model CourseLink {
  id                            String   @id @default(cuid())
  courseSlugA                   String   // first class
  courseSlugB                   String   // consecutive class
  dropInConsecutiveCents        Int?     // discounted drop-in price for B
  packageHolderConsecutiveCents Int?     // discounted price for package holders
  active                        Boolean  @default(true)
  createdAt                     DateTime @default(now())
  updatedAt                     DateTime @updatedAt

  @@unique([courseSlugA, courseSlugB])
  @@index([courseSlugA])
  @@index([courseSlugB])
}
```

**Constraints**: Self-link (`courseSlugA == courseSlugB`) blocked via UI validation and unique constraint natural behavior.

## Data Flow

```
Terminal load
     │
     ▼
GET /api/checkin/terminal/today-classes
     │
     ▼
┌────────────────────────────┐
│ Student picks class        │
└────────────────────────────┘
     │
     ▼
POST /api/checkin/qr/bootstrap
     │
     ├─ Query CourseLink WHERE courseSlugA = selected
     ├─ Query Attendance WHERE userId + courseSlugA + today
     │
     ▼
Bootstrap response includes:
  consecutiveOffer: {
    linkedCourseSlug, linkedCourseTitle,
    dropInConsecutiveCents, packageHolderConsecutiveCents,
    regularDropInCents, regularPackagePriceCents,
    discountPercent, hasAttendedFirstClass
  } | null
     │
     ▼
If hasAttendedFirstClass && consecutiveOffer:
  Show "Back-to-Back Offer" card/modal
     │
     ▼
POST /api/checkin/qr/dropin (with consecutiveDiscountApplied flag)
  OR POST /api/checkin/qr/package (package holder flow)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `CourseLink` model |
| `prisma/migrations/xxx_add_course_link.sql` | Create | Migration for CourseLink table |
| `app/api/checkin/terminal/today-classes/route.ts` | Create | Returns all active courses for today |
| `app/api/checkin/qr/bootstrap/route.ts` | Modify | Add CourseLink + prior attendance queries; return `consecutiveOffer` |
| `app/api/checkin/qr/dropin/route.ts` | Modify | Accept `consecutiveDiscountApplied`, validate against CourseLink price |
| `app/api/staff/school/courses/route.ts` | Modify | CRUD for CourseLink via nested payload |
| `lib/catalog-courses.ts` | Modify | Add `getCourseLinkForPair()`, `getLinkedCourses()` helpers |
| `lib/checkin/consecutive-class.ts` | Create | `hasAttendedCourseToday()`, `computeConsecutiveDiscountPercent()` |
| `components/front/staff/StaffTerminalShell.tsx` | Modify | Remove `forcedCourseSlug`, add multi-class picker |
| `components/front/checkin/CheckInQrClient.tsx` | Modify | Render `ConsecutiveClassOffer` after successful check-in |
| `components/front/checkin/ConsecutiveClassOffer.tsx` | Create | Back-to-back offer card component |
| `components/front/staff/StaffUsersAdminClient.tsx` | Modify | Add CourseLink editing section in course form |

## Interfaces / Contracts

```typescript
// Bootstrap response extension
type ConsecutiveOffer = {
  linkedCourseSlug: string
  linkedCourseTitle: string
  dropInConsecutiveCents: number | null
  packageHolderConsecutiveCents: number | null
  regularDropInCents: number
  discountPercent: number // computed
  hasAttendedFirstClass: boolean
}

// API: POST /api/checkin/qr/dropin extension
type DropinPayload = {
  // existing fields...
  consecutiveDiscountApplied?: boolean
  linkedFromCourseSlug?: string // the Class A they attended
}

// Admin payload extension for course save
type CoursePayload = {
  // existing fields...
  courseLinks?: Array<{
    linkedCourseSlug: string
    dropInConsecutiveCents: number | null
    packageHolderConsecutiveCents: number | null
    active: boolean
  }>
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `computeConsecutiveDiscountPercent()`, `hasAttendedCourseToday()` | Vitest, edge cases (0 price, null, same-day boundary) |
| Integration | Bootstrap returns `consecutiveOffer` when link exists | API test with seeded CourseLink + Attendance |
| Integration | Drop-in route accepts discounted price only if link valid | API test validating price mismatch rejection |
| E2E | Terminal multi-class picker → check-in → offer appears | Playwright, full flow |

## Migration / Rollout

1. **Schema migration**: Add `CourseLink` table (non-breaking, empty table)
2. **Deploy API changes**: Bootstrap + dropin routes detect but don't fail if no links
3. **Deploy terminal UI**: Multi-class picker hidden behind feature flag initially
4. **Admin UI deploy**: CourseLink section in course editor
5. **Enable feature flag**: Activate multi-class terminal behavior
6. **Admin configures links**: Create first CourseLink entries via admin
7. **Rollback**: Delete CourseLink rows, revert terminal to single-course mode via flag

## Open Questions

- [ ] Should `packageHolderConsecutiveCents` deduct from package credits or be a separate charge? (Assumption: separate charge, no credit deduction — clarify with product)
