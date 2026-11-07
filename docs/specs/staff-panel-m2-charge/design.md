# Design - Staff Panel Charge Collected On A Tablet M2 Reader

Phase 1 (this PR): item kinds `package`, `guest_class`, `outstanding`, `free_amount`. Phase 2:
D1 drop-in credits. Code: `lib/terminal-charges/`.

- Tables `StaffTerminalCharge` + `StaffTerminalChargeItem` (`prisma/schema.prisma`).
- Panel: "Charge on tablet" on the student payment card → pick tablet, pending rows, a package
  for the student or a guest class (course + optional friend name), optional free amount +
  description. Package/guest-class prices come from `getCatalogCourseBySlug` +
  `validateCheckoutPayload` (guest class = drop-in); only the free amount carries a client amount.
  Status polled, cancellable (D5).
- Lifecycle: `pending` → tablet `prepare` → `collecting` → webhook `paid`; tablet `declined`;
  panel/tablet `cancelled`; `pending` past 10 min → `expired` (lazy). One active charge per tablet.
- Prepare creates one carrier Purchase through the existing native prepared-purchase pipeline;
  the tablet hands the reference to the unchanged native bridge.
- Cancel while collecting cancels the bound PaymentIntent only when Stripe guarantees no charge
  (same statuses and idempotency key as the tablet's prepared-cancel); otherwise 409.
- Webhook: a paid carrier fans out per item in one transaction (idempotent). Outstanding rows
  settle in place like `mark_paid` (channel card) and replay `applyCashSettlementSideEffects`
  after commit; attendance debts get a paid child; free amounts get a revenue-only child (D7).
  A package gets a paid child for its beneficiary plus `syncPackagePurchaseFromPaidPurchase`;
  a guest class gets a paid child under the payer (`guestItem`, `guestName`), with no account,
  attendance or package (D2). Unknown or malformed items fail closed.
- Carriers (course slug `staff-terminal-charge`) are excluded from board, report and listings.
- Tablet: `StaffTerminalShell` polls every 3 s; full-screen takeover (D6); returns home after.
