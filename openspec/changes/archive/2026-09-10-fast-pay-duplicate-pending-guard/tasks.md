# Tasks: Fast Pay duplicate pending guard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 330-405 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (resolver + pre-check + main POST) → PR 2 (`createPromoCash`), stacked on PR 1 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Slot resolver, `isSettledPurchase`, pre-check, main `POST` reuse/block/create | PR 1 (base `main`) | `npx vitest run tests/api/staff-fast-class-action.test.ts` | N/A — route unit tests exercise the transaction path directly; no live server needed | Revert PR 1: resolver + `resolveExistingClassPurchaseBlock` + `POST` purchase block, plus its test cases |
| 2 | `createPromoCash` reuse/block/create wired to the shared resolver | PR 2 (base PR 1 branch; retarget to `main` after PR 1 merges) | `npx vitest run tests/api/staff-fast-class-action.test.ts` | N/A, same reason | Revert PR 2 only: `createPromoCash` purchase block + its test cases |

## Phase 1: Shared Slot Resolver (Work Unit 1)

- [x] 1.1 RED: migrate every `purchase.findFirst` mock (`mockPrisma`, `mockTx`) in `tests/api/staff-fast-class-action.test.ts` to `findMany` fixtures returning arrays with a `status` field; add `mockTx.purchase.update = vi.fn()`.
- [x] 1.2 GREEN: in `app/api/staff/students/fast-class-action/route.ts`, import `PURCHASE_STATUS`, `SETTLEMENT_STATUS` from `@/lib/payment-constants` and `isCompletedPaymentStatus`, `normalizeSettlementStatus`, `isPendingProcessablePurchase` from the payments shared module; add `IGNORED_PURCHASE_STATUSES`, `ClassSlot`, `SLOT_PURCHASE_SELECT`, `buildSlotPurchaseWhere`, `isSettledPurchase`, `resolveSlotPurchase`, and the `COMPLETED_PURCHASE_ERROR` abort-sentinel constant, per design. (Deviation: `isCompletedPaymentStatus`/`normalizeSettlementStatus` actually live in `@/app/api/staff/payments/shared`, not `@/lib/payment-constants` — task wording was imprecise; implemented per the actual module locations and design's Dependencies section.)
- [x] 1.3 Verify: `npx tsc --noEmit` clean (new helpers compile; not yet wired to callers).

## Phase 2: Main POST Path — Block, Reuse, Create (Work Unit 1)

- [x] 2.1 RED: add cases — Stripe-paid row blocks under `previewOnly` (no `$transaction` call); `package_credit`-paid row blocks; cash-pending row with `metadata.settlementStatus:"paid"` blocks. All expect 409 `completed_purchase`.
- [x] 2.2 GREEN: rewrite `resolveExistingClassPurchaseBlock` to drop its session/attendance lookup and call `resolveSlotPurchase(prisma, { userId, courseSlug: currentClass.slug, date: currentClass.date, time: currentClass.time })`; block only when settled; remove the `pending_payment` branch and `PENDING_PAYMENT_MESSAGE`.
- [x] 2.3 RED: add cases — web-cash-pending reuse with `attendanceId` backfill via `purchase.update`; pending row already carrying the correct `attendanceId` (no `update` call); card-pending row ignored (new purchase created); rewrite the old "blocks on pending purchase" case to assert reuse instead of `pending_payment`. (Deviation: a standalone "refunded/expired row present but ignored" case was folded into the where-clause assertion test — JS-level mocks can't observe DB-level `notIn` filtering, so the only honest proof of exclusion is asserting the query shape; see 2.6.)
- [x] 2.4 GREEN: in `POST`'s transaction, replace the `tx.purchase.findFirst` lookup with `resolveSlotPurchase(tx, slot)`; on settled, `throw new Error(COMPLETED_PURCHASE_ERROR)`; on a reusable match, backfill `metadata.attendanceId` via `tx.purchase.update` only when absent and return the existing purchase; otherwise `tx.purchase.create` as today.
- [x] 2.5 GREEN: wrap `POST`'s call to `runSerializableTransaction` in try/catch mapping `COMPLETED_PURCHASE_ERROR` to a 409 `completed_purchase` response; rethrow any other error.
- [x] 2.6 RED: add a `findMany` where-clause assertion (`status: { notIn: ["failed","refunded","expired"] }` plus the date/time-or-`attendanceId` `OR`) and a mid-transaction-race case where the row is paid only in `mockTx.purchase.findMany` (409, no `purchase.create`, transaction rolled back).
- [x] 2.7 Verify: `npx vitest run tests/api/staff-fast-class-action.test.ts` green for Phase 1-2 cases; `npx tsc --noEmit` clean.

## Phase 3: `createPromoCash` Path (Work Unit 2)

- [x] 3.1 RED: add promo cases — linked-slot cash-pending row reused (no create); linked-slot paid row blocks with 409 `completed_purchase` forwarded by `POST`; linked-slot card-pending row ignored (new promo purchase created).
- [x] 3.2 GREEN: in `createPromoCash`'s transaction, replace the `tx.purchase.findFirst` lookup with `resolveSlotPurchase(tx, slot)`; on settled, return `{ error: COMPLETED_PURCHASE_MESSAGE, status: 409 as const, code: "completed_purchase" }`; on a reusable match, backfill `attendanceId` via `tx.purchase.update` when absent; otherwise `tx.purchase.create` as today.
- [x] 3.3 GREEN: confirm `POST`'s promo-result branch forwards `code` from `createPromoCash`'s error result in its `NextResponse.json` body.
- [x] 3.4 Verify: `npx vitest run tests/api/staff-fast-class-action.test.ts` full suite green; `npx tsc --noEmit` clean.

## Phase 4: Delivery

- [x] 4.1 Commit Work Unit 1 on `fix/fast-pay-duplicate-pending-guard` (base `main`) as one conventional commit; no AI attribution. (Committed: sha256 `577af43`)
- [x] 4.2 Open PR 1 (`fix/fast-pay-duplicate-pending-guard` → `main`); confirm the diff has no openspec files. (PR #444 open)
- [x] 4.3 Branch `fix/fast-pay-duplicate-pending-guard-promo` off `fix/fast-pay-duplicate-pending-guard`; commit Work Unit 2 as one conventional commit; no AI attribution. (Committed: sha256 `21144c6`)
- [x] 4.4 Open PR 2 (`fix/fast-pay-duplicate-pending-guard-promo` → `fix/fast-pay-duplicate-pending-guard`); after PR 1 merges, retarget PR 2's base to `main`. (PR #445 open, targets PR #444 branch)
- [ ] 4.5 After both PRs merge to `main`, open a propagation PR to `codex/develop` carrying the combined `route.ts`/test change plus `openspec/changes/fast-pay-duplicate-pending-guard/` (per `openspec/config.yaml` `persistence.target_branch`). **PENDING**: Will be done by the orchestrator right after archive closes.
- [ ] 4.6 Verify on `codex/develop`: `npx vitest run tests/api/staff-fast-class-action.test.ts` and `npx tsc --noEmit` green after the propagation PR applies. **BLOCKED**: Depends on 4.5 completion.
