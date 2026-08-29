# Tasks: Special Class Kiosk Check-in

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 360-430 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (shared capacity constant) -> PR 2 (F1 self check-in) -> PR 3 (F2 card walk-in QR) -> PR 4 (F3 cash walk-in) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Extract shared `CAPACITY_STATUSES` (+`cash_pending`) and wire all 4 occupancy sites | PR 1 | `pnpm vitest run tests/lib/special-classes-policy.test.ts` | N/A — pure refactor, covered by existing capacity/reservation unit+integration suites | Revert `lib/special-classes/policy.ts` export and the 4 call-site imports; no behavior change until `cash_pending` is produced (PR 4) |
| 2 | F1 broaden `matchingPurchase` for special-class self check-in by phone | PR 2 | `pnpm vitest run tests/api/checkin-client-phone.test.ts` | Manual: kiosk phone check-in against a seeded special-class Purchase | Revert `client-phone/route.ts` matcher change; regular-class check-in path untouched |
| 3 | F2 kiosk QR points card walk-in at reservation page | PR 3 | `pnpm vitest run tests/front/useCheckInQrController.test.ts` | Manual: scan kiosk QR for special class, confirm it opens `/special-classes/[slug]` and completes Stripe checkout | Revert `useCheckInQrController.ts` branch and `kiosk-qr-payment.ts` helper; falls back to existing `/api/checkout/session` QR path |
| 4 | F3 cash walk-in admission + capacity wiring for `cash_pending` | PR 4 | `pnpm vitest run tests/integration/special-salsa-class-capacity.test.ts` | Manual: staff cash check-in at kiosk terminal against a seeded special class | Revert `admitSpecialClassCashWalkIn` export and the special-class branch in `app/api/checkout/cash/route.ts`; cash route falls back to plain pending Purchase for non-special-class carts |

## Phase 1: Shared Capacity Constant (Foundation)

> **Scope note (applied 2026-08-27)**: Phase 1 was executed as a strictly behavior-neutral refactor — `cash_pending` is intentionally NOT part of `CAPACITY_STATUSES` yet. It is added in Phase 4 (task 4.7+) alongside the admission logic that produces it, per explicit run instruction. The task descriptions below are updated to reflect what was actually implemented; original 5-value wording is superseded.

- [x] 1.1 In `lib/special-classes/policy.ts`, export `CAPACITY_STATUSES = ["paid", "succeeded", "completed", "capture_pending"]` (current values only, no `cash_pending` yet) alongside existing `PAID_STATUSES`/`isCountedSpecialClassPurchase`.
- [x] 1.2 RED test: added assertion in `tests/lib/special-class-policy.test.ts` ("exposes a single shared capacity-status list for every occupancy site") asserting `CAPACITY_STATUSES` equals exactly `["paid","succeeded","completed","capture_pending"]`. (Existing test file is singular `special-class-policy.test.ts`, not the plural filename originally proposed — extended in place instead of creating a duplicate file.)
- [x] 1.3 In `lib/special-classes/fulfillment.ts`, removed local `CAPACITY_STATUSES` (was line 5), now imports the shared one from `policy.ts`; occupancy `count` (lines ~116-122) untouched otherwise.
- [x] 1.4 In `lib/special-classes/management.ts`, removed local `ACTIVE_CAPACITY_STATUSES` (was line 3), now imports shared `CAPACITY_STATUSES` from `policy.ts`; capacity validation (line ~49) behavior unchanged (no `cash_pending` yet).
- [x] 1.5 In `lib/special-classes/read-model.ts`, removed local `PAID_STATUSES` (was line 3), now imports shared `CAPACITY_STATUSES`; `paid` count (line ~18) unchanged (no `cash_pending` yet; `available` at line ~33 derives from `held`+`paid`, also unchanged).
- [x] 1.6 In `lib/checkout/special-class-reservation.ts`, removed local `PAID_STATUSES` (was line 6), now imports shared `CAPACITY_STATUSES`; occupancy counts (lines ~102/114) and the `ALREADY_REGISTERED` check (lines ~83/105) unchanged (no `cash_pending` yet).
- [x] 1.7 Ran `npx vitest run` across all special-class test files (`tests/lib/special-class-policy.test.ts`, `tests/api/staff-special-classes.test.ts`, `tests/integration/special-class-fulfillment.test.ts`, `tests/integration/special-salsa-class-capacity.test.ts`, `tests/lib/special-salsa-class-reservation.test.ts`, `tests/integration/special-class-staff-races.test.ts`, plus the remaining 10 special-class/special-salsa-class suites) — 101/101 tests pass, confirming the refactor is behavior-neutral. `npx tsc --noEmit` is clean.

### Deviation note: fifth duplicate list left untouched

`lib/special-classes/staff-mutations.ts` has `ACTIVE_CANCELLATION_STATUSES = ["paid","succeeded","completed","capture_pending"]` (plus a third inline raw-SQL duplicate of the same literal at the `FOR UPDATE` lock, line ~45) — currently identical values to `CAPACITY_STATUSES`, but a semantically different purpose (selecting purchases to void on staff roster cancellation, not counting occupied seats). It was NOT unified onto the shared constant in Phase 1: it is outside the four named occupancy call sites in this task list, and once `cash_pending` is added in Phase 4 the two lists may need to diverge (e.g. cancellation eligibility for a cash walk-in may follow different rules than occupancy counting). Left as-is per explicit run instruction to avoid forcing a semantically-risky merge; revisit in Phase 4 once `cash_pending` semantics are finalized.

## Phase 2: F1 Self Check-in by Phone

- [x] 2.1 RED test: extended the existing `tests/api/checkin-qr-client-phone.test.ts` route suite (the repository's actual client-phone test filename) with "special-class Purchase without metadata.date is matched by specialClassId" — seeded a `capture_pending` special-class Purchase without `metadata.date` and scheduled Attendance; RED run failed against the prior matcher, then passes after the route change.
- [x] 2.2 RED test: added "cash_pending special-class Purchase is check-in-eligible" in `tests/api/checkin-qr-client-phone.test.ts`; RED run failed before the eligibility change, then passes.
- [x] 2.3 RED test: added "cancelled special class blocks check-in" with a linked scheduled Attendance; RED run returned the generic no-booking response before the lifecycle gate, then passes with the unavailable response and no mutation.
- [x] 2.4 RED test: added the special-class `already_checked_in` idempotency scenario; it confirms the route returns `already_checked_in` without an Attendance create or update.
- [x] 2.5 In `app/api/checkin/qr/client-phone/route.ts`, broadened `matchingPurchase`: after date matching fails, it selects the user Purchase whose `specialClassId` and `classSessionId` match the resolved session; special `capture_pending` and `cash_pending` Purchases are eligible.
- [x] 2.6 In the same route, added a linked SpecialClass lifecycle and canonical-session gate before any Attendance mutation; cancelled and mismatched-session RED tests confirm anything absent, unpublished, cancelled, closed, or mismatched returns the unavailable-style rejected response instead of a 500.
- [x] 2.7 Ran `npx vitest run tests/api/checkin-qr-client-phone.test.ts`: 1 file, 12 tests passed (the complete existing client-phone route suite, including regular check-in and canonical-session regression cases). `npm run typecheck` passed (`tsc --noEmit`).

## Phase 3: F2 Card Walk-in via QR to Reservation Page

- [x] 3.1 RED/GREEN: extended `tests/checkin/kiosk-qr-payment.test.ts` to assert `buildSpecialClassReservationQrUrl(slug)` returns `/special-classes/{slug}` without the checkout-session API; RED failed before the helper existed, then passed.
- [x] 3.2 Added `buildSpecialClassReservationQrUrl` in `lib/checkin/kiosk-qr-payment.ts`; `buildKioskCheckoutQrImageUrl` remains unchanged and reusable for both URL sources.
- [x] 3.3 RED/GREEN: added `tests/checkin/useCheckInQrController.test.ts`, which verifies the special Salsa class selects its reservation URL and a regular course remains eligible for the existing checkout-session path; RED failed before the selector existed, then passed.
- [x] 3.4 In `components/front/checkin/hooks/useCheckInQrController.ts`, branch the Quick Repeat card QR on the configured special-class course to present the reservation URL without creating a checkout session; the regular session-payload flow is unchanged.
- [x] 3.5 Ran `npx vitest run tests/checkin/useCheckInQrController.test.ts tests/checkin/kiosk-qr-payment.test.ts`: 2 files / 49 tests passed. The controller selector returns `null` for regular classes, retaining the existing `sessionPayload` -> `/api/checkout/session` path. `npm run typecheck` passed; targeted ESLint reported 0 errors (9 pre-existing warnings in the controller).

## Phase 4: F3 Cash Walk-in with `cash_pending`

- [x] 4.1 RED/GREEN: added cash admission coverage asserting the `cash_pending` Purchase and `CHECKED_IN` Attendance are created atomically.
- [x] 4.2 RED/GREEN: seeded a 40-seat paid/held/cash-pending mix and verified cash admission returns `SOLD_OUT` without writes.
- [x] 4.3 RED/GREEN: verified a concurrent card hold and cash admission at 39/40 produces exactly one winner.
- [x] 4.4 RED/GREEN: verified a `cash_pending` to `paid` settlement preserves the capacity count and attendance.
- [x] 4.5 RED/GREEN: verified existing checked-in Attendance rejects a duplicate cash admission without another Purchase or Attendance.
- [x] 4.6 RED/GREEN: verified draft and cancelled special classes return `NOT_AVAILABLE`.
- [x] 4.7 Added serializable `admitSpecialClassCashWalkIn` with the shared class-boundary lock, occupancy guard, atomic `cash_pending` Purchase plus `CHECKED_IN` Attendance, and idempotent audit entry.
- [x] 4.8 Routed body-provided `checkoutKind` plus `specialClassId` cash requests through the admission helper; `SOLD_OUT`, `NOT_AVAILABLE`, and duplicate check-in use the existing 409 error-response shape while regular cash checkout remains unchanged.
- [x] 4.9 Passed the focused capacity, policy, and cash-route suite: 3 files / 23 tests; TypeScript typecheck passed and targeted ESLint has zero errors.

## Phase 5: Cross-cutting Verification

- [x] 5.1 Run full suite `pnpm vitest run` to catch regressions across kiosk, checkout, and special-classes domains.
- [ ] 5.2 Manual/E2E smoke: redeployed Special Salsa kiosk QR opens `/special-classes/${SPECIAL_SALSA_CLASS.key}` -> Stripe Checkout -> webhook creates Attendance (per design's Testing Strategy manual pass); record result in the PR description, not in this file. `PublicSpecialClass` preserves its generic reservation UI and reuses the international phone catalog and E.164 normalization contract.
- [x] 5.3 Update `openspec/changes/special-class-kiosk-checkin/design.md` Open Questions checklist once PRODUCT confirms cash-walk-in email policy and no-settlement expiry behavior (no code change if defaults hold).
