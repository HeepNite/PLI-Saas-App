# Staff Create Student - Requirements

## Status

`DRAFT`

## Objective

Allow authorized staff to create a student from the staff student panel with minimal identity and payment information, then hand the student off to complete their full profile on the web.

## Scope

### In scope

- Create or reuse a Clerk student identity and a linked DB student/user record from the staff panel using minimal information.
- Support `front_desk`, `owner`, and `admin` staff creation access through the student operational permission boundary.
- Require at least one contact identifier: phone or email.
- Support an optional amount to collect at creation time.
- Support two v1 payment modes when amount is greater than zero:
  - Cash pending payment.
  - Card QR checkout.
- Record staff actor audit entries for student creation and payment creation.
- Refresh or otherwise update the student board so staff can see the created student/payment state.

### Out of scope

- SMS payment links. This is deferred to a follow-up change after SMS provider, consent, and delivery rules are confirmed.
- Custom SMS invitation/payment-link delivery outside Clerk. Clerk-managed phone verification/sign-in remains in scope.
- Collecting full student profile data during staff-created time.
- Full student profile completion inside the staff form.
- Class-specific enrollment from this form.
- New database schema unless implementation proves the sentinel purchase strategy is unsafe.

## Context

Front desk currently needs a fast way to add a walk-in/new student without making the student complete full web sign-up first. The staff-created record should let staff track payment immediately, while the student later completes profile details through the normal web profile flow.

The proposal recommends reusing existing primitives:

- `findClerkUserByIdentifiers` / `ensureClerkUser` for Clerk-side identity lookup/creation.
- `upsertUserByIdentifiers` for DB-side student identity creation/linking and duplicate handling.
- `authorizeStudentOperationalRequest()` for owner/admin/front_desk authorization.
- `Purchase` for pending cash and card checkout payment tracking.
- `StudentDataAudit` for actor accountability.

## Functional Requirements

### Authorization

- The create-student action MUST be available to `owner`, `admin`, and `staff + front_desk` users.
- Other staff categories MUST NOT be able to create students through this flow.
- Server-side authorization MUST enforce the same rule as the UI.

### Minimal identity

- Staff MUST provide at least one of `phone` or `email`.
- Name MAY be provided, but MUST NOT be required.
- The system MUST reuse existing Clerk lookup behavior by phone/email before creating a new Clerk user.
- The system MUST create a Clerk user when no matching Clerk user exists.
- The system MUST link the DB user to the Clerk id so the student can later access their web profile.
- The system MUST NOT assign staff roles, staff categories, or staff permissions to staff-created student Clerk users.
- When email is provided, the system SHOULD trigger Clerk-managed email invitation/activation if supported by the existing Clerk integration.
- When phone is provided, the system SHOULD allow the student to access their profile through Clerk-managed phone verification/sign-in if supported.
- The student MUST be able to complete remaining profile fields later through the web profile flow using the created/reused Clerk identity.

### Cash payment mode

- When staff selects cash and enters an amount greater than zero, the system MUST create a pending cash payment record for the student.
- The pending cash payment MUST be visible from the student board/payment settlement surface.
- Staff MUST be able to mark the cash payment paid through the existing settlement workflow.
- If amount is zero, the system MUST create only the student/user record and MUST NOT create a payment record.

### Card QR payment mode

- When staff selects card QR and enters an amount greater than zero, the system MUST create a payment record and a server-side Stripe Checkout Session.
- The staff UI MUST display a scannable QR code for the checkout URL.
- The checkout session MUST include metadata sufficient to reconcile payment back to the created user and purchase.
- If the QR checkout expires or is not completed, the payment record MUST remain pending and recoverable from staff payment follow-up workflows.

### Payment semantics

- V1 payment amount represents a staff-created registration deposit/general student payment, not a class-specific enrollment.
- Registration deposit purchases SHOULD use the reserved sentinel `courseSlug` `_staff_registration` plus metadata such as `source: "staff_created_student"` and `isRegistrationDeposit: true` unless design identifies a safer existing contract.
- Registration deposit records MUST NOT be treated as class attendance/enrollment purchases.

### Audit

- Every successful student creation MUST write a `StudentDataAudit` entry with the acting staff user.
- Every successful payment record creation MUST write a payment-related audit entry with the acting staff user.
- Audit entries MUST include enough information to identify the target student, staff actor, field/entity affected, and before/after state where applicable.

### UI behavior

- The staff student panel MUST provide a clear `New student` action for authorized users.
- The create-student form MUST collect phone/email, optional name, optional amount, and payment mode when amount is greater than zero.
- After creation, the UI MUST show whether an existing student was reused or a new one was created.
- After creation, the board MUST refresh or update so staff can see the resulting student/payment state.
- For card QR, the UI MUST show the QR without exposing Stripe secrets to the client.

### Validation and errors

- Missing both phone and email MUST return a validation error.
- Invalid email or phone format MUST return a validation error.
- Negative amount MUST return a validation error.
- Payment mode MUST be required when amount is greater than zero.
- Card QR failures MUST NOT orphan an unusable student record without a staff-visible recovery path.
- Duplicate identity matches MUST NOT create duplicate users; the response MUST clearly indicate reuse of an existing student.

## Security Rules

- Use server-side authorization for creation and payment operations.
- Create/reuse Clerk users server-side only; do not expose Clerk management privileges to the browser.
- Do not send custom SMS invitations or payment links in v1; use only Clerk-managed phone verification/sign-in for phone access.
- Do not expose Stripe secret keys or privileged checkout parameters to the browser.
- Do not log full checkout URLs in audit records.
- Rate-limit the create-student API route.
- Preserve existing front-desk restrictions around staff/owner/admin profile management.

## Acceptance Criteria

- [ ] Given an owner, admin, or front-desk staff user, when they open the student panel, then they can access a `New student` flow.
- [ ] Given an unauthorized staff user, when they attempt to access the create-student API, then the request is rejected.
- [ ] Given phone-only input, when staff creates a student, then a Clerk user is created/reused and linked to a DB user.
- [ ] Given email-only input, when staff creates a student, then a Clerk user is created/reused and linked to a DB user.
- [ ] Given email input, when staff creates a student, then the system triggers or prepares Clerk email activation according to the design contract.
- [ ] Given phone input, when staff creates a student, then the student can later access the profile through Clerk-managed phone verification/sign-in according to the design contract.
- [ ] Given matching phone/email for an existing user, when staff creates a student, then no duplicate user is created and the response indicates an existing student was reused.
- [ ] Given amount greater than zero and payment mode `cash`, when staff submits the form, then a pending cash payment appears for the student.
- [ ] Given amount greater than zero and payment mode `card_qr`, when staff submits the form, then a Stripe checkout URL is created and displayed as a QR code.
- [ ] Given amount zero, when staff submits the form, then no purchase/payment record is created.
- [ ] Given successful creation, then audit entries record the acting staff user.
- [ ] Given the new student later accesses the web profile, then the existing Clerk-linked DB record is used and the student can complete missing profile fields.
- [ ] SMS payment link behavior is not available in v1 and is documented as a follow-up.

## Definition Of Done

- [ ] Requirements are implemented with tests for API authorization, validation, duplicate handling, cash pending payment, card QR checkout, and audit logging.
- [ ] UI tests cover authorized/unauthorized visibility and successful create flow states.
- [ ] Typecheck and focused tests pass.
- [ ] Any sentinel `_staff_registration` behavior is either filtered/labeled correctly or replaced by a documented safer design.
- [ ] Unresolved ambiguity is documented before implementation begins.

## Open Questions

- Should `admin` access mean all admins, or only `admin + manager`? Current student operational permission allows all admins.
- Should zero-amount creation be allowed in production, or should the form require a payment amount?
- What exact label should registration deposit payments use in the staff payment board?
- What is the desired Stripe Checkout expiry for card QR? Proposal recommends 30 minutes.
- Should card QR creation create the `Purchase` before Stripe succeeds, or only after Stripe session creation succeeds?
- What exact Clerk API should be used for email activation/invitation in this project version?
