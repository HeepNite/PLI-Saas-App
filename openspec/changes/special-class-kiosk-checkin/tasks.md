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

- [ ] 2.1 RED test: add `tests/api/checkin-client-phone.test.ts` scenario "special-class Purchase without metadata.date is matched by specialClassId" — seed a special-class Purchase (`status: capture_pending`, no `metadata.date`) and scheduled Attendance, call the route, assert it flips to checked-in. Must fail against current matcher.
- [ ] 2.2 RED test: add scenario "cash_pending special-class Purchase is check-in-eligible" in the same file — seed `status: cash_pending`, assert check-in succeeds.
- [ ] 2.3 RED test: add scenario "cancelled/unpublished special class blocks check-in" — seed Purchase/Attendance tied to a `cancelled` or `unpublished` SpecialClass, assert no check-in and a not-available/unavailable response, no crash.
- [ ] 2.4 RED test: add scenario "already checked-in is idempotent" for a special-class Attendance already `checked_in` — assert no duplicate mutation and an already-checked-in style response.
- [ ] 2.5 In `app/api/checkin/qr/client-phone/route.ts`, broaden `matchingPurchase` (~lines 138-150): when no Purchase matches by `metadata.date`, fall back to selecting a special-class Purchase for the resolved session by `specialClassId`/`classSessionId`, and treat `matchingPurchase.status === "cash_pending"` as check-in-eligible alongside `SUCCESSFUL_PURCHASE_STATUSES`.
- [ ] 2.6 In the same route, gate on the linked SpecialClass's lifecycle status (cancelled/unpublished) before flipping Attendance, returning the existing not-found/unavailable-style error path instead of a 500.
- [ ] 2.7 Run `pnpm vitest run tests/api/checkin-client-phone.test.ts` and confirm all four new scenarios pass; run full `client-phone` suite to confirm no regression on regular-class check-in.

## Phase 3: F2 Card Walk-in via QR to Reservation Page

- [ ] 3.1 RED test: add `tests/lib/kiosk-qr-payment.test.ts` (or extend existing) asserting a new helper (e.g. `buildSpecialClassReservationQrUrl(slug)`) returns `/special-classes/{slug}` and does not call `/api/checkout/session`.
- [ ] 3.2 In `lib/checkin/kiosk-qr-payment.ts`, add the helper that returns the special-class reservation-page URL for a given slug; keep the existing QR image builder (`buildKioskCheckoutQrImageUrl`) unchanged and reusable for both URL sources.
- [ ] 3.3 RED test: extend `components/front/checkin/hooks/__tests__` (or create `tests/front/useCheckInQrController.test.ts`) asserting that for a special-class session the controller builds the QR from the reservation URL, not from `sessionPayload` -> `/api/checkout/session` (~lines 531-556).
- [ ] 3.4 In `components/front/checkin/hooks/useCheckInQrController.ts`, branch on special-class session context to call the new reservation-URL helper instead of building `sessionPayload` and calling `requestCheckoutSessionApi`.
- [ ] 3.5 Run `pnpm vitest run tests/front/useCheckInQrController.test.ts tests/lib/kiosk-qr-payment.test.ts` and confirm regular-class kiosk QR path (existing `/api/checkout/session` flow) is unchanged.

## Phase 4: F3 Cash Walk-in with `cash_pending`

- [ ] 4.1 RED test: extend `tests/integration/special-salsa-class-capacity.test.ts` (create if absent) — "cash walk-in is checked in immediately, Purchase stays cash_pending" — call `admitSpecialClassCashWalkIn`, assert Purchase status `cash_pending` and Attendance `CHECKED_IN` created together.
- [ ] 4.2 RED test: same file — "sold out cash walk-in rejected, no oversell" — seed 40/40 occupied (mixing paid/held/cash_pending), assert `admitSpecialClassCashWalkIn` returns `{ code: "SOLD_OUT" }` and creates nothing.
- [ ] 4.3 RED test: same file — "concurrent card hold and cash check-in at last seat: only one wins" — run `admitSpecialClassReservation` and `admitSpecialClassCashWalkIn` concurrently at 39/40, assert exactly one succeeds.
- [ ] 4.4 RED test: same file — "settling cash_pending to paid does not change occupied count" — assert capacity count before/after the status transition is identical.
- [ ] 4.5 RED test: same file — "duplicate cash check-in for an already checked-in person is rejected" — seed existing checked-in Attendance (any funding state), assert no second Purchase/Attendance created.
- [ ] 4.6 RED test: same file — "cancelled/unpublished special class rejects cash admission" — assert `{ code: "NOT_AVAILABLE" }`.
- [ ] 4.7 In `lib/special-classes/fulfillment.ts`, add `admitSpecialClassCashWalkIn(db, input)`: serializable transaction using `lockSpecialClassBoundary` + `FOR UPDATE` (mirroring `admitSpecialClassAuthorization`), under-cap check against shared `CAPACITY_STATUSES`, create Purchase `status: "cash_pending"` + Attendance `CHECKED_IN` atomically, audit-log entry keyed `${eventId}:cash_walk_in`.
- [ ] 4.8 In `app/api/checkout/cash/route.ts`, detect special-class context in the body (`checkoutKind`/`specialClassId`) and route to `admitSpecialClassCashWalkIn` instead of the plain pending-Purchase create (~lines 301-348); map `SOLD_OUT`/`NOT_AVAILABLE` to the existing error-response shape.
- [ ] 4.9 Run `pnpm vitest run tests/integration/special-salsa-class-capacity.test.ts` and confirm all Phase 4 scenarios pass; re-run Phase 1 policy test to confirm `cash_pending` behaves identically across all 4 occupancy sites end-to-end.

## Phase 5: Cross-cutting Verification

- [ ] 5.1 Run full suite `pnpm vitest run` to catch regressions across kiosk, checkout, and special-classes domains.
- [ ] 5.2 Manual/E2E smoke: F2 kiosk QR opens reservation page -> Stripe Checkout -> webhook creates Attendance (per design's Testing Strategy manual pass); record result in the PR description, not in this file.
- [ ] 5.3 Update `openspec/changes/special-class-kiosk-checkin/design.md` Open Questions checklist once PRODUCT confirms cash-walk-in email policy and no-settlement expiry behavior (no code change if defaults hold).
