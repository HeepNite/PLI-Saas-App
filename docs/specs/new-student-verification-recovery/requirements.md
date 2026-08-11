# Requirements - new-student-verification-recovery

## Status

`DESIGN COMPLETE - two-stage manual assistance handoff is the binding recovery contract; implementation remains out of scope.`

## Objective

Allow supervised Terminal or QR/mobile enrollment to obtain staff assistance when SMS verification remains unavailable after the existing second resend attempt. No scanner is required. The student explicitly requests help, which may create an unprivileged, short-lived recovery draft and display an opaque manual assistance code to give to host/staff. On a staff PC, an authenticated Owner, Admin, or Front Desk member enters that code, reviews the already captured phone, name, and email, explicitly confirms the no-SMS case and phone validation, and continues the complete existing admin student-creation flow, including its established attendance and payment choices. Teachers are excluded.

The manual assistance code is not identity proof and cannot create or verify an account by itself. The privileged, short-lived, one-time recovery ticket is created only after authenticated staff confirmation.

## Scope

### In scope

- Preserve positive existing-user detection separately from SMS/verification errors.
- Allow the existing resend and cooldown behavior during supervised Terminal or QR/mobile enrollment.
- Show `Code did not arrive?` only after the student has used the second resend attempt and explicitly chooses the action.
- Create an unprivileged, short-lived draft after that explicit action and display its opaque manual assistance code in a popup that instructs the student to give it to host/staff.
- Allow authenticated Owner, Admin, or Front Desk staff to enter the code, review captured phone/name/email, explicitly confirm no-SMS and phone validation, and thereby create the privileged recovery ticket.
- Reuse the complete existing admin student-creation flow, authorization, audit behavior, attendance choices, and payment behavior.
- Preserve short expiry, one-time privileged-ticket consumption, authorization before disclosure, non-leakage, and lifecycle cleanup.

### Out of scope

- Application-code, test, Clerk configuration, provider configuration, external-data, or payment-behavior changes.
- Scanner requirements or QR scanning for manual assistance.
- Recovery-specific student-creation endpoints, permissions, payment, checkout, attendance, or payment-state variants.
- Ordinary self-service enrollment, OAuth as a shared-kiosk recovery mechanism, or treating a manual assistance code as identity proof.

## Functional Requirements

1. Existing-user handling MUST occur only with positive existing-user evidence. Generic errors and SMS/verification failures MUST remain distinct.
2. During supervised Terminal or QR/mobile enrollment, the student MAY use the existing resend behavior subject to its existing retry and cooldown rules.
3. The UI MUST present `Code did not arrive?` only after the second resend attempt has been used. This threshold is a UX gate, not evidence of carrier delivery failure.
4. The action MUST require an explicit student choice. A generic error, client error state, prepared Clerk user, or unverified Clerk user alone MUST NOT create a privileged ticket.
5. After the explicit action, the client MAY create one unprivileged short-lived recovery draft for the active supervised enrollment and display an opaque manual assistance code. The popup MUST instruct the student to give the code to host/staff.
6. The manual assistance code MUST be opaque, contain no personal data or failure details, be non-URL, and must not create, verify, or authenticate an account by itself.
7. An authenticated Owner, Admin, or Front Desk staff member MUST be authorized before draft lookup or disclosure. Teachers MUST be excluded.
8. The authorized staff member MUST enter the manual assistance code, review the captured normalized phone, name, and email, and explicitly confirm both that the student reports no SMS and that the phone is validated.
9. Only that authenticated staff confirmation MAY create the privileged recovery ticket. The privileged ticket MUST be short-lived, server-enforced, opaque, and consumable at most once.
10. Privileged ticket consumption MUST invoke the existing complete admin student-creation flow using the captured identity fields. It MUST NOT accept replacement identity fields or introduce a recovery-specific endpoint.
11. The staff confirmation MUST validate the phone only for this exceptional supervised path. The resulting user MAY be phone-verified without SMS only through a valid consumed privileged ticket.
12. The existing admin workflow remains responsible for attendance date/session and payment choices and behavior. Recovery MUST introduce no variant.
13. Drafts and tickets MUST expire, be invalidated on completion, cancellation, timeout, terminal reset, staff logout, and account switch where applicable, and have sensitive payload removed during cleanup.
14. Audit behavior MUST identify the staff actor, the draft/ticket correlation, the explicit no-SMS and phone-validation confirmations, and the resulting creation event without retaining the manual code, privileged credential, or duplicated sensitive payload.

## Security And Data Rules

- The unprivileged draft is the only client-initiated recovery record and is allowed only after the explicit threshold-gated action. It cannot confer account, verification, or creation privilege.
- The privileged ticket is created only after staff authentication, authorization, review, and explicit confirmation; its credential is stored server-side only as a verifier or hash.
- Draft and ticket credentials and payloads MUST NOT appear in URLs, browser storage, analytics, logs, telemetry, error reporting, or audit payloads.
- Draft lookup and disclosure MUST occur only after staff authentication and `canOperateStudentEdits` / `studentOps` authorization. Unknown, expired, invalid, and unauthorized codes MUST not create an existence oracle.
- Reuse existing audit retention. Do not persist raw Clerk errors when a stable category and correlation are sufficient.
- The second resend threshold does not prove a provider, carrier, or delivery failure; operational diagnosis remains separate.

## Operational Diagnostic Evidence

Authorized operators should inspect Clerk Dashboard Application Logs for `sign_in.prepare_first_factor.passed`, `sign_in.prepare_first_factor.failed`, rate limits, normalized number format, SMS allowlist status, and provider/delivery configuration. The current production CLI/API does not expose these logs.

## Acceptance Criteria

- [ ] The second resend enables `Code did not arrive?` but does not assert SMS delivery failure.
- [ ] The explicit action creates only an unprivileged short-lived draft and opaque manual assistance code; no scanner is required.
- [ ] The popup tells the student to give the code to host/staff, and the code alone cannot create or verify an account.
- [ ] Only authenticated Owner, Admin, or Front Desk staff can disclose a draft, confirm recovery, create a privileged ticket, or complete recovery; a Teacher cannot.
- [ ] Staff must enter the code, review captured identity fields, and explicitly confirm both no-SMS and phone validation before privileged ticket creation.
- [ ] Privileged ticket use is one-time, short-lived, authorized before disclosure, non-leaking, audited, and lifecycle-bound.
- [ ] The complete existing admin creation, attendance, and payment workflow remains unchanged.
- [ ] A pre-created or unverified Clerk user, generic error, or client request alone cannot create a privileged ticket or obtain verified-phone treatment.

## Definition Of Done

- [ ] The design records the draft-to-ticket transition, authorization boundary, existing admin-flow integration, lifecycle ownership, audit integration, and non-leakage controls.
- [ ] Implementation and test tasks derive only from this approved design.
- [ ] Validation covers the UX threshold, unprivileged draft boundary, staff confirmation, privileged ticket controls, and unchanged admin workflow.
