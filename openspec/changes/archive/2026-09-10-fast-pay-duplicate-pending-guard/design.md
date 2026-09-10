# Design: Fast Pay duplicate pending guard

## Technical Approach

One module-local slot resolver in `app/api/staff/students/fast-class-action/route.ts` replaces the three duplicated `purchase.findFirst` filters. It matches by slot identity across any channel, ignores `failed`/`refunded`/`expired`, and classifies the slot in strict precedence: any **paid** row blocks, else the earliest **cash-processable open** row is reused, else nothing matches and today's create path runs. A card-pending row (Stripe session or intent still in flight) is deliberately neither blocked nor reused. The pre-check keeps running outside the transaction so `previewOnly` still gets its 409; the same resolver runs again inside `runSerializableTransaction` so a row created between pre-check and write is caught. Response shape is unchanged.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| Resolver placement | Module-local in `route.ts` | New `lib/` module | All 3 call sites live in this file; a new module adds a file + import churn with no external consumer (YAGNI). |
| Query shape | `findMany` over the slot, reduce in JS | `findFirst` + `orderBy` | `createdAt asc` would return a pending row and hide a paid one; D2 must beat D1. One query, bounded by slot. |
| Paid classification | `isCompletedPaymentStatus(status) \|\| normalizeSettlementStatus(metadata.settlementStatus) === "paid"`, on any channel | Status only | Cash `mark_paid` sets `status: "paid"` (`payments/[purchaseId]/route.ts:82`), but a card row settled by staff only gets `metadata.settlementStatus`. Channel is irrelevant once paid blocks everywhere. |
| Reuse eligibility | `isPendingProcessablePurchase` (`payments/shared.ts:182`) — cash channel, or `unknown` channel with no Stripe evidence | Reuse any open row | Reusing an in-flight card row risks a double charge if the customer completes checkout later. A card-pending row is **ignored**: Fast Pay creates its cash pending exactly as today. Reuses the board's own definition instead of a fourth bespoke one. |
| Ignored statuses | `failed`, `refunded`, `expired` | `failed`/`refunded` only | `"expired"` is written by `stripe/webhook/route.ts:648-664` for terminal checkout sessions; without it a dead Stripe row would be matched. |
| `"expired"` literal | Local `IGNORED_PURCHASE_STATUSES` in the route with a comment | Add `EXPIRED` to `PURCHASE_STATUS` | `PURCHASE_STATUS` has no `EXPIRED` key; adding one touches a third shared file and widens a constant consumed elsewhere for no behavior gain. Flagged below as a follow-up. |
| Mid-transaction abort | `throw new Error(COMPLETED_PURCHASE_ERROR)` inside the tx, caught at the call site | Return a sentinel value through the tx result | Matches the repo idiom (`throw new Error("PACKAGE_PLAN_NOT_FOUND")`, `payments/[purchaseId]/route.ts:150`) and guarantees rollback. `runSerializableTransaction` only retries `P2034`, so it propagates. |
| `pending_payment` code | No longer emitted; delete `PENDING_PAYMENT_MESSAGE` | Keep as dead code | D1 turns pending into reuse. `studentsBoardTypes.ts:19` types it as `... \| string`, so removing the emission breaks no consumer and no UI file changes. |
| Backfill write | `data: { metadata: { ...asObject(purchase.metadata), attendanceId } as Prisma.InputJsonObject }` | `metadata` JSON path update | Exactly the pattern already used at `payments/[purchaseId]/route.ts:293-301` and `payments/bulk/route.ts:132-142`. Skipped when `attendanceId` already matches (no redundant write). |

## Data Flow

    POST ─┬─ pre-check (prisma, no tx) ── resolveSlotPurchase ── paid? ─→ 409 completed_purchase
          │                                                   └─ else ─→ continue (previewOnly returns here)
          └─ runSerializableTransaction(tx)
                 upsert session → create/update attendance
                 resolveSlotPurchase(tx, slot + attendance.id)   ← re-read, race window closes here
                   paid (any channel)      → throw COMPLETED_PURCHASE_ERROR → rollback → 409 completed_purchase
                   cash-processable open   → backfillAttendanceId(tx, row)  (no create, amount kept)
                   card-pending / no match → purchase.create (today's path)

`createPromoCash` runs the identical in-transaction branch against the linked slot and returns `{ error, status: 409, code: "completed_purchase" }`, which `POST` line 224 forwards with the code.

## Interfaces / Contracts

```typescript
type SlotPurchaseClient = Pick<Prisma.TransactionClient, "purchase">   // accepts prisma and tx
type ClassSlot = { userId: string; courseSlug: string; date: string; time: string; attendanceId?: string }

// "expired" is written by stripe/webhook for terminal checkout sessions; PURCHASE_STATUS has no EXPIRED key
const IGNORED_PURCHASE_STATUSES = [PURCHASE_STATUS.FAILED, PURCHASE_STATUS.REFUNDED, "expired"]

const buildSlotPurchaseWhere = (slot: ClassSlot) => ({
  userId: slot.userId,
  courseSlug: slot.courseSlug,
  status: { notIn: IGNORED_PURCHASE_STATUSES },   // Purchase.status is non-null, notIn is safe
  OR: [
    { AND: [
      { metadata: { path: ["date"], equals: slot.date } },
      { metadata: { path: ["time"], equals: slot.time } },
    ] },
    ...(slot.attendanceId ? [{ metadata: { path: ["attendanceId"], equals: slot.attendanceId } }] : []),
  ],
})

// isPendingProcessablePurchase needs OutstandingBalancePurchase (shared.ts:157) — hence userId + both Stripe columns
const SLOT_PURCHASE_SELECT = {
  id: true, userId: true, amount: true, status: true, metadata: true,
  stripePaymentIntentId: true, stripeCheckoutSessionId: true,
} as const

// Module-local helper (route.ts): paid on any channel — status OR staff settlement flag.
const isSettledPurchase = (purchase: { status: string; metadata: unknown }) =>
  isCompletedPaymentStatus(purchase.status) ||
  normalizeSettlementStatus(asObject(purchase.metadata).settlementStatus) === SETTLEMENT_STATUS.PAID

const resolveSlotPurchase = async (db: SlotPurchaseClient, slot: ClassSlot) => {
  const purchases = await db.purchase.findMany({
    where: buildSlotPurchaseWhere(slot),
    orderBy: { createdAt: "asc" },
    select: SLOT_PURCHASE_SELECT,
  })
  const paid = purchases.find(isSettledPurchase)          // any channel wins first
  if (paid) return { purchase: paid, settled: true }
  const reusable = purchases.find(isPendingProcessablePurchase)   // earliest cash-processable
  return reusable ? { purchase: reusable, settled: false } : null
}
```

Paid is tested **before** reuse, so the `isOpenPurchase` quirk (a cash row with `status: "paid"` but `settlementStatus: "pending"` reports `isOpen: true`) can never reach the reuse branch.

Separate `metadata` path filters combined inside `AND`/`OR` arrays is the pattern already working in this file (lines 104-112); the "no AND on the same path" caveat in `checkout/cash` does not apply.

## File Changes

| File | Action | Description | Est. changed lines |
|---|---|---|---|
| `app/api/staff/students/fast-class-action/route.ts` | Modify | Resolver + 3 call sites, abort sentinel, backfill, imports (`PURCHASE_STATUS`, `SETTLEMENT_STATUS`, `isCompletedPaymentStatus`, `normalizeSettlementStatus`, `isPendingProcessablePurchase`), delete `PENDING_PAYMENT_MESSAGE` | ~130-165 |
| `tests/api/staff-fast-class-action.test.ts` | Modify | `findFirst` → `findMany` mocks (6 sites, rows now need `status`), add `purchase.update` mock, 10 new/rewritten cases | ~200-240 |

Total ~330-405 changed lines — **at** the 400 budget. `sdd-tasks` MUST forecast this as High and, under `auto-chain`, slice into two work units: (1) resolver + pre-check + main `POST` path with its tests, (2) `createPromoCash` path with its tests. Do not add board-side work to either.

## Testing Strategy

Vitest, existing style (`vi.mock("@/lib/prisma")`, `mockTx`). Command: `npm test` (`vitest run`); targeted: `npx vitest run tests/api/staff-fast-class-action.test.ts`.

Mock rows must now carry `status` and, for the card cases, `stripeCheckoutSessionId` / `stripePaymentIntentId`, because `isPendingProcessablePurchase` reads them. A bare row with empty `metadata` and no Stripe columns resolves to channel `unknown` with no evidence, so it stays reusable and existing minimal fixtures keep working.

| # | Case | Expected |
|---|---|---|
| 1 | Web pending cash row on the slot, no `attendanceId` | 200, no `purchase.create`, `purchase.update` backfills `attendanceId`, existing `purchaseId` returned, amount kept |
| 2 | Stripe-paid row (`status: "paid"`, no cash channel), `previewOnly` | 409 `completed_purchase`, no `$transaction` |
| 3 | `package_credit` paid row on the slot | 409 `completed_purchase` |
| 4 | Cash row with `status: "pending"` but `metadata.settlementStatus: "paid"` | 409 `completed_purchase` (settlement closes the slot) |
| 5 | Card-pending row (`status: "pending"`, `stripeCheckoutSessionId` set) on the slot | 200, **new** purchase created — neither blocked nor reused |
| 6 | Only a `refunded` row / only an `expired` row on the slot | 200, new purchase created |
| 7 | Where-clause assertion | `findMany` called with `status: { notIn: ["failed", "refunded", "expired"] }` and the date/time OR attendanceId `OR` |
| 8 | Pre-check clean, paid row appears in `mockTx.purchase.findMany` | 409 `completed_purchase`, no `purchase.create`, tx rolled back |
| 9 | Pending row already carrying the correct `attendanceId` | 200, reuse, `purchase.update` **not** called |
| 10 | Promo: pending cash row / paid row / card-pending row on the linked slot | reuse (no create) / 409 `completed_purchase` / new promo purchase created |
| 11 | Rewrite of "blocks Fast Pay when the student still has a pending purchase" | now reuses; `pending_payment` is never returned |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Auth (`withStaffGuard` + `authorizeStudentOperationalRequest`), rate limit, and Clerk session handling are untouched; the change only widens a read filter and reuses a row instead of inserting.

## Migration / Rollout

No migration. `metadata` is an existing `Json?` column; no Prisma model change. Pre-existing production duplicates are not repaired by this change.

## Open Questions

- [ ] Adding `EXPIRED: "expired"` to `PURCHASE_STATUS` (`lib/payment-constants.ts`) would remove the local literal; deferred to keep this change to two files.
- [ ] A card-pending row on the slot is ignored, so Fast Pay still creates a cash pending alongside it — one open cash row plus one open card row on the same slot until the Stripe session expires and the webhook marks it `expired`. This is accepted (it avoids the double-charge risk of reuse) but it means the outstanding balance can briefly show both; the deferred board-side dedup change is the real remedy.
- [ ] Delivery target unresolved from the proposal: `openspec/config.yaml` declares `target_branch: codex/develop`, `branch_discipline: never main`.

Resolved by the orchestrator gate (no longer open): `"expired"` joins the ignored statuses; reuse is gated by `isPendingProcessablePurchase`; precedence is paid → cash-processable open → create.
