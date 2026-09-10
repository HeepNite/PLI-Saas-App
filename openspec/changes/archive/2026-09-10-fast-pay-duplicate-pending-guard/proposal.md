# Proposal: Fast Pay duplicate pending guard

## Intent

Staff Fast Pay creates a second `Purchase` for a class slot that already has one. Its pre-check only matches purchases carrying `metadata.attendanceId` AND `paymentChannel IN {cash, package_credit}`, so it misses web `cash_checkout` pendings (no `attendanceId`) and Stripe-paid rows (channel `card`). Confirmed in production 2026-09-08: Richmond gained a phantom $40 outstanding balance; Christian gained a duplicate hidden by board slot dedup and impossible to settle. Data was repaired by hand; the creation path is still open.

## Scope

### In Scope

- Slot identity resolved as `(userId, courseSlug, metadata.date, metadata.time)` OR matching `attendanceId`, across any payment channel.
- Existing PENDING purchase on the slot: **reuse it** — create/update the attendance, backfill `metadata.attendanceId` when absent, keep the existing amount, create no new purchase, return success.
- Existing PAID purchase on the slot (cash, card/Stripe evidence, or `package_credit`): block with the current `completed_purchase` 409 code and message.
- `failed` and `refunded` purchases ignored by the guard (they currently block Fast Pay forever).
- Same behavior on the main `POST` handler and the consecutive-promo path (`createPromoCash`).
- Test coverage for each rule in `tests/api/staff-fast-class-action.test.ts`.

### Out of Scope

- Board-side outstanding balance summing raw purchases while the card dedups by slot — separate follow-up change.
- UI changes; `FastClassActionControls.tsx` already renders any non-2xx error.
- Cleanup of pre-existing duplicate rows in production.

## Capabilities

### New Capabilities
- `staff-fast-class-payment`: slot identity, reuse-vs-block precedence, and ignored statuses for staff Fast Pay and its promo add-on.

### Modified Capabilities
- None.

## Approach

Extract one slot-match resolver (the same shape is duplicated at three call sites) returning the existing purchase plus a paid/pending classification derived from `isCompletedPaymentStatus` in `app/api/staff/payments/shared.ts` — not a fourth bespoke definition. Callers branch: paid → 409; pending → reuse; none → today's create. Reuse must stay inside the existing transaction so attendance creation and metadata backfill commit together.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/api/staff/students/fast-class-action/route.ts` | Modified | Resolver + three call sites (`resolveExistingClassPurchaseBlock`, `POST`, `createPromoCash`) |
| `tests/api/staff-fast-class-action.test.ts` | Modified | Reuse, paid-block, ignored-status, promo cases |

No Prisma model or migration changes; `metadata` is an existing JSON column.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reuse races a customer's in-flight self-checkout paying the same row | Low | Re-read and classify inside the transaction; abort to `completed_purchase` if it became paid |
| Slot collision across different sessions | Low | `metadata.date` is a concrete calendar date, not a weekday; cover in spec |
| Reuse silently keeps a stale amount staff expected to change | Low | Documented as intended; amount edits stay a separate staff action |
| Diff approaches the 400-line budget | Medium | Single PR, route + its tests only; no board-side work |

## Rollback Plan

Revert the single commit on `fix/fast-pay-duplicate-pending-guard`. Behavior returns to the narrow pre-check; no data migration to undo, since reuse only backfills `metadata.attendanceId` on rows that would otherwise have been duplicated.

## Dependencies

- `isCompletedPaymentStatus` / `normalizePaymentChannel` from `app/api/staff/payments/shared.ts`.

## Success Criteria

- [ ] Fast Pay against a web `cash_checkout` pending creates no second purchase and attaches `attendanceId`.
- [ ] Fast Pay against a Stripe-paid or `package_credit`-paid slot returns 409 `completed_purchase`.
- [ ] `failed` / `refunded` rows neither block nor get reused.
- [ ] Promo add-on path obeys the same rules.
- [ ] `npm test` green; diff under 400 changed lines.

## Delivery Notes

- Review budget 400 changed lines; deliver as one PR.
- Propagation: after this lands, apply the same fix to `codex/develop` (the route file is byte-identical on both branches today). Note the conflict for the orchestrator: `openspec/config.yaml` declares `target_branch: codex/develop` and `branch_discipline: never main`, while the handoff describes merging to main first — the delivery target needs confirmation before apply.
