# Proposal: Staff Create Student

## Intent

Allow front-desk and owner/admin staff to create a new student from the staff panel using only phone and/or email plus a payment amount. The student completes their full profile later through the web. The flow must support three payment modes: pending cash, card QR checkout, and SMS payment link (optional, follow-up if not risky).

---

## Problem

Staff currently have no way to register a new student without the student first completing full Clerk sign-up. At front desk, this means either turning the tablet over to the student to self-enroll or manually tracking new clients outside the system. Neither path produces an audit trail or a pending payment record that the settlement board can track.

---

## Goals

- Staff can create a student with minimal input: phone OR email (at least one required), optional name, and a payment amount.
- Staff can choose how the student will pay: cash (pending), card QR (Stripe Checkout on a tablet), or SMS payment link.
- The new student appears immediately in the student board after creation.
- A pending payment record is created and visible in the settlements board.
- Every creation action is captured in the audit log.
- The student can complete their profile later via the web without any data conflicts.

---

## Non-Goals

- Requiring full student profile completion at creation time. Staff creates the login identity, but the student completes profile details later.
- Enrolling the student in a specific class from this form. Payment here is a registration deposit or general credit, not a class purchase.
- Sending a branded onboarding email (separate from the optional SMS link).
- Changing any existing checkout, PIN, or kiosk flows.
- Schema migrations unless absolutely necessary (sentinel slug approach avoids them).

---

## Proposed Approach

### 1. API: `POST /api/staff/students`

New route. Auth gate: `authorizeStudentOperationalRequest()` — covers owner, admin, and staff+front_desk.

Request body:
```ts
{
  phone?: string;          // E.164 preferred; normalized internally
  email?: string;          // At least one of phone/email required
  name?: string;
  amountCents: number;     // 0 = user-only, no Purchase row created
  paymentMode: "cash" | "card_qr" | "sms_link";
  note?: string;
}
```

Validation: phone OR email required. `amountCents` must be ≥ 0. `paymentMode` required if `amountCents > 0`.

Response:
```ts
{
  userId: string;
  isExisting: boolean;       // true when upsert returned an existing user
  purchaseId?: string;
  stripeCheckoutUrl?: string; // for card_qr mode
  smsStatus?: "sent" | "skipped" | "error"; // for sms_link mode
}
```

### 2. User and Clerk creation

Create or reuse a Clerk user during staff creation so the student can later access their web profile. Reuse `findClerkUserByIdentifiers` / `ensureClerkUser` where possible, then persist the local DB user with `upsertUserByIdentifiers` using the Clerk id.

If a matching Clerk user already exists by email or phone, reuse it. If no Clerk user exists, create one with the provided email and/or phone, without requiring staff to collect full profile details.

Decision: v1 should trigger Clerk-managed email invitation/activation when email is available, and support Clerk-managed phone verification/sign-in when phone is available. Custom SMS links remain out of scope.

### 3. Purchase record (when `amountCents > 0`)

Create a `Purchase` row in the same DB transaction:

| Field | Value |
|-------|-------|
| `courseSlug` | `"_staff_registration"` (sentinel) |
| `courseTitle` | `"Staff Registration"` |
| `status` | `"pending"` |
| `paymentChannel` | `"cash"` \| `"stripe"` \| `"stripe_link"` |
| `settlementStatus` | `"pending"` |
| `amountCents` | from request |
| `metadata.source` | `"staff_created_student"` |
| `metadata.paymentMode` | the chosen mode |
| `metadata.isRegistrationDeposit` | `true` |

The `isRegistrationDeposit: true` flag allows payment board queries to filter or label these records explicitly without altering existing views.

When `amountCents === 0`, no Purchase row is created. User is created only.

### 4. Payment Mode Strategy

#### Mode A — Cash (pending)

Staff enters the amount. The Purchase row is created with `paymentChannel: "cash"` and `settlementStatus: "pending"`. Staff marks it paid later from the settlements board (existing flow). No external call needed at creation time.

This is the lowest-risk mode and should be the default.

#### Mode B — Card QR Checkout

Staff triggers a Stripe Checkout Session creation (server-side). The response returns a `stripeCheckoutUrl`. The UI renders this URL as a QR code on the tablet screen. The student scans it from their phone and completes payment independently. The existing Stripe webhook infrastructure handles payment confirmation and settlement update.

Implementation note: the Checkout Session must carry `metadata.purchaseId` and `metadata.userId` so the webhook can reconcile it. The `stripeCheckoutUrl` must use `payment_method_types: ["card"]` and a short expiry (30 min).

Risk: requires Stripe Checkout Session creation on every student creation in this mode. If the student does not scan the QR, the session expires and the Purchase stays `pending` — staff can follow up via settlements board.

#### Mode C — SMS Payment Link (optional / follow-up)

After the Purchase row is created (any mode), staff can optionally trigger an SMS to the student's phone containing a Stripe Payment Link or a hosted checkout URL. This is a second step, not part of the core creation flow.

Recommendation: **defer SMS link to a follow-up spec** (`staff-send-payment-link`). The risk is:
- Requires an SMS provider integration (Twilio or equivalent) if not already in place.
- Phone must be E.164-valid and reachable — not guaranteed at creation time.
- Regulatory risk (opt-in consent for promotional SMS varies by region).

If SMS is already available in the project (verify in spec phase), it can be added as a non-blocking async step on the same `POST /api/staff/students` request. Otherwise, expose a separate `POST /api/staff/students/{userId}/send-payment-link` endpoint for future use.

### 5. Audit

Call `writeStudentDataAudit` for every creation:

- `entity: "profile"`, `field: "created"`, `reason: "Student created by staff"` — always.
- `entity: "payment"`, `field: "created"`, `reason: "Registration deposit recorded by staff"` — when a Purchase row is created.

Both writes happen inside the same transaction as the DB writes.

### 6. UI

Add a "New student" button in `StaffStudentsBoardPanel` header, next to the search bar. Opens a modal following the existing `StaffAdminModalOverlays` pattern.

Modal form:
1. Phone and/or email field (at least one required).
2. Name (optional).
3. Amount (optional; defaults to 0 / "no payment now").
4. Payment mode selector — visible only if amount > 0: Cash / Card QR.
5. Note (optional).
6. Submit.

After successful creation:
- If `isExisting: true`, show an inline warning: "This phone/email already belongs to an existing student. No duplicate was created."
- If `paymentMode === "card_qr"`, render the QR code in a modal overlay for the student to scan.
- Board refreshes (or optimistically inserts) the new student card.

### 7. Affected Files

| Area | File | Change |
|------|------|--------|
| API route | `app/api/staff/students/route.ts` | NEW — POST handler |
| Auth | `lib/security/staff-portal-auth.ts` | Reuse `authorizeStudentOperationalRequest()` |
| User upsert | `lib/users.ts` | Reuse — no change |
| Audit | `lib/audit/student-data-audit.ts` | Reuse — no change |
| Stripe Checkout | `lib/stripe.ts` or new `lib/stripe-checkout.ts` | Create Checkout Session for card_qr mode |
| UI panel | `components/front/staff/StaffStudentsBoardPanel.tsx` | Add "New student" CTA |
| UI hook | `components/front/staff/useStaffCreateStudentAdmin.ts` | NEW — form + submission state |
| Modal | `StaffAdminModalOverlays.tsx` | Add create-student modal |
| Board props | `buildStaffStudentsBoardPanelProps.ts` | Thread new hook props |
| Composition | `useStaffUsersAdminComposition.ts` | Wire new hook |
| Payment board filter | `app/api/staff/payments/shared.ts` | Filter/label `_staff_registration` sentinel (optional) |

---

## Security / Audit

- Route is gated by `authorizeStudentOperationalRequest()`. Front-desk staff can create students; they cannot manage staff accounts.
- Clerk user creation must be server-side only and must not grant staff roles, staff categories, or staff permissions.
- The Stripe Checkout Session is server-created; the client never receives a Stripe secret key.
- All creation events are written to `StudentDataAudit` with `staffClerkId`, `staffName`, and `ipAddress`.
- Duplicate detection is idempotent: `upsertUserByIdentifiers` will return the existing user rather than creating a second record. The API surfaces `isExisting: true` to inform staff.
- Custom SMS link (follow-up only): must only be sent to a verified phone number. Rate-limit the send endpoint. Do not log the full Stripe link URL in audit (log the `purchaseId` reference only).

---

## Open Questions for Spec Phase

1. **Amount semantics**: Is the amount a registration/deposit fee (non-class-specific) or should staff be able to optionally link it to a class slug? If class-linking is required, the `_staff_registration` sentinel is not sufficient and a schema change may be needed.
2. **Permission scope**: Should `admin` (any category) be able to create students, or only `admin+manager`? Current `canOperateStudentEdits()` grants ALL admins access. Confirm intentional.
3. **Clerk activation API**: Which Clerk API should this project use to trigger email invitation/activation for staff-created users, and what fallback copy should the staff UI show for phone-only users?
4. **Stripe Payment Link vs Checkout Session**: For card_qr mode, which Stripe primitive is preferred — a one-time Checkout Session URL (preferred for security; expires) or a reusable Stripe Payment Link (simpler but less controlled)?
5. **Board refresh strategy**: After creation, should the board do a full reload, an optimistic insert, or a targeted server revalidation via `router.refresh()`?
6. **Sentinel slug filtering**: Should `_staff_registration` purchases be excluded from class-based enrollment views by default, or shown with a distinct label? Clarify the expected behavior in the settlements and enrollment boards.
7. **Zero-amount creation**: Is it valid to create a student with no payment (amount = 0)? If yes, there is no Purchase row — this means the student appears in the user board but not the settlements board. Confirm this is acceptable.

---

## Acceptance Direction

- Staff (front_desk, admin, owner) can open a "New student" modal from the student board.
- Creating with phone or email (or both) creates/reuses a Clerk user and links it to the local DB user.
- If the student already exists, the API returns `isExisting: true` and the existing record without duplication.
- If amount > 0 and mode = cash, a Purchase row with `status: pending` and `paymentChannel: cash` is created.
- If amount > 0 and mode = card_qr, a Stripe Checkout Session is created and a QR code is shown in the UI.
- All creation events are recorded in `StudentDataAudit`.
- The new student card appears in the board immediately after creation.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| `_staff_registration` sentinel appears incorrectly in class enrollment views | Medium | Add `isRegistrationDeposit: true` metadata flag; filter in board queries. Clarify in spec. |
| QR Checkout Session expires before student scans | Low | Session expires gracefully; Purchase stays `pending`. Staff can resend or switch to cash via settlements board. |
| Duplicate student created with different phone format | Low | `normalizePhone` in `upsertUserByIdentifiers` strips non-digits consistently. |
| Clerk creation fails after local validation | Medium | Design should create/reuse Clerk first or use a recovery sequence that avoids orphaned local records. |
| SMS link deferred but stakeholder expects it in v1 | Medium | Clarify in spec phase. If required, SMS integration must be scoped and consent policy defined before implementation. |
| Admin permission scope broader than expected | Low | `canOperateStudentEdits()` currently gives ALL admins access. Confirm with product before finalizing spec. |
| Stripe Checkout Session creation failure blocks student record creation | Medium | Consider creating the User + Purchase row first, then creating the Stripe session in a second step. If Stripe fails, the student record exists and staff can retry payment mode via settlements board. |
| `StudentDataAudit.entity` enum does not include a "create" value | Low | Use `entity: "profile"`, `field: "created"`. Document this convention in spec. If a `student_created` entity type is needed later, it is a non-breaking addition. |

---

## Rollback Plan

All additions are additive: a new API route, a new UI hook, and a new modal. No existing routes or models are modified. Rollback removes these files. Existing student creation paths (kiosk, self-enroll) are unaffected.

---

## Dependencies

- `findClerkUserByIdentifiers` / `ensureClerkUser` (`lib/clerk-users.ts`) — existing, reused/adapted.
- `upsertUserByIdentifiers` (`lib/users.ts`) — existing, reused with Clerk id.
- `authorizeStudentOperationalRequest()` (`lib/security/staff-portal-auth.ts`) — existing, reused.
- `writeStudentDataAudit` (`lib/audit/student-data-audit.ts`) — existing, reused.
- Stripe SDK — existing; card_qr mode requires Checkout Session creation.
- SMS provider — NOT confirmed in scope. Requires verification in spec phase before Mode C is committed.
