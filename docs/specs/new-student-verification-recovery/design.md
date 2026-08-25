# Technical Design - two-stage manual assistance recovery

## Decision

Use two bounded server-side records for supervised Terminal or QR/mobile recovery: an unprivileged recovery draft created after the student explicitly selects `Code did not arrive?` following the second resend attempt, and a privileged recovery ticket created only after authenticated, authorized staff review and confirmation. No scanner is required. The draft's opaque manual assistance code lets staff locate the captured identity fields; it is not identity proof and confers no account-creation or verification authority.

## Quick Path

1. Preserve separate `existing_user`, SMS/verification-failure, and generic-error outcomes.
2. Allow existing resend/cooldown behavior. After the second resend, show `Code did not arrive?`.
3. Explicit student action creates an unprivileged draft and displays a non-URL opaque code with: “Give this code to the host/staff.”
4. An authenticated, authorized staff member enters the code on the staff PC. Authorization precedes lookup and disclosure.
5. Staff review captured normalized phone, name, and email and explicitly confirm no-SMS and phone validation.
6. The server reserves a privileged ticket for one caller, performs idempotent Clerk identity/phone work, then commits the existing local admin creation flow, recovery audit, ticket consumption, and sensitive scrubbing in one Prisma transaction. A failed local transaction releases the reservation for retry.
7. Expiry or terminal lifecycle events remove sensitive data.

## State Model

| State | Actor | Authority | Transition |
| --- | --- | --- | --- |
| `resend_available` | Student | Existing resend rules only. | Existing retry/cooldown flow. |
| `assistance_eligible` | UI | UX gate only after second resend. | Explicit `Code did not arrive?` action. |
| `draft_issued` | Client/server | Unprivileged lookup handoff only. | Staff authentication and code entry. |
| `staff_reviewed` | Authorized staff | Reviews captured data and confirms facts. | Server creates privileged ticket. |
| `ticket_issued` | Server | Authorizes one existing admin-flow consumption. | Atomic `issued -> processing -> consumed`; failed work returns `processing` to `issued`. |
| `consumed`, `expired`, `invalidated` | Server | No further privilege. | Cleanup removes sensitive payload. |

The second resend is not a delivery-failure classifier. A generic error, prepared Clerk user, unverified Clerk user, client state, or draft alone cannot enter `ticket_issued`.

## Staff Modal Interaction

The New student modal shows a visible `SMS code did not arrive?` control before the ordinary contact fields. It opens a dedicated accessible dialog for manual-code entry, returned-identity review, and the two confirmations. A successful lookup is display-only: it must not populate or otherwise modify the ordinary creation form. Only a successful staff confirmation may write the ticket-derived phone, email, and name to that form, then close the recovery dialog so staff can continue the unchanged attendance and payment workflow.

## Records And Credentials

| Record | Minimum payload | Credential rule | Privilege |
| --- | --- | --- | --- |
| Recovery draft | Normalized phone, name, email, source enrollment, resend-threshold/action reference, expiry, lifecycle state, numeric code namespace. | Store a verifier/hash for the opaque manual assistance code; show plaintext only in the student popup. Start at `PLI-1234`; exhaustively try each value once before rolling over to `PLI-1-1234`, then later namespaces. | None: cannot create, verify, or authenticate an account. |
| Recovery ticket | Draft reference, staff-confirmation audit reference, expiry, state, lifecycle metadata. | Store a verifier/hash for its high-entropy opaque credential. | One authorized existing admin-flow consumption only. |

Neither code may contain PII or failure details or appear in a URL. Sensitive draft/ticket payload is removed on consumption, expiry, or invalidation; retain only non-sensitive lifecycle metadata where operationally necessary.

The recovery code issuer begins in namespace zero and visits each of its 10,000 four-digit candidates at most once in a randomized cyclic order. A collision-safe unique hash write proves a candidate unavailable; only 10,000 collisions prove a namespace exhausted and permit the next namespace. Scrubbing expired or invalidated drafts clears their hashes, returning that capacity to the default namespace.

## Authorization And Disclosure

1. Authenticate the staff caller before draft/ticket lookup.
2. Apply existing `authorizeStudentOperationalRequest()` and `canOperateStudentEdits` / `studentOps`.
3. Permit Owner, Admin, and Front Desk staff, including the existing front-desk guest category; reject Teachers.
4. Verify the manual assistance code, draft state, expiry, and supervised-enrollment binding.
5. Disclose captured phone/name/email only to that authorized caller for review.
6. Require explicit no-SMS and phone-validation confirmations before ticket issuance.
7. Verify the privileged ticket's state and expiry, then pass only ticket-derived identity fields to the existing admin flow.

Unknown, expired, invalid, and unauthorized codes return uniform external failures. Audit and operational logs use a non-sensitive correlation identifier, never credentials or raw payloads.

## Existing Admin Creation Integration

The privileged ticket is an authorization input to existing `POST /api/staff/students`, not a new creation endpoint. A valid consumed ticket permits the existing Clerk verified-phone operation only for this narrow path. The route retains all existing behavior, including staff attendance date/session decisions and its existing payment choices, checkout behavior, and payment-state semantics.

## Transaction And Audit Strategy

The accepted creation decision must commit the local user upsert, privileged-ticket consumption/scrubbing, existing attendance/payment writes, and recovery audit facts together using the route transaction and `writeStudentDataAudit(..., tx)`. The route reserves the ticket before external work so concurrent callers cannot duplicate creation. Clerk identity creation/lookup and verified-phone treatment happen before the local transaction; they are idempotently reconciled on retry by reusing the Clerk identity and treating an already verified phone as complete. Any Clerk or local failure releases the reservation while the credential and draft remain valid until TTL. Audit the staff actor, non-sensitive draft/ticket correlation, explicit no-SMS and phone-validation confirmations, and resulting target identity. Do not audit credentials, raw Clerk errors, or duplicated payloads.

## Lifecycle And Cleanup

| Event | Draft action | Privileged ticket action |
| --- | --- | --- |
| Successful staff creation | Invalidate/remove sensitive payload. | Consume once; remove sensitive payload. |
| Cancellation, completion, timeout, terminal reset | Invalidate/remove sensitive payload. | Invalidate/remove sensitive payload. |
| Staff logout or account switch ending supervision | Invalidate/remove sensitive payload. | Invalidate/remove sensitive payload. |
| TTL reached | Expire/remove sensitive payload. | Expire/remove sensitive payload. |
| Cleanup sweep | Backstop only. | Backstop only. |

Server-side expiry enforcement is mandatory; client lifecycle requests are not the sole control.

## Threat Controls

| Threat | Control |
| --- | --- |
| Treating retry count as proof | Second resend is presentation-only; staff confirmation is mandatory for privilege. |
| Code-only account takeover | Draft code is unprivileged; staff authentication, authorization, review, and confirmation are required. |
| Teacher/unauthenticated disclosure | Authenticate and authorize before lookup; reject before disclosure. |
| Ticket replay | High-entropy verifier, TTL, and atomic one-time consumption. |
| PII leakage | Opaque non-URL codes; no prohibited observability or client persistence. |
| Stale recovery | Lifecycle invalidation, server expiry, and cleanup sweep. |

## Focused Tests

- Second resend gates presentation but does not classify delivery failure.
- Explicit student action creates only an unprivileged short-lived draft and safe popup code.
- Code alone cannot create, verify, authenticate, or disclose to unauthorized users.
- Owner/Admin/Front Desk authorization, Teacher exclusion, authorization-before-disclosure, and uniform lookup failure.
- Required staff review and dual confirmation before privileged-ticket issuance.
- The staff control is visible before contact fields, opens a separate dialog, leaves ordinary fields unchanged after lookup, and populates ticket-derived fields only after confirmation.
- Concurrent reservation permits one creator only; failed Clerk or local work releases a valid ticket for retry; successful local commit consumes/scrubs once with audit and student-domain writes.
- Existing admin attendance/payment behavior and narrow Clerk verified-phone exception remain unchanged.
