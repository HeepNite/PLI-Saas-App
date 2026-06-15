# Staff Create Student - Design

## Status

`DRAFT`

## Summary

Add a staff student-creation flow to the Students panel. Authorized staff create or reuse a Clerk student identity, link it to the local `User`, optionally create a registration-deposit `Purchase`, and either leave it pending as cash or display a Stripe Checkout QR for card payment.

V1 includes **Cash** and **Card QR** only. Custom SMS payment/invitation links are explicitly deferred. Clerk-managed email invitation/activation and Clerk-managed phone verification/sign-in are in scope.

## Existing Contracts To Reuse

- `authorizeStudentOperationalRequest()` — server authorization for owner/admin/front_desk student operations.
- `findClerkUserByIdentifiers()` and `ensureClerkUser()` — Clerk lookup/create helpers.
- `upsertUserByIdentifiers()` — local DB user create/link/deduplication.
- `Purchase` — payment tracking row.
- `writeStudentDataAudit()` — actor-aware student audit.
- Existing staff panel composition pattern: hook owns form state, prop builder threads panel props, modal overlay owns UI.

## API Design

### Route

Create `POST /api/staff/students`.

Auth:

```ts
const authResult = await authorizeStudentOperationalRequest()
```

Request body:

```ts
type StaffCreateStudentRequest = {
  email?: string
  phone?: string
  name?: string
  amountCents?: number
  paymentMode?: "cash" | "card_qr"
  note?: string
}
```

Response:

```ts
type StaffCreateStudentResponse = {
  userId: string
  clerkUserId: string
  isExisting: boolean
  purchaseId?: string
  paymentMode?: "cash" | "card_qr"
  stripeCheckoutUrl?: string
  activation: {
    emailInvitationAttempted: boolean
    phoneSignInAvailable: boolean
  }
}
```

### Validation

- Require at least one of email or phone.
- Normalize/lowercase email.
- Phone must be acceptable to Clerk phone creation when phone-only or phone access is expected. If the existing helper requires E.164 (`+...`), return a clear validation error rather than silently creating a user that cannot phone sign in.
- `amountCents` defaults to `0`; it must be integer and `>= 0`.
- If `amountCents > 0`, require `paymentMode` as `cash` or `card_qr`.
- `name` and `note` are optional and length-limited.

## Identity Sequence

Use Clerk first, then local DB link.

1. Call `findClerkUserByIdentifiers({ email, phone })`.
2. If found, reuse the Clerk user and update missing name/phone using `updateClerkUserIfMissing` via `ensureClerkUser`/helper extraction as needed.
3. If not found, create a Clerk user using `ensureClerkUser` or a new helper based on the same logic.
4. If email is present, trigger Clerk-managed invitation/activation using the current project pattern: `client.invitations.createInvitation({ emailAddress, notify: true, ignoreExisting: true, redirectUrl })` where appropriate.
5. If phone is present, rely on Clerk-managed phone verification/sign-in; do not send custom SMS.
6. Call `upsertUserByIdentifiers({ clerkId, email, phone, name })` to create/link local `User`.

### Clerk activation notes

The staff-management route already uses `client.invitations.createInvitation({ notify: true, ignoreExisting: true, redirectUrl })` for email invites. For students, use a student-facing redirect URL, not `/staff/log-in`; recommended redirect is the normal profile/onboarding entry route.

Phone-only users cannot receive a custom SMS in v1. The UI must explain: “Student can sign in later using phone verification.”

## Payment Sequence

### Zero amount

- Create/reuse Clerk + local DB user.
- Write profile creation audit.
- Do not create `Purchase`.

### Cash

Create a `Purchase` row with:

```ts
{
  userId,
  courseSlug: "_staff_registration",
  courseTitle: "Staff Registration",
  amount: amountCents,
  status: "pending",
  metadata: {
    source: "staff_created_student",
    paymentMode: "cash",
    paymentChannel: "cash",
    settlementStatus: "pending",
    isRegistrationDeposit: true,
    staffNote: note,
  }
}
```

The existing settlement flow can later mark it paid. The payments board must label this as a registration deposit and must not treat it as class attendance.

### Card QR

Recommended sequence:

1. Create/reuse Clerk + local DB user.
2. Create pending `Purchase` with metadata `paymentMode: "card_qr"`, `paymentChannel: "card"`, `isRegistrationDeposit: true`.
3. Create a Stripe Checkout Session server-side for the exact amount.
4. Store `stripeCheckoutSessionId` on the purchase if the model supports it; otherwise store session id in metadata.
5. Return `stripeCheckoutUrl`; UI renders it as QR.

Checkout Session metadata must include:

```ts
{
  purchaseId,
  userId,
  source: "staff_created_student",
  isRegistrationDeposit: "true",
}
```

Expiry: 30 minutes. If the session expires, leave the purchase pending. Staff can retry card QR later or settle cash manually.

## Audit Strategy

Write audit entries after successful local DB writes.

- `entity: "profile"`, `field: "created"`, `targetUserId`, actor, reason `"Student created by staff"`.
- If payment created: `entity: "payment"`, `field: "created"`, `entityId: purchaseId`, before `null`, after amount/mode, reason `"Registration deposit recorded by staff"`.

Do not log full checkout URLs. Log `purchaseId` / Stripe session id only.

## UI Design

### Entry point

Add `New student` action in `StaffStudentsBoardPanel` for users allowed by `canOperateStudentEdits(currentRole, currentCategory)`.

### State owner

Add `useStaffCreateStudentAdmin.ts` hook:

- form state
- validation state
- submit state
- created result
- QR overlay state
- `refreshPaymentsBoard` callback integration after success

### Modal

Add create-student modal to existing staff modal overlay composition.

Fields:

- email
- phone
- name (optional)
- amount
- payment mode (`cash` / `card_qr`) shown only when amount > 0
- note (optional)

Success states:

- Existing user reused warning.
- Cash: “Pending cash payment created.”
- Card QR: show QR from `stripeCheckoutUrl` and “expires in 30 minutes” copy.
- Phone-only: show “Student can sign in later using phone verification.”
- Email: show “Invitation/activation email sent” when attempted.

## Board Refresh Strategy

Use full board refresh first (`refreshPaymentsBoard()` / existing board refresh path) rather than optimistic insert. This keeps derived payment/card state consistent and avoids duplicating card aggregation logic in the client.

## Test Strategy

### API tests

- rejects unauthorized staff.
- accepts owner/admin/front_desk.
- rejects missing email+phone.
- rejects invalid amount/payment mode.
- creates/reuses Clerk user and local DB user.
- creates no purchase when amount is zero.
- creates pending cash purchase.
- creates card QR purchase + Stripe Checkout Session.
- writes profile/payment audits.
- does not assign staff metadata.

### UI tests

- `New student` visible to owner/admin/front_desk, hidden from unauthorized staff.
- cash submit success refreshes board and shows pending copy.
- card QR success renders QR URL state.
- validation errors render without submitting.

## Risks and Tradeoffs

- **Clerk helper gap**: current `ensureClerkUser` requires email for creation. Phone-only creation may need a small helper extension to create Clerk users with phone only.
- **Invitation API semantics**: `createInvitation` exists in staff-user creation, but student redirect URL and interaction with pre-created users must be verified in implementation tests.
- **Sentinel purchase leakage**: `_staff_registration` must be labeled/filtered so it does not appear as a class enrollment.
- **Stripe session failure after purchase creation**: leave purchase pending and return retryable error/copy; do not delete the student.
- **External side effects**: Clerk and Stripe are outside DB transaction; order operations to avoid local orphan records where possible and make failures recoverable.

## Design Decisions

- Use full board refresh after success.
- Use 30-minute Checkout Session expiry.
- Use `_staff_registration` sentinel for v1; no schema migration unless implementation proves it unsafe.
- Use Clerk-managed email/phone activation only; no custom SMS.
