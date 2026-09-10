# Apply Progress: Fast Pay duplicate pending guard

## Status: Phases 1-3 complete (implementation done). Phase 4 (delivery) is explicitly out of scope for this apply batch — parent orchestrator handles PRs, delivery, and propagation.

## Mode: Strict TDD

## Work Units

### Work Unit 1 — Resolver + pre-check + main `POST` path
- Commit: `577af43` — `fix(staff): resolve existing slot purchase before Fast Pay creates a pending`
- Files: `app/api/staff/students/fast-class-action/route.ts`, `tests/api/staff-fast-class-action.test.ts`
- Diff: 225 insertions, 84 deletions (309 changed lines) — within the 400-line budget
- Tasks completed: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7 (all `[x]` in tasks.md)

### Work Unit 2 — `createPromoCash` path
- Commit: `21144c6` — `fix(staff): reuse existing slot purchase in consecutive promo add-on`
- Files: `app/api/staff/students/fast-class-action/route.ts`, `tests/api/staff-fast-class-action.test.ts`
- Diff: 93 insertions, 53 deletions (146 changed lines) — within the 400-line budget
- Tasks completed: 3.1, 3.2, 3.3, 3.4 (all `[x]` in tasks.md)

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.3 | `tests/api/staff-fast-class-action.test.ts` | Unit | ✅ 14/14 (baseline) | ✅ Written (mock migration) | ✅ N/A (helpers not wired yet, tsc-only gate) | ➖ N/A | ➖ None needed |
| 2.1-2.6 | `tests/api/staff-fast-class-action.test.ts` | Unit | ✅ 14/14 (baseline) | ✅ Written — 8 failing (RED: 8 failed / 11 passed of 19) | ✅ Passed — 19/19 after wiring resolver+pre-check+POST tx | ✅ 8 new/rewritten cases covering paid (Stripe/package_credit/settled-cash), reuse+backfill, already-linked reuse, card-pending ignore, where-clause shape, mid-tx race | ✅ Clean — extracted `resolveSlotPurchase`, `backfillAttendanceId`, `isSettledPurchase` as shared helpers |
| 3.1-3.3 | `tests/api/staff-fast-class-action.test.ts` | Unit | ✅ 19/19 (WU1 baseline) | ✅ Written — 5 failing (`tx.purchase.findFirst is not a function` after removing dead mock) | ✅ Passed — 20/20 after wiring `createPromoCash` to shared resolver + `code` forwarding | ✅ 3 cases: linked-slot reuse, linked-slot paid block (409 forwarded with `code`), linked-slot card-pending ignored | ✅ Clean — reused WU1's `resolveSlotPurchase`/`backfillAttendanceId`, no duplication introduced |

### Test Summary
- Total tests written/rewritten: 13 new or materially rewritten cases (across both work units)
- Total tests passing: 20/20 (final suite)
- Layers used: Unit (20)
- Approval tests: None — no pure-refactor-only tasks; every change is behavior-driven by a spec scenario
- Pure functions created: `isSettledPurchase`, `buildSlotPurchaseWhere` (both pure); `resolveSlotPurchase`/`backfillAttendanceId` are thin Prisma-client wrappers (impure by necessity — DB I/O)

## Verification (final, after both work units)

| Command | Result |
|---|---|
| `npx vitest run tests/api/staff-fast-class-action.test.ts` | 20/20 passed |
| `npx tsc --noEmit` | clean, no output |
| `npx eslint app/api/staff/students/fast-class-action/route.ts tests/api/staff-fast-class-action.test.ts` | 0 errors, 3 pre-existing warnings (`buildRateLimitKey`, `getClientIp`, `staffAuth` unused — present before this change, unrelated to this diff) |
| `git diff --stat HEAD~2..HEAD` | 2 files changed, 316 insertions(+), 135 deletions(-) combined |

## Deviations from Design

1. **Import source correction (task 1.2 wording)**: tasks.md said `isCompletedPaymentStatus` and `normalizeSettlementStatus` come from `@/lib/payment-constants`. They actually live in `@/app/api/staff/payments/shared.ts` (verified by reading both files) — `lib/payment-constants.ts` only holds constants, no functions. Implemented per the actual module locations and design.md's own "Dependencies" section (`isCompletedPaymentStatus` / `normalizePaymentChannel` from `payments/shared.ts`), which is consistent with the codebase.
2. **"Refunded/expired ignored" test**: rather than adding a standalone test with a refunded/expired purchase row in the mocked `findMany` result (which would be misleading — the JS-level resolver logic (`isPendingProcessablePurchase`) does NOT itself exclude these statuses; exclusion is enforced entirely by the `status: { notIn: [...] }` clause in the real Prisma query, which mocks don't apply), this scenario was folded into the where-clause assertion test (`excludes failed, refunded, and expired purchases from slot resolution via the findMany where clause`). Asserting the query shape is the only honest unit-level proof of this exclusion; behavioral confirmation with real Prisma filtering is out of scope for this unit-test file.
3. **Dead mock cleanup**: removed `findFirst` from `mockPrisma.purchase` and `mockTx.purchase` mock object definitions once WU2 completed (no production code calls `purchase.findFirst` anywhere in the route after both call sites migrated to `resolveSlotPurchase`/`findMany`).

No other deviations — all three call sites (`resolveExistingClassPurchaseBlock`, `POST`'s main transaction, `createPromoCash`) share one module-local `resolveSlotPurchase` per design's Approach section.

## Remaining Tasks (Phase 4 — explicitly out of scope for this apply batch)
- [ ] 4.1-4.6 Delivery: PRs, propagation to `codex/develop`. Parent orchestrator handles this.
