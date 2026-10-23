# Requirements - new-student-native-m2

## Status
DRAFT - blocked on open questions. See analysis.md.

## Objective
A new student on the kiosk inside the Android PLI app can pay the first class (or a selected package) by card on the Stripe Reader M2, with the same server-authoritative price, fulfillment, and reconciliation as existing customers.

## Scope
In: kiosk "I am new" on /staff/terminal in the Android app with native bridge; card via M2; reuse of prepared context, native_m2_prepare, webhook fulfillment, native-attempt-state.
Out: QR code/flow changes (concurrent booking work); public booking; /checkin; staff SMS recovery; schema changes unless resolve.md proves necessity; native app (Kotlin) changes.

## Invariants (owner rules, MUST keep)
- I1 SMS verification is mandatory; no path may mint a session or apply new-student price without server-verified phone ownership.
- I2 Kiosk in-studio cash remains available for new students.
- I3 Failed card attempts and pending cash stay visible as debt per owner rule (see OQ6).
- I4 Charged amount equals the displayed first-class price (admin-configured; #728 helper); server is authoritative.
- I5 Terminal auth, staff-identity isolation, rate limits, eligibility checks unchanged or stricter.

## Functional requirements and acceptance criteria
R1 Card on M2 for verified new student
- Given a new student completed SMS verification on the kiosk in the Android app with the reader bridge available
- When they select card and confirm
- Then the M2 is prompted for exactly the server-computed amount, and on PAID the purchase is paid, attendance/package synced, and the kiosk shows success then resets.

R2 No M2 without SMS
- Given verification is not completed (or Clerk phone not verified server-side)
- When card is confirmed
- Then no kiosk session is minted, no native purchase is prepared, and the student sees a verification-required message; cash/regular-price fallback follows existing behavior.

R3 Price parity
- Given a course whose new-student price (and any active promotion) is configured in admin
- When the student pays on M2
- Then the charged amount equals the price displayed in the payments step and equals what embedded/cash would charge for the same selection.

R4 Eligibility enforced
- Given the phone/email/Clerk id already has a successful purchase
- When the student reaches payment
- Then new-student price is refused (NEW_STUDENT_ALREADY) and existing regular-price fallback popup applies.

R5 Declined / unresolved payment
- Given the M2 declines or never reports PAID
- When the attempt ends
- Then a visible error is shown, nothing is auto-retried, the account remains, and behavior follows OQ4/OQ6.

R6 Reader unavailable
- Given the app WebView lacks the bridge
- When card is selected
- Then behavior follows OQ7; cash stays available.

R7 Session isolation
- Given a new-student kiosk session exists
- When another student identifies on the same terminal, the session expires, or the flow completes
- Then the new-student session cannot be used to prepare or reconcile another purchase.

R8 Reconciliation
- Given a native attempt for a new student
- When the app queries native attempt state
- Then it returns the same coarse states as for existing customers using the new-student session.

R9 Telemetry
- Native-preparation logs keep the allowlisted coarse reason codes; no identifiers.

## Open questions (most blocking first)
OQ1 Proof required to mint a kiosk session for a new student
- A) New terminal-authenticated endpoint that re-reads Clerk server-side and mints only if the submitted phone is verified on the user just prepared, no prior successful purchase, and the DB user matches.
- B) Reuse /api/checkin/phone/identify (mints by phone alone; works only because the DB user already exists).
- C) Bind to the non-activated Clerk sign-in session id from EmbeddedSignIn and verify it server-side.
- Recommendation: A (B does not tie minting to SMS; C adds Clerk session coupling).

OQ2 Kiosk session TTL and scope
- A) Same as existing customers: 15 min sliding, one per terminal, credentialKind "new_student_sms".
- B) Shorter (5 min) and single-class.
- C) Checkout-only (no check-in/package endpoints).
- Recommendation: A, with a distinct credentialKind for audit.

OQ3 Account creation timing and abandoned accounts
- A) Keep creation before SMS (required by Clerk phone_code); accept that abandoned students are treated as existing.
- B) Keep timing; let verify treat "no successful purchase + unverified phone" as eligible to re-enter new-student flow.
- C) Periodic staff/automatic cleanup of unverified, purchase-less accounts.
- Recommendation: A for this feature; B as separate spec.

OQ4 Account after failed/abandoned payment
- A) Keep account; student may retry card or switch to cash in the same session.
- B) Keep account; force front-desk handoff.
- C) Keep account; retry only via cash.
- Recommendation: A.

OQ5 Receipt / email
- A) No receipt (matches existing M2; native PI requires receipt_email null).
- B) Send PLI booking confirmation email after webhook fulfillment.
- C) Wait for native-kiosk-m2-self-service optional receipt-only email.
- Recommendation: A now; C later.

OQ6 Visibility of uncharged native preparations
- Current: pending native_m2_prepare Purchase without PaymentIntent is excluded from outstanding balance (app/api/staff/payments/shared.ts:268-276).
- A) Confirm it is not debt (no charge attempted on card) and keep exclusion.
- B) Show as debt.
- C) Show in audit/history only.
- Recommendation: A, explicit owner confirmation required.

OQ7 Reader unavailable fallback
- A) Keep current: error + cash; no auto QR inside app.
- B) Auto-fallback to kiosk QR (depends on in-flight QR work).
- C) Staff-assisted screen.
- Recommendation: A.

OQ8 PIN creation in flow
- A) Out of scope (no path enrolls PIN today; enrollStudentPinForCheckout unused).
- B) Optional PIN step after PAID.
- C) Mandatory PIN before payment.
- Recommendation: A.

OQ9 First-class price eligibility
- A) Unchanged rules (1 participant, verified phone, no prior successful purchase).
- B) Also block if a pending cash first-class exists.
- Recommendation: A.

## Dependencies
- Concurrent QR/booking work must land first; no QR edits here.
- kiosk-international-phone-support may change phone gating.
- native-m2-live-preparation contracts (W3p10/W3p11) are reused unchanged.
