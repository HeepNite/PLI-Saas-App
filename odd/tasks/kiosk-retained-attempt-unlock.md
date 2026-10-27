# Kiosk retained attempt unlock

## Objective

After a native M2 card sale ends not paid, the kiosk frees itself for the next sale when the server confirms the PaymentIntent was not charged, and stays locked for anything ambiguous.

## Problem

Production Samsung, release 1.1.0, 2026-10-27: after a sale ended not paid (90 s collection timeout, decline, cancel, reader disconnect), the next sale failed immediately ("The card reader did not respond"). `PurchaseCoordinator.startPrepared` requires no retained attempt, and the attempt was cleared only on server `Paid` (bridge workflow) or `Paid`/`UNCREATED` (startup rollover). The only workaround was `pm clear` plus re-login.

## Why / owner decision (2026-10-27)

"If the server confirms the payment was not charged, the kiosk cancels that PaymentIntent in Stripe and frees itself; if anything is ambiguous (processing, server unreachable, unknown), it stays locked. Never risk a double charge. The failed attempt stays visible as yellow Verify on the staff board."

Recorded in `docs/specs/native-m2-live-preparation/resolve.md` ("Resolved confirmed-not-charged unlock") and `requirements.md` (W3p30).

## Scope / constraints

- No new route: closed action `prepared-cancel` on `/api/kiosk/terminal/internal-purchase`, same auth, rate limit, rejection-log allowlist and exact-bound checks as `prepared-recover`.
- Purchase/Verify state stays owned by the existing `payment_intent.canceled` webhook; no duplicated recording or fulfillment.
- Web bridge contract unchanged (`PENDING` -> `REJECTED`/`PAID`).
- TDD: strict (owner request). Runners: `npx vitest run`, `./gradlew :androidApp:testDebugUnitTest`.

## Tasks

- [x] T1 Server `prepared-cancel` (parser, route allowlist, service). Cancel only from `requires_payment_method` / `requires_confirmation` / `requires_action`, idempotency key `prepared-native-m2-cancel:v1:<pi>`; `succeeded` -> paid; `processing` / `requires_capture` / other -> pending. Route: inline (3 small files + 1 test). Commit `549d0472`.
- [x] T2 Android: `PreparedPurchaseApi.preparedCancel`, `PurchaseCoordinator.cancelUnpaidPreparedAttempt` (clear only on `canceled`, persist + read back), bridge workflow settles not-paid terminal states before publishing, startup rollover cancels after a not-paid recovery. Route: inline (writer). Commit `2609793c`.
- [x] T3 Spec + this feature document. Route: inline.

## Acceptance criteria

- Timeout / decline / reader disconnect with server `canceled` -> attempt cleared durably, next sale starts.
- Server `pending` or error -> attempt retained, next sale rejected.
- Server `paid` -> existing paid rollover.
- Startup rollover with server `canceled` -> cleared and reload requested.
- Server rejects mismatched / unbound / foreign attempts before any provider call; no client secret returned.

## Verification evidence

- RED server: 14 new vitest cases failed (`Invalid internal-purchase payload`) before implementation; GREEN: `tests/api/kiosk-internal-purchase.test.ts` 130/130.
- RED Android: compile failure, then 9 behavioural failures with stubbed interface; GREEN: 274/274 `testDebugUnitTest`.
- `npx vitest run tests/`: 3318 passed, 5 skipped; only `tests/integration/prisma-security.test.ts` fails (missing `DATABASE_URL`, also fails on base).
- `npx tsc --noEmit`: pass. `npm run lint`: 0 errors (existing warnings only).

## Known limitation / follow-ups

- If the web re-prepares before the `payment_intent.canceled` webhook is processed, the reused Purchase still holds the canceled PaymentIntent and that single retry is rejected; the webhook then reopens it normally.
- A ticket-only attempt (no PaymentIntent) rejected mid-sale is still cleared only by the startup `UNCREATED` path (unchanged).

## Next step

Owner review; push/PR and APK release remain owner decisions.
