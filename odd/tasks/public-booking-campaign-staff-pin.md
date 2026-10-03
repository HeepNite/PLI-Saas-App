# Public Booking Campaign and Staff Pin Recovery

## Goal

Restore the five-second campaign promotion on every `/booking` visit, keep new public booking contact fields independent from an ambient Clerk session, preserve the submitted booking name in paid purchases, and expose pending Heritage pins with a delivery action on payment-backed staff cards.

## Tasks

- [x] Show the campaign promotion after five seconds on every booking-page visit.
- [x] Prevent ambient Clerk contact prefill in the public booking flow.
- [x] Prefer the submitted booking name over Stripe cardholder data.
- [x] Surface Heritage pin status and delivery on payment-backed staff cards.
- [x] Update the active requirements and focused regressions.
- [ ] Run focused verification, native review, and delivery.

## Evidence

- Live purchase for phone `0101` is paid for US$15 and contains a pending Argentina Heritage pin.
- The webhook persisted `Purchase.name = Nee saw` because checkout `customer_details.name` currently precedes `metadata.name`; the user and booking metadata say `Ga Barri`.
- The staff screenshot renders `PaymentStudentCard`; Heritage pin presentation and delivery currently exist only in `ProfileStudentCard`.
- The timed promotion currently waits 10 seconds and is suppressed by a session-storage marker after its first display.
- Public QR booking currently hydrates blank contact fields from the ambient Clerk user.
- Popup timer regression: 8 focused tests passed; `git diff --check` passed.
- Public-contact regression: 9 focused tests, typecheck, and `git diff --check` passed.
- Booking-name regression: 27 webhook tests and `git diff --check` passed.
- Staff-pin regression: 20 focused tests, typecheck, and `git diff --check` passed.
- Requirements now define the five-second per-visit popup, blank public contact form, submitted-name priority, and staff-card-independent pin fulfillment.
