# Exploration: Staff-create-student

**Change**: `staff-create-student`
**Intent**: Allow front-desk and owner/admin staff to create a new student from the staff panel with minimal info (phone, email, amount/price). Student completes full profile later via web.
**Status**: Ready for proposal — no blocking conflicts found.

---

## Current State

### Identity & User Creation Infrastructure

`lib/users.ts` — `upsertUserByIdentifiers(input)` handles all DB-side user upsert.
- Accepts `{ clerkId?, email?, phone?, name?, stripeCustomerId? }`.
- Deduplicates by clerkId → phone (unlinked) → email (unlinked) → any unlinked match.
- When no email is provided, generates a placeholder: `phone-${phone}-${Date.now()}@placeholder.pli.local`.
- Does NOT touch Clerk. It only writes to the `User` table.

`lib/clerk-users.ts` — `ensureClerkUser(input)` and `findClerkUserByIdentifiers(input)`.
- `findClerkUserByIdentifiers` queries Clerk by email or E.164 phone.
- `ensureClerkUser` creates a Clerk user with `skipPasswordRequirement: true` if one does not exist.
- Clerk phone numbers require E.164 format (`+1...`).

`prisma/schema.prisma` — `User` model:
```
id, clerkId?, email (UNIQUE), name?, phone?, stripeCustomerId?
```
`StudentProfile` (optional 1:1, created by student later):
```
firstName?, lastName?, birthDate?, emergencyContactName?, emergencyContactRelation?,
emergencyContactPhone?, billingAddress?
```

### Staff Permission Model

`lib/security/staff-role.ts` — Roles: `owner | admin | staff`
`lib/security/staff-category.ts` — Categories: `front_desk | manager | teacher | guest | partner`
`lib/security/staff-access.ts`:
- `canOperateStudentEdits()` — returns true for: `owner`, `admin`, `staff+front_desk`, `staff+guest+front_desk`.
- `resolveStaffPortalSections()` — `front_desk` gets `["students", "terminals", "profile"]`.
- `hasExplicitStaffPermission("studentOps", ...)` delegates to `canOperateStudentEdits()`.

`lib/security/staff-portal-auth.ts`:
- `authorizeStaffPortalSectionRequest("students")` — used by search route; grants front_desk access.
- `authorizeStudentOperationalRequest()` — narrower gate for student ops; used by profile edit routes.
- `authorizeStaffPortalRequest()` — requires owner OR admin+manager; used by user-management routes (`/api/staff/users`).

**Key finding**: A new "create student" API route needs `authorizeStudentOperationalRequest()` (owner + admin + front_desk), NOT `authorizeStaffPortalRequest()` (owner + admin+manager only), since front_desk must be included.

### Checkout & Payment Infrastructure

`app/api/checkout/cash/route.ts`:
- Handles cash purchase: takes `{ email, name, phone, ... courseSlug, serviceId, amount, ... }`.
- Calls `upsertUserByIdentifiers` then `prisma.purchase.create`.
- Metadata includes `source: "cash_checkout"`, `paymentChannel: "cash"`, `settlementStatus: "pending"`.
- Requires a `courseSlug` + `serviceId` — it is tied to a specific class enrollment.

**Key finding**: The existing cash checkout flow is class-enrollment-bound. Staff-create-student is NOT enrolling in a class — it's creating a profile + recording an amount owed or paid upfront. This is a different semantic: a **standalone payment record** or **credit/deposit**, not a course purchase.

### Staff Students Board

`components/front/staff/StaffStudentsBoardPanel.tsx` — shows student cards, search, history.
`useStaffStudentsBoardAdmin.ts` — handles board state, search, pagination.
`app/api/staff/students/search/route.ts` — student search API, gated by `authorizeStaffPortalSectionRequest("students")`.

The board is the natural entry point for a "Create Student" action — a CTA button alongside the search bar.

### Staff Admin Create Pattern (existing)

`components/front/staff/StaffAccessCreatePanel.tsx` + `useStaffCreateAdmin.ts`:
- Existing pattern: form with email + first/last + role + category → POST `/api/staff/users`.
- That route is owner/admin-only (staff management).

A **new, separate** form following the same UI pattern but pointing to a new `POST /api/staff/students` route is the right approach. Do NOT extend `/api/staff/users`.

### Audit Infrastructure

`lib/audit/student-data-audit.ts` — `writeStudentDataAudit(params, tx?)`:
- Entity: `attendance | payment | package | stats | profile`.
- Records: targetUserId, staffClerkId, staffName, entity, field, valueBefore, valueAfter, reason, ipAddress.
- Must be called for any staff-initiated creation action.
- No `create` entity type currently exists — the spec must define whether to use `profile` or introduce a new `student_created` event type.

### Existing Duplicate Handling

`upsertUserByIdentifiers` is idempotent by design:
- Email uniqueness enforced at DB level (`@@unique`).
- Phone-based deduplication logic merges/links records.
- If a user already exists, it returns the existing record without creating a duplicate.

Clerk: `findClerkUserByIdentifiers` checks email first, then E.164 phone. If found, returns existing Clerk user.

**Risk area**: A phone-only student created by staff (no email) gets a `placeholder.pli.local` email in the DB. If that student later registers via Clerk with their real email, `upsertUserByIdentifiers` won't automatically merge because the placeholder email won't match — only a phone match (unlinked) will. The existing logic handles this: `phoneUnlinkedMatch` takes priority over email match when `clerkId` is present. This is already safe.

---

## Affected Areas

| Area | File(s) | Change Needed |
|------|---------|---------------|
| API route — create student | `app/api/staff/students/route.ts` (NEW) | POST handler |
| Auth gate | `lib/security/staff-portal-auth.ts` | Reuse `authorizeStudentOperationalRequest()` |
| DB write | `lib/users.ts` | Reuse `upsertUserByIdentifiers` |
| Clerk | `lib/clerk-users.ts` | Optionally reuse `findClerkUserByIdentifiers` |
| Payment record | `prisma/schema.prisma` → `Purchase` | Reuse; new `source` value in metadata |
| Audit | `lib/audit/student-data-audit.ts` | Call `writeStudentDataAudit` on create |
| Staff panel UI | `StaffStudentsBoardPanel.tsx` | Add "Create student" CTA |
| UI hook | `useStaffStudentsBoardAdmin.ts` OR new `useStaffCreateStudentAdmin.ts` | Create form state |
| Staff board prop types | `buildStaffStudentsBoardPanelProps.ts` | Thread new props |
| Composition | `useStaffUsersAdminComposition.ts` | Wire hook |

---

## Approaches

### Approach A — Standalone payment record (recommended)

Create a `Purchase` row with a new `source: "staff_created_student"` in metadata and `paymentChannel: "manual"` (or `"cash"`). The `courseSlug` field would use a sentinel value (e.g. `"_staff_registration"`) or a real class slug if the staff knows what the student is paying for.

**Pros**: No schema change. Reuses existing payment/settlement infrastructure. Immediately visible in payment board. Audit trail via `writeStudentDataAudit` entity `"payment"`.

**Cons**: Forces a `courseSlug` (Purchase.courseSlug is NOT NULL in schema). A sentinel slug is a workaround, not semantic. The payment board may show this record oddly if it doesn't correspond to a real class.

**Decision required**: Is the "amount/price to pay" a deposit/registration fee or an enrollment in a specific class?

### Approach B — User-only creation (no purchase)

Create the `User` record via `upsertUserByIdentifiers`. No `Purchase` row. Staff records the amount owed in a note/comment field or separate model.

**Pros**: Clean separation. No courseSlug required. Student board shows the new user immediately via search.

**Cons**: No payment record. Existing board settlement flow won't track this amount. No native audit trail for the amount.

### Approach C — User + Purchase in transaction (balanced)

Create the `User` + optionally a `Purchase` with `status: "pending"` and `courseSlug: "_registration"` (or let staff pick a class). Write `StudentDataAudit` entity `"profile"` for the user creation event and entity `"payment"` for the purchase if present.

**Pros**: Satisfies both identity capture and amount tracking. Flexible — amount is optional if staff doesn't know yet.

**Cons**: Requires defining the sentinel slug policy or adding a nullable `courseSlug` column (schema change).

---

## Recommendation

**Use Approach C** with the following constraint decisions:

1. **`courseSlug` policy**: Use a reserved sentinel `"_staff_registration"` and `courseTitle: "Staff registration"`. This avoids a schema change and keeps the Purchase table consistent. The payment board must filter this sentinel out of class-based views (or it will show as an uncategorized item — which is acceptable).

2. **Payment amount**: Staff enters an amount in cents (or zero). If zero, omit the Purchase row entirely — create User only.

3. **Email/phone**: At least one is required. Phone-only is valid (placeholder email is generated). Email-only is valid.

4. **Clerk user**: Do NOT create a Clerk user at staff-create time. The student will create their own Clerk account when they complete their profile via the web. `upsertUserByIdentifiers` creates a DB-only `User` (clerkId = null). The kiosk/checkout flow already handles this merger path.

5. **Audit**: Write `writeStudentDataAudit` with `entity: "profile"`, `field: "created"`, `reason: "Student created by staff"` to capture the creation event. If a Purchase is created, also write entity `"payment"`.

6. **Permission gate**: Use `authorizeStudentOperationalRequest()`. This gives access to owner + admin + front_desk. Admin+manager does NOT have this — verify this is acceptable. (owner and admin get all permissions, so this is fine.)

7. **UI placement**: Add a "New student" button in `StaffStudentsBoardPanel` header, next to the search bar. Opens a modal or inline form (follow existing modal pattern from `StaffAdminModalOverlays`).

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Duplicate user on phone+email collision | Medium | `upsertUserByIdentifiers` is idempotent; returns existing user. API must return 200 with existing user info rather than 409, or surface the duplicate clearly to staff. |
| Placeholder email collides with real email later | Low | Existing merger logic handles phone-based unlinked match. Document in spec. |
| Sentinel `_staff_registration` appears in payment board | Medium | Add explicit filter in `normalizePurchaseCategory` or mark as excluded in metadata (`isRegistrationDeposit: true`). |
| Front_desk creates duplicate student with different phone format | Low | `normalizePhone` in `upsertUserByIdentifiers` strips non-digits. Consistent. |
| No Clerk account means student cannot log in immediately | Expected | This is the intended handoff — student completes profile independently. Must be clear in UI feedback. |
| Amount semantics ambiguous (registration fee vs class payment) | High | MUST be resolved in spec/proposal. Staff must know what the amount represents. |
| `StudentDataAudit.entity` has no "create" value | Low | Use `"profile"` with `field: "created"`. Or extend the enum in a future spec. Document decision. |
| Admin+manager excluded from `canOperateStudentEdits` | Low | Verify intent with product. Current code: admin WITHOUT manager category cannot do studentOps (only front_desk can). This may need clarification for the "admin as applicable" requirement in the user intent. |

### Critical open question

The user intent says "owner/admin as applicable". The current `canOperateStudentEdits` function grants access to `owner`, `admin` (any category), and `staff+front_desk`. This means ALL admins can create students, not just admin+manager. Confirm this is the intended permission scope before the proposal.

---

## Ready for Proposal

Yes. The change is well-scoped and can proceed to proposal with these inputs confirmed:

- [ ] Is the "amount" a registration deposit, a class enrollment, or optional metadata?
- [ ] If a Purchase row is created, is `_staff_registration` an acceptable sentinel slug?
- [ ] Should admin+manager-only or all admins be able to create students?
- [ ] After creation, should the student receive any notification (email invite)? If yes, this requires Clerk user creation at staff-create time (changes Approach C significantly).
- [ ] Should the new student appear immediately in the students board after creation without a refresh?

### Files the proposal will scope

```
app/api/staff/students/route.ts          (NEW — POST handler)
lib/users.ts                             (reuse, no change)
lib/clerk-users.ts                       (reuse, no change)
lib/audit/student-data-audit.ts          (reuse, no change)
components/front/staff/StaffStudentsBoardPanel.tsx   (add CTA button)
components/front/staff/useStaffCreateStudentAdmin.ts (NEW — form hook)
buildStaffStudentsBoardPanelProps.ts     (thread new props)
useStaffUsersAdminComposition.ts         (wire new hook)
StaffAdminModalOverlays.tsx              (add create-student modal)
```

Optional (if Purchase is created):
```
app/api/staff/payments/shared.ts         (sentinel slug filter)
```
