# Proposal: Stripe Payment Failure Info

## Intent

Staff can't diagnose why payments are pending or failed — failed card attempts, expired checkouts, and async payment failures all appear as generic "pending" in the Payment Timeline. This change captures Stripe failure context at ingestion time and surfaces it in the staff UI.

## Scope

### In Scope
- Handle webhook events: `payment_intent.payment_failed`, `checkout.session.expired`, `checkout.session.async_payment_failed`
- Store normalized failure info in `Purchase.metadata.stripeFailure` (no DB migration)
- Extend staff payments API to expose failure info in `PaymentRow`
- Display failure details in `PaymentHistoryTimeline` for card + pending purchases

### Out of Scope
- Retry logic for failed payments
- Customer-facing failure notifications
- Refund handling
- `checkout.session.async_payment_succeeded` (deferred until async payment methods enabled)
- New Prisma columns for failure data

## Capabilities

### New Capabilities
- `stripe-failure-ingestion`: Webhook handlers and metadata persistence for payment failure/expiration events

### Modified Capabilities
- `staff-payments-api`: Expose `failureInfo` field in payment rows (behavioral change in API response shape)
- `payment-history-timeline`: Render failure reason block for card + pending rows

## Approach

Use the existing `Purchase.metadata: Json?` field to store a normalized `stripeFailure` object — no migration required, follows existing metadata-driven patterns in staff API.

**Webhook priority rules:**
- Never downgrade an already `paid` purchase on a late failure event
- Merge failure info into metadata (never replace the full object)
- Clear `stripeFailure` if a success event arrives after a failure

**Minimal PII allowlist** — persist only: `eventType`, `occurredAt`, `paymentIntentId`, `checkoutSessionId`, `status`, `error.message`, `error.code`, `error.decline_code`, `error.type`, `card.brand`, `card.last4`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/api/stripe/webhook/route.ts` | Modified | Add 3 new event handlers; merge metadata instead of replace |
| `lib/stripe-failure.ts` | New | Normalize Stripe error → `StripeFailureInfo` type + merge helper |
| `app/api/staff/payments/route.ts` | Modified | Map `metadata.stripeFailure` into `PaymentRow.failureInfo` |
| `components/front/staff/StaffUsersAdminClient.tsx` | Modified | Pass `failureInfo` through `PaymentRow` → `PaymentEvent` transform |
| `components/front/staff/PaymentHistoryTimeline.tsx` | Modified | Render failure reason block gated on `failureInfo` + pending + card |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Out-of-order webhooks overwrite paid status | Med | Check current status before write; skip if already `paid` |
| Metadata clobber on upsert | Med | Deep-merge `stripeFailure` key; never spread full metadata replacement |
| PII drift (full Stripe objects) | Low | Explicit allowlist in `lib/stripe-failure.ts` normalizer |
| UI noise (all pending shows failure text) | Low | Gate render on `failureInfo` presence + `card` method + `pending` status |

## Rollback Plan

1. Revert webhook route to remove 3 new event cases — no Stripe config change needed
2. Revert staff payments API mapping — `failureInfo` field drops from response
3. Revert timeline component — UI silently hides missing field
4. Any `metadata.stripeFailure` already written is inert without the API mapping

No DB migration to rollback.

## Dependencies

- Stripe webhook signature verification already in place
- `Purchase.metadata` field exists (confirmed in schema)

## Success Criteria

- [ ] Failed card payments show failure reason (code + message) in Payment Timeline
- [ ] Expired checkouts show "expired" status with event timestamp
- [ ] Async payment failures show failure context in timeline
- [ ] No regression: existing `checkout.session.completed` and `payment_intent.succeeded` flows unaffected
- [ ] No paid purchase is downgraded to failed by late webhook delivery
- [ ] No full billing/payment method objects stored (PII allowlist enforced)
