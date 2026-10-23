# Requirements - payment-attempt-visibility

## Status
DRAFT (owner direction 2026-10-23). Needs analysis.md before implementation.

## Objective
No payment attempt is hidden. Every card (native M2, embedded, QR) and cash process is visible with its status and, when it did not succeed, the reason.

## Owner rules
- Never hide money rows: pending, unpaid, declined, failed, cancelled, or never-charged attempts stay visible.
- Applies to all flows and all customers (new and existing), not only new students.

## Requirements
R1 24 h visibility window
- Given a payment attempt that did not complete (declined, reader no response, cancelled, timed out, prepared but never charged)
- When staff view today's payments / board within 24 h of the attempt
- Then the attempt appears with its status and a human-readable reason (e.g. "Card declined", "Reader did not respond", "Cancelled by customer", "Prepared, not charged").

R2 General payment history shows every process
- Given any purchase or attempt for a student
- When staff open the payment history
- Then paid, pending, unpaid, declined and failed processes are all listed with status and reason; nothing is filtered out silently.

R3 Student-level history (later phase)
- Given a student
- When staff open Edit client -> Edit info
- Then a history of that student's processes (charges, declines, failures, pendings) is shown, including attempts older than 24 h.

R4 Reason capture
- Native M2 / Stripe: record decline/failure reason from the provider outcome (e.g. PaymentIntent last_payment_error code/message, Terminal collection outcome) and the coarse kiosk outcome (reader unavailable, timeout, cancelled).
- No PII or card data in reasons; coarse codes plus a staff-readable label.

## Known current behavior to change
- app/api/staff/payments/shared.ts:268-276 excludes uncharged native_m2_prepare purchases from the outstanding balance.
- Stripe webhook acknowledges payment_intent.payment_failed / canceled for the native flow as no-ops without recording a reason.

## Decisions
- D5 (owner, 2026-10-23, refines D3 "existing pills stay"): every CARD process that did not charge belongs ONLY in Verify. "Pending" (summary pill and Status filter) is cash-only: money the student has not handed over yet. Rationale: a card payment is automatic when it works, so an uncharged card always means a problem to verify, never a pending. Unresolved verify rows, and dismissed or collected ones, never appear under Pending; a collected row counts as paid cash. Cash pending behavior is unchanged.
- D4 (owner, 2026-10-23): Verify items are resolved MANUALLY only, so staff always reviews what happened. No auto-resolution, even if the student later pays the same class (the later payment is shown in the History as context). Staff actions: "Collected" (charged at the desk, e.g. cash -> becomes paid) or "Dismiss" (e.g. class not taken), each recording who resolved it, when, and a short reason. Unresolved items leave the daily panel after 24 h but stay in the Verify pill/filter and in History until resolved.
- D3 (owner, 2026-10-23, refines D1/D2 — UI contract):
  - Every card process that did not charge (any channel: kiosk M2, app/web card, kiosk QR, Stripe Checkout; declined, failed, expired, cancelled, never charged) enters a new "Verify" state. It is NOT outstanding balance (debt stays = pending cash), but it is never hidden: the amount that should have been charged is shown in YELLOW (debt stays red).
  - Daily student panel (today board): for 24 h after the failed process, the student card shows "Verify" in yellow with the amount, in the same place/manner the outstanding balance is shown today.
  - Payments "Status" filter next to the search box gets a "Verify" option listing all verify activity (not limited to 24 h).
  - Top summary pills: add a new "Verify" pill next to "Pending" (count/amount of verify items, yellow). Existing pills (pending, paid, classes with check-in, total revenue) stay as they are.
  - The card's payment History shows the full timeline of that payment: each attempt, when, channel, and reason.
- D2 (owner, 2026-10-23, supersedes the earlier "failed/expired card attempts stay visible as debt" rule): every card attempt that did not charge — never charged (reader no response), declined, failed, expired QR/Checkout, cancelled — is visible with status and reason and does NOT count as debt. Only pending cash counts as debt.
- D1 (owner, 2026-10-23): a never-charged attempt (e.g. reader did not respond, no card presented) is shown with its status and reason labeled "Attempt, no charge" and does NOT count toward the student's outstanding balance. Declined/failed card attempts follow the same rule (visible, not debt); pending cash keeps its existing debt behavior.

## Open questions
- Retention of reason details beyond the student history.
