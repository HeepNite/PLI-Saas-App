# Exploration: back-to-back-class-pricing

## Current State

### 1. Schema — `prisma/schema.prisma`

#### `CourseCatalog` model (the master course record)
```
slug                 String   @unique
title                String
availableWeekdays    Int[]     // 0=Mon…6=Sun (Mon-based after normalization)
availableTimes       String[]  // HH:MM 24h — ALL times a course runs each day
scheduleRules        Json?     // extended schedule: rules[], specialEvents[], publication, specialDiscount
dropInPriceCents     Int?
firstClassPriceCents Int?
durationMinutes      Int?
active               Boolean
```

**Critical observation:** `availableTimes` is a flat array on ONE course record. The current design assumes a single course can have **multiple times in a day** (e.g. `["20:00","21:00"]`). There is NO concept of "consecutive" or "linked" classes between two separate `CourseCatalog` rows. If Salsa 8pm and Salsa 9pm are the same course slug with two times → they're already one entity. If they are TWO separate slugs (e.g. `salsa-8pm` vs `salsa-9pm`) → there is no link between them.

#### `ClassSession` model (the concrete class occurrence)
```
courseSlug      String
startsAt        DateTime
durationMinutes Int?
@@unique([courseSlug, startsAt])
```

Sessions are created on check-in via upsert. No concept of linking two sessions as "consecutive".

#### `Attendance` model
```
userId     String
sessionId  String     → ClassSession
status     String     // "checked_in" | "checked_in_no_package"
checkedInAt DateTime
metadata   Json?
@@unique([userId, sessionId])
```

The `metadata` Json stores: `source`, `purchaseId`, `qrDate`, `qrTime`. No field for "back-to-back" source.

#### `PackagePurchase` model
```
courseSlug       String?   // legacy single-course lock (nullable = universal)
packagePlanId    String?   → PackagePlan
remainingCredits Int?
isUnlimited      Boolean
status           String
expiresAt        DateTime?
```

#### `Purchase` model (drop-in payments)
```
courseSlug   String
amount       Int           // in cents
metadata     Json?         // serviceId, date, time, packageId, addons, ...
```

**No "back-to-back discount" or "consecutive" concept exists anywhere in the schema.**

---

### 2. Terminal Flow

**Entry point:** `app/staff/terminal/page.tsx` → `StaffTerminalShell` → `CheckInQrClient`

`StaffTerminalShell` passes `forcedCourseSlug={terminal.defaultCourseSlug}` — **a single slug per terminal**. The terminal is configured at setup time with ONE course.

**Course selection in the terminal:**
- `pickTerminalContextRecommendation()` in `lib/checkin/checkin-helpers.ts` picks the NEXT upcoming slot for the `forcedCourseSlug`. If that course has two times today (e.g., 20:00 and 21:00), it picks the first upcoming one.
- `useCatalogCourses` hook fetches all courses from the catalog API (to populate the `sourceCourses` list).
- The terminal currently shows ONE `CourseCardPanel` — the recommended course/time.
- There is NO multi-course selection UI at the terminal level. The student cannot choose between two classes.

**When a student identifies (PIN or Clerk session):**
- `bootstrap` API (`/api/checkin/qr/bootstrap`) is called with `courseSlug + date + time` from the single recommended context.
- Returns: customer info, active package for that course, last purchase template, check-in window status.

**Active package lookup in bootstrap:**
```ts
where: {
  userId,
  status: "active",
  AND: [
    { OR: [{ courseSlug: null }, { courseSlug: context.courseSlug }] },
    // ...
  ]
}
```
The package query does NOT check `PackagePlan.courseSlugs[]` — it only checks `PackagePurchase.courseSlug`. This means a package valid for multiple courses (via `PackagePlan.courseSlugs[]`) won't be found unless the `PackagePurchase.courseSlug` matches or is null.

---

### 3. Catalog System

`lib/catalog-courses.ts`:
- `findPublicPackagePlans(courseSlug?)` — queries `PackagePlan` with `courseSlugs: { has: courseSlug }`.
- `getPackageOptionsForCourse(courseSlug, allPlans)` — filters plans whose `courseSlugs` array includes the slug.
- `mapCatalogRowToCourseData(row, packagePlans)` — merges DB catalog row with package options.
- Courses are fetched individually by slug or all at once; there is no "linked courses" concept.

**Key finding:** `CourseCatalog.availableTimes String[]` is per-course. For two classes on the same day with different times, there are TWO options:
  - **Option A:** One `CourseCatalog` row with `availableTimes: ["20:00", "21:00"]` — same slug, two time slots.
  - **Option B:** Two `CourseCatalog` rows, e.g., `salsa-open-8pm` and `salsa-open-9pm`.

Currently the business has used **Option A** (one course, multiple times). But for "back-to-back pricing" we need to know WHICH session a student is checking into on a given day, and whether they ALREADY checked into the other one.

---

### 4. Check-in / Attendance Tracking

**Drop-in check-in route:** `/api/checkin/qr/dropin/route.ts`
- Creates a `ClassSession` via upsert (`courseSlug + startsAt`).
- Creates or updates `Attendance` record (`userId + sessionId`).
- Attendance `metadata` stores `{ source: "qr_dropin_checkin", purchaseId, qrDate, qrTime }`.

**Package check-in route:** `/api/checkin/qr/package/route.ts`
- Deducts a credit from `PackageUsageLedger`.
- Creates `Attendance` with `status: "checked_in"`.

**To know "did this student check into the FIRST class today?"** we need to:
1. Find the `ClassSession` for `courseSlug + startsAt` (the 8pm session).
2. Find an `Attendance` record for that `userId + sessionId`.

This query is possible with current data, but NOT implemented anywhere. There is no utility or API endpoint that checks "has this user attended a specific session today?"

---

### 5. Drop-in Purchase Flow

When a student buys a drop-in, the flow is:
1. `EnrollModal` → collects info + payment (Stripe or cash).
2. On success → redirect to `/api/checkin/qr/dropin` POST.
3. That route validates the purchase exists for the given `courseSlug + date + time` and creates the `Attendance`.

**Pricing is stored in:**
- `CourseCatalog.dropInPriceCents` (DB source of truth for display)
- `Purchase.amount` (what was actually charged)
- The `EnrollModal` reads from `CourseData.enrollment.services` → `{ id: "dropin", price: number }`

**No "discounted consecutive class" price exists.** There is no mechanism to offer a reduced price based on a previous same-day attendance.

---

### 6. Admin Course Editing

**Where:** `StaffUsersAdminClient.tsx` → `saveCourseCatalog()` → POST `/api/staff/school/courses`

**Current editable fields on a course:**
- slug, title, kind, category, description
- coverImageUrl, previewVideoUrl
- dropInPriceCents, firstClassPriceCents
- level, durationMinutes, location, defaultRoomId
- availableWeekdays[], availableTimes[]
- scheduleRules (complex JSON: rules, specialEvents, publication, specialDiscount)
- active

**No "consecutive course link" field exists.** The admin cannot currently say "this course is consecutive with another course."

---

### 7. Pricing Model Summary

| Source | Where stored |
|--------|-------------|
| Drop-in price | `CourseCatalog.dropInPriceCents` |
| First class price | `CourseCatalog.firstClassPriceCents` |
| Package price | `PackagePlan.priceCents` |
| Actual purchase amount | `Purchase.amount` (cents) |
| Quick-repurchase template | Derived from `Purchase.metadata` at bootstrap time |
| Back-to-back drop-in discount | **MISSING** |
| Package-holder consecutive discount | **MISSING** |

---

## Affected Areas

- `prisma/schema.prisma` — new model or field(s) for consecutive course linking + discount config
- `lib/catalog-courses.ts` — enrich course data with consecutive course info
- `lib/checkin/checkin-helpers.ts` — `pickTerminalContextRecommendation` currently returns ONE slot; needs multi-slot awareness
- `components/front/checkin/CheckInQrClient.tsx` — multi-course display UI (currently shows one card)
- `components/front/checkin/useCheckInDisplayData.ts` — course selection logic
- `app/api/checkin/qr/bootstrap/route.ts` — detect "already checked into class A today → offer B discount"
- `app/api/checkin/qr/dropin/route.ts` — validate and apply back-to-back price
- `app/api/staff/school/courses/route.ts` — accept and persist consecutive course link + discount prices
- `components/front/staff/StaffUsersAdminClient.tsx` — course edit form + new linking UI

---

## Data Model Gaps

1. **No consecutive course relationship.** Neither `CourseCatalog` nor any join table tracks "Course A is consecutive with Course B."
2. **No back-to-back discount prices.** `CourseCatalog` has `dropInPriceCents` but no `consecutiveDropInPriceCents` or `consecutivePackageHolderPriceCents`.
3. **No "already checked in today" API.** Bootstrap returns data for ONE course context. There's no endpoint to ask "has this user attended any related class today?"
4. **Terminal shows ONE course.** `StaffTerminalShell` forwards a single `forcedCourseSlug`. The terminal UI has no multi-slot picker.
5. **Package lookup uses `PackagePurchase.courseSlug`** (legacy field), not `PackagePlan.courseSlugs[]`. This is a separate pre-existing gap but relevant if packages should cover consecutive classes.

---

## Approaches for Course-Linking Model

### Option A: New `CourseLink` join table

Add a new `CourseLink` model that explicitly links two courses as consecutive and stores discount configuration:

```prisma
model CourseLink {
  id                          String   @id @default(cuid())
  courseSlugA                 String   // earlier class
  courseSlugB                 String   // later class (consecutive)
  dropInConsecutiveCents      Int?     // discounted drop-in price for B after A
  packageHolderConsecutiveCents Int?   // discounted price for B if student has active package
  active                      Boolean  @default(true)
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt

  @@unique([courseSlugA, courseSlugB])
  @@index([courseSlugA])
  @@index([courseSlugB])
}
```

**Runtime query:** When student checks into Class B, query `CourseLink` where `courseSlugB = B` to find if there's a linked Class A, then check if student has an `Attendance` for A today.

**Pros:**
- Clean separation of concerns — linking config is its own entity
- Works regardless of whether A and B share a slug or have different slugs
- Supports asymmetric discounts (A→B can differ from B→A)
- Easy to query: `SELECT * FROM CourseLink WHERE courseSlugB = ?`
- Zero impact on existing `CourseCatalog` schema
- Extensible: could add `linkType: "consecutive" | "alternative"` later

**Cons:**
- New migration + new table
- Admin needs a new "link courses" UI widget (can be a simple select pair)
- Must be queried separately from catalog; adds a round-trip or join at bootstrap time

**Effort:** Medium

---

### Option B: Self-referential field on `CourseCatalog`

Add fields directly on the course record:

```prisma
model CourseCatalog {
  // ... existing fields ...
  consecutiveCourseSlug             String?  // slug of the consecutive partner course
  dropInConsecutiveCents            Int?     // B's discounted drop-in when A was purchased
  packageHolderConsecutiveCents     Int?     // B's discounted price for package holders
}
```

**Pros:**
- No new table, simpler migration
- Straightforward to read: one DB fetch for the course includes the link
- Easy to include in existing `getCatalogCourseBySlug()` response
- Admin can set it on the course form directly

**Cons:**
- Denormalized: if A→B, and you also want B→A (bidirectional), you need to update both rows and keep them in sync
- If the linked course changes slug, this field becomes stale (no FK enforcement since `CourseCatalog` has no self-referential relation in Prisma)
- Harder to query "all consecutive pairs" — need to scan the table
- Mixing structural (schedule) data with pricing policy on the same model

**Effort:** Low-Medium

---

### Option C: Extend `scheduleRules` JSON on `CourseCatalog`

Embed consecutive-class config inside the existing `scheduleRules Json?` field:

```json
{
  "consecutiveLink": {
    "partnerSlug": "salsa-9pm",
    "dropInPriceCents": 1500,
    "packageHolderPriceCents": 1000
  }
}
```

**Pros:**
- No migration required (field is already `Json?`)
- Can be added immediately

**Cons:**
- No type safety at the DB level
- Extremely hard to query: can't do `WHERE scheduleRules->>'consecutiveLink'->>'partnerSlug' = ?` efficiently
- Already overloaded field (has publication, specialDiscount, rules, specialEvents)
- Hard to admin-manage without dedicated UI that understands the JSON structure
- Not recommended for production-grade features

**Effort:** Low (but wrong tradeoff)

---

## Recommendation

**Use Option A (CourseLink table)** for these reasons:

1. **Querying is efficient and explicit.** At bootstrap time: `prisma.courseLink.findFirst({ where: { courseSlugB: context.courseSlug, active: true } })`. Clean index scan.
2. **Admin UI maps naturally.** A "linked course" section in the course editor: select partner course from dropdown, set two discount prices. No JSON gymnastics.
3. **Extensible.** If the business later needs "A→B AND B→A" (bidirectional) or multiple consecutive chains, the table handles it without schema changes.
4. **Avoids denormalization bugs.** Option B requires sync of two rows. One admin mistake → stale link.

For the terminal's multi-course display:
- `StaffTerminalShell` should pass MULTIPLE course slugs (or let the terminal auto-detect from today's schedule).
- OR: keep `defaultCourseSlug` on the terminal but query all courses with sessions today and surface both.

The simpler MVP approach: **terminal shows all classes happening TODAY (or imminently) from the catalog**, not just the hardcoded `defaultCourseSlug`. The student taps the class they want. This avoids a new field on `StaffTerminal`.

---

## Risks and Gotchas

1. **Bootstrap API is context-scoped (one course + date + time at a time).** Detecting "did student attend Class A today?" requires a SECOND DB query at bootstrap time for Class B, or a new endpoint.

2. **`PackagePurchase.courseSlug` vs `PackagePlan.courseSlugs[]` gap.** The bootstrap package query uses `PackagePurchase.courseSlug` (legacy nullable field). A package valid for multiple courses via `courseSlugs[]` won't be picked up unless `courseSlug` is null. This is a separate pre-existing issue but may affect which students qualify for "package holder discount on B."

3. **"40% off" display requires knowing both the full price and the discounted price.** The percentage must be computed at render time from `dropInPriceCents` (full) and `dropInConsecutiveCents` (discounted). Store both in absolute cents; compute % in the UI.

4. **Duplicate purchase detection.** Bootstrap already checks `hasExistingPurchaseForSession`. We must ensure the back-to-back discounted purchase isn't blocked by this check (it's for a DIFFERENT session).

5. **Terminal single-course assumption is hardcoded.** `StaffTerminalShell` passes `forcedCourseSlug` as a single string. To show two classes, the shell needs to either (a) not pass a forced slug and let the terminal auto-detect, or (b) accept multiple slugs. Changing the terminal's `defaultCourseSlug` (a single string in DB) to an array would require a schema migration. Alternative: let the terminal show ALL upcoming classes today regardless of `defaultCourseSlug`.

6. **Class timing assumption.** "Consecutive" means "on the same day, one after the other." The `CourseLink` model as proposed has no time-ordering enforcement — the admin picks A and B. The UI/API must enforce that A's time < B's time on any given day. Or we can derive this from the schedule at query time.

7. **`pickTerminalContextRecommendation` only returns ONE slot.** This function needs to be replaced or augmented to return ALL slots for today when multi-course display is needed.

8. **Attendance status naming.** Currently `"checked_in"` (package) and `"checked_in_no_package"` (drop-in). Back-to-back drop-ins could use `"checked_in_consecutive_dropin"` or store in `metadata` — decide early to avoid inconsistent querying.

---

## Ready for Proposal

**Yes.** The exploration is complete. The system is well-understood. Two clean approaches exist with clear tradeoffs. Recommended approach (Option A, CourseLink table) is low-risk and additive.

The proposal should scope:
1. Schema: `CourseLink` model migration
2. Terminal UI: multi-class display (show today's back-to-back classes)
3. Bootstrap API: extend to detect prior same-day attendance on linked course
4. Drop-in purchase flow: offer/apply discounted price when eligible
5. Package holder flow: offer discounted add-on when student has active package and checks into Class A
6. Admin: course edit form — "consecutive class" section with partner selector + two price fields
