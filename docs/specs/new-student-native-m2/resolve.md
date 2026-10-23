# Resolve - new-student-native-m2

## Status
RESOLVED (owner decisions 2026-10-23). Implementation blocked until the concurrent kiosk QR/booking work lands.

## Decisions
| OQ | Decision |
|---|---|
| OQ1 | A - New terminal-authenticated endpoint mints a kiosk session for the new student only after the server re-reads Clerk and confirms the submitted phone is verified on the just-prepared user, the DB user matches, and there is no prior successful purchase. SMS stays mandatory: no verified code, no session, no M2 charge. |
| OQ2 | A - Same as existing customers: 15 min sliding, one per terminal; distinct credentialKind (e.g. "new_student_sms") for audit. |
| OQ3 | A - Keep account creation before SMS (Clerk phone_code requirement). Abandoned-student re-entry handled in a separate spec later. |
| OQ4 | A - After a decline the student stays on payment and may retry card or switch to cash in the same session. |
| OQ5 | A - No receipt for now (matches existing M2). Receipt-only email deferred. |
| OQ6 | Changed by owner: uncharged / declined / failed attempts must NOT be hidden. They are visible with status and reason for a 24 h window, then remain in the student's payment history. Delivered by a separate cross-flow spec: docs/specs/payment-attempt-visibility/requirements.md. This feature must record each native attempt outcome so that spec can display it. |
| OQ7 | A - Reader unavailable: error + cash; no automatic QR inside the app; QR untouched. |
| OQ8 | A - PIN creation out of scope. |
| OQ9 | A - First-class eligibility rules unchanged. |

## Contract notes
- Reuse prepared context, native_m2_prepare, webhook fulfillment and native-attempt-state unchanged; only add the SMS-backed session mint and pass its token into the open EnrollModal.
- In the kiosk-session preparation branch, compute the verified-phone snapshot from Clerk (server-side) so enforceNewStudentRules sees the real verification state.
- Price parity with the displayed first-class price is mandatory (server authoritative).
