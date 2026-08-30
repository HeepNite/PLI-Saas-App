# Proposal: Special Class Kiosk Check-in

## Intent

Special Classes have a kiosk QR but do not fully behave like regular classes. Two everyday flows fail at the tablet: an online buyer entering their phone should self-check-in, and a walk-in should buy on the spot by cash or card and be admitted. Closing this makes the special-class kiosk operationally equivalent to a regular class, reusing existing machinery, without waiting on the separate tap-to-pay project.

## Scope

### In Scope
- **F1 Self check-in**: phone-identify check-in selects the special-class Attendance/Purchase and marks the buyer checked-in.
- **F2 Card reservation (QR→Hosted Checkout)**: kiosk QR opens the public reservation page; Stripe webhook creates a paid Purchase plus `SCHEDULED` Attendance, and F1 phone self-check-in is the only transition to `CHECKED_IN`.
- **F3 Cash walk-in**: link special class, create checked-in Attendance immediately, and make capacity counting include the occupied pending-cash seat. Purchase stays `pending` for staff settlement.

### Out of Scope / Non-Goals
- Tap-to-pay / physical card readers (separate, not-ready project).
- Refunds, cancellations, multi-attendee/group purchases at kiosk.
- Changing regular-class flows or the online special-class purchase path.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `special-classes`: kiosk cash walk-ins occupy capacity immediately as checked-in pending-cash seats; capacity counting includes them.
- `kiosk-checkin`: kiosk supports special-class self check-in and special-class card/cash walk-in purchase.

## Approach

Reuse-first — the canonical `ClassSession` already unifies special and regular classes.
- **F1**: verify `app/api/checkin/qr/client-phone/route.ts` resolves the special-class Attendance (via `userId_sessionId`, already created by `admitSpecialClassAuthorization` at Stripe authorization); fix Purchase selection if the special-class purchase is missed.
- **F3**: in `app/api/checkout/cash/route.ts:301-348` set `specialClassId`/`classSessionId`, create checked-in Attendance on the spot, and extend capacity counting in `lib/special-classes/fulfillment.ts` (`CAPACITY_STATUSES` line 5 / the `OR` at line 120) to count the pending-cash seat.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/api/checkin/qr/client-phone/route.ts` | Modified | Ensure special-class Purchase/Attendance selection (F1) |
| `components/front/checkin/hooks/useCheckInQrController.ts` | Modified | Point the special-class kiosk QR at the public reservation page (F2) |
| `app/api/checkout/cash/route.ts` | Modified | Link class, create Attendance, mark pending-cash (F3) |
| `lib/special-classes/fulfillment.ts` | Modified | Count pending-cash seat in capacity (F3) |

## Business Rules

- Capacity cap (40) must never oversell; pending-cash occupied seats count toward capacity.
- Cash Purchase stays `pending`; staff settle later (money reconciliation is a separate step).
- Card walk-in reuses generic QR→Stripe Hosted Checkout; no tap-to-pay dependency.
- Promo/consecutive pricing reuses existing kiosk pricing rules.
- Identity/email for walk-ins must satisfy the special-class checkout's `attemptId`/email requirements without blocking a no-email walk-in (design decision).

## Edge Cases

- Sold out at kiosk: reject purchase/check-in with a clear message.
- Hold expiry during QR card payment: expired hold must not admit.
- Duplicate check-in / double-tap: idempotent by `userId_sessionId`.
- Cancelled/unpublished special class: excluded from kiosk actions.
- Walk-in without email: resolve identity without a real email while keeping receipts/audit valid.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Oversell if pending-cash not counted correctly | Med | Design exact capacity-count change; transactional check under cap |
| Regression on just-shipped special-class payment path | Med | Reuse existing handlers; add tests; small diffs |
| Money/settlement mismatch (cash pending vs. attended) | Med | Keep settlement a distinct staff step; audit trail on Attendance |
| Walk-in email/identity hack weakens data quality | Low | Explicit identity resolution rule decided in design |

## Rollback Plan

Changes are additive branches on existing routes; revert the F1/F2/F3 commits (feature branch) to restore prior kiosk behavior. No schema migration required if capacity uses existing Purchase/Attendance status; a migration, if introduced in design, must be separately reversible.

## Dependencies

- Existing special-class fulfillment, `/api/checkout/session`, `/api/checkout/cash`, Stripe webhook.
- No tap-to-pay.

## Success Criteria

- [ ] Online buyer checks in via phone at the special-class kiosk.
- [ ] Card buyer completes purchase via QR; webhook creates a paid Purchase plus `SCHEDULED` Attendance, then F1 phone self-check-in transitions it to `CHECKED_IN` idempotently.
- [ ] Cash walk-in is checked in immediately; Purchase stays pending for staff settlement.
- [ ] Special-class capacity (40) never oversells across paid/pending-cash/held seats.

## Open Questions (for design)

1. Walk-in email/`attemptId`: synthesize a placeholder identity, prompt for email, or relax the requirement for kiosk-terminal context?
2. Exact capacity-count change for pending-cash: add a status to `CAPACITY_STATUSES`, or give pending-cash a live `holdExpiresAt`, or count checked-in Attendance directly?
3. Does cash walk-in need its own `holdExpiresAt`/expiry semantics, or is the created Attendance the source of truth?
