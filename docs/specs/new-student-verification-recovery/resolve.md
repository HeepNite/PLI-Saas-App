# Resolution - two-stage manual assistance recovery after SMS resend threshold

## Resolved Decision

No scanner is required. During supervised Terminal or QR/mobile enrollment, students retain the existing SMS resend/cooldown behavior. Once the second resend attempt has been used, the UI may show `Code did not arrive?`. This is a UX threshold only and does not prove carrier delivery failure. After an explicit student action, the client may create an unprivileged, short-lived recovery draft and show an opaque manual assistance code with instructions to give it to host/staff.

On the staff PC, an authenticated Owner, Admin, or Front Desk staff member enters the code. Authorization occurs before draft disclosure. The staff member reviews the captured normalized phone, name, and email, explicitly confirms the reported no-SMS case and phone validation, then creates the privileged, short-lived, one-time recovery ticket. That ticket alone authorizes continuation through the complete existing admin student-creation flow, including its unchanged attendance and payment behavior. Teachers are excluded.

## Decision Contract

| Topic | Resolution |
| --- | --- |
| Threshold | Present the action after the second resend attempt. It is not delivery-failure proof. |
| Draft | Explicit client action may create a short-lived, unprivileged draft for the active supervised enrollment. |
| Manual assistance code | Opaque non-URL `PLI-1234` code by default. After, and only after, all 10,000 active values are exhausted, use `PLI-1-1234`, then increment the namespace as needed. Store only a hash/verifier and a non-secret numeric namespace marker. It is not identity proof and cannot create or verify an account. |
| Staff review | Authorized staff enter the code, review captured phone/name/email, and explicitly confirm no-SMS plus phone validation. |
| Staff UI | A clearly visible `SMS code did not arrive?` control appears before ordinary contact fields. It opens a dedicated dialog; lookup does not modify the form, and only successful dual confirmation closes the dialog and populates captured identity plus the ticket. |
| Privileged ticket | Created only after authenticated staff confirmation. It is opaque, short-lived, server-enforced, and one-time. |
| Roles | `studentOps` / `canOperateStudentEdits` governs access: Owner, Admin, and Front Desk (including front-desk guest) are allowed; Teachers are excluded. |
| Creation path | Reuse existing `POST /api/staff/students` and its complete admin workflow. No new endpoint or permission. |
| Phone verification | Only valid privileged-ticket consumption after staff confirmation permits the narrow verified-phone exception. |
| Data controls | Hash/verifier-only credentials; no URL, browser storage, analytics, logs, telemetry, error-reporting, or audit-payload leakage. |
| Lifecycle | Drafts and tickets expire and are invalidated/cleaned up on terminal enrollment events; privileged tickets consume once. |
| Audit | Reuse existing behavior for staff actor, non-sensitive correlation, no-SMS confirmation, phone validation, and resulting creation facts. |

## Superseded Constraint

The prior design placed staff confirmation before any recovery record existed. It is superseded by the approved two-stage contract: explicit client action may create an unprivileged draft after the second resend threshold, while only authenticated and authorized staff confirmation creates the privileged ticket. The prior wording that a distinct generic failure state could itself enable issuance is superseded: generic error alone cannot create a privileged ticket.

## Design Handoff

1. Model resend threshold, explicit action, unprivileged draft/code, staff lookup/review, confirmation, privileged ticket, and existing admin creation as separate states.
2. Reuse existing `studentOps` authorization before code lookup and existing admin creation for consumption.
3. Verify atomic privileged-ticket consumption, audit integration, Clerk verified-phone gating, and lifecycle cleanup.
4. Preserve the existing attendance and payment workflow unchanged.
