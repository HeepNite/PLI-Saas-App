# Analysis - new-student-verification-recovery

## Executive Summary

The current flow conflates positive existing-user evidence with SMS request errors. The approved recovery experience does not require a scanner or a server determination that a carrier failed delivery. Instead, the existing resend/cooldown flow remains available; using the second resend enables a threshold-gated `Code did not arrive?` action. After explicit student action, the client may create an unprivileged, short-lived draft and show an opaque manual assistance code. Authorized staff later enter that code on the staff PC, review the captured identity fields, and explicitly confirm the no-SMS report and phone validation. Only that authenticated confirmation creates the privileged, one-time recovery ticket that reaches the existing complete admin creation flow.

## Established Evidence

| Area | Established evidence | Design impact |
| --- | --- | --- |
| Verification hook | Verification request errors are currently emitted as `existing_detected`. | Preserve positive existing-user evidence separately from failures. |
| Clerk sign-in | The phone-code primitive reports a generic SMS-send error. | Do not infer carrier delivery failure or existing-user status from that error. |
| Resend UX | Retry/cooldown behavior already exists. | The second resend is a UX threshold, not an operational delivery assertion. |
| Staff authorization | `canOperateStudentEdits` / `studentOps` allows Owner, Admin, Front Desk, and front-desk guests; Teachers are excluded. | Reuse it before draft lookup or disclosure. |
| Existing student creation | `POST /api/staff/students` consumes phone, name, and email and handles Clerk identity creation. | Reuse the complete flow with ticket-derived captured fields. |
| Existing audit | `writeStudentDataAudit` records staff and target-user facts. | Record confirmation and correlation facts without a new retention policy. |
| Cross-client handoff | Mobile/kiosk state is not shared with the staff PC. | Use an opaque manual assistance code for an unprivileged draft, then a server-side privileged ticket after staff confirmation. |
| Payment and attendance | The admin form owns attendance and payment decisions. | Recovery must not create a variant. |

## Binding Policy

- The second resend attempt enables the assistance action; it is not proof of carrier delivery failure.
- Explicit student action may create only an unprivileged, short-lived draft for the active supervised enrollment.
- The popup displays an opaque manual assistance code and tells the student to give it to host/staff. No scanner is required.
- The code is a lookup capability only. It cannot authenticate the student, verify a phone, create a user, or issue the privileged ticket.
- Staff authenticate and authorize before code lookup. They enter the code, review the captured normalized phone/name/email, then explicitly confirm the reported no-SMS case and phone validation.
- That confirmation creates the privileged, short-lived, one-time ticket used by the existing admin flow. It is the only event that authorizes the phone-verification exception.
- Owners, Admins, and Front Desk staff may act; Teachers cannot.

## Constraints

- Draft and privileged ticket credentials are opaque, non-URL values containing no PII or failure details.
- Neither credentials nor payloads may enter browser storage, URLs, analytics, logs, telemetry, error reporting, or audit payloads.
- Draft lookup must be authorized before disclosure and externally uniform for unknown, expired, invalid, and unauthorized codes.
- The client may create an unprivileged draft only after the explicit threshold-gated action; it cannot create the privileged ticket.
- Expiry, one-time privileged consumption, terminal lifecycle invalidation, and cleanup apply to both stages as appropriate.
- Existing authorization, admin creation, audit, attendance, and payment contracts must be reused without scope expansion.

## Diagnostic Boundary

The second resend threshold and generic Clerk errors do not establish a carrier/provider failure. Authorized operators must inspect Clerk Dashboard Application Logs for the relevant sign-in events, rate limits, number format, allowlist status, and provider/delivery configuration.

## Remaining Technical Validation

- Verify how resend-attempt state is reliably scoped to the active supervised enrollment without making it a delivery-failure assertion.
- Verify the minimum draft storage and code-verifier design that permits authorized staff review without client-side persistence.
- Verify the existing staff route, Clerk verified-phone exception, audit writer, transaction boundary, and lifecycle owner for the privileged ticket.
- Verify that attendance date/session and payment behavior remain wholly owned by the existing admin workflow.
