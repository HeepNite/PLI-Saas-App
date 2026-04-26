## Exploration: stripe-payment-failure-info

### Current State
Stripe ingestion is centralized in `app/api/stripe/webhook/route.ts` and only handles two events today:

| Event | Handler | Current behavior | Purchase persistence |
|---|---|---|---|
| `checkout.session.completed` | `handleCheckoutSession(session)` | Resolves/creates user, normalizes status, upserts purchase by `stripeCheckoutSessionId`, syncs package + attendance + points when paid | Writes `stripeCheckoutSessionId`, `stripePaymentIntentId`, `status`, amount/currency, customer snapshot, package/service/addons, and `metadata = session.metadata` |
| `payment_intent.succeeded` | `handlePaymentIntent(intent)` | Resolves/creates user, normalizes status, upserts purchase by `stripePaymentIntentId`, syncs package + attendance + points when paid | Writes `stripePaymentIntentId`, `status`, amount/currency, customer snapshot, package/service/addons, and `metadata = intent.metadata` |

No failure-related Stripe webhook events are handled (`payment_intent.payment_failed`, `checkout.session.expired`, `checkout.session.async_payment_failed` are currently ignored by default branch).

Purchase status normalization (`lib/purchase-status.ts`) collapses successful statuses to `paid`; all other statuses are stored verbatim (e.g. `requires_payment_method`, `canceled`, etc.).

### Affected Areas
- `app/api/stripe/webhook/route.ts` — webhook switch, event ingestion, purchase upsert logic.
- `prisma/schema.prisma` (`Purchase` model) — Stripe identifiers + `metadata` JSON storage.
- `app/api/staff/payments/route.ts` — maps `Purchase` rows into payment rows for staff history; currently does not expose Stripe failure details.
- `components/front/staff/StaffUsersAdminClient.tsx` — transforms `PaymentRow` into timeline `PaymentEvent`; currently no failure fields.
- `components/front/staff/PaymentHistoryTimeline.tsx` — UI for payment timeline; currently only `status/method/amount/...` and optional modifications.
- `app/api/checkout/session/status/route.ts` — session polling already distinguishes `expired/open/complete`, but does not persist failure context.

### Purchase Model (Stripe-relevant fields)
From `prisma/schema.prisma` (`model Purchase`):
- `status: String`
- `stripePaymentIntentId: String? @unique`
- `stripeCheckoutSessionId: String? @unique`
- `metadata: Json?`
- plus snapshot fields used in staff UI (`amount`, `currency`, `email`, `name`, `phone`, etc.)

`metadata` already exists and is the lowest-friction place to store structured failure info without an immediate schema migration.

### Stripe Failure Data Available
From Stripe event/object docs:
- `payment_intent.payment_failed` provides a PaymentIntent object with `last_payment_error`.
- `last_payment_error` can include: `message`, `code`, `decline_code`, `type`, `doc_url`, and `payment_method` details.
- For card methods, `last_payment_error.payment_method.card.brand` and `.last4` are available as masked card context.
- Checkout lifecycle failure/terminal events include:
  - `checkout.session.expired`
  - `checkout.session.async_payment_failed`
  - (`checkout.session.async_payment_succeeded` may matter for delayed methods if enabled later)

Recommended safe capture scope:
- Keep: `eventType`, `occurredAt`, `paymentIntentId`, `checkoutSessionId`, `status`, `error.message`, `error.code`, `error.decline_code`, `error.type`, optional `card.brand`, `card.last4`.
- Avoid persisting: full billing details, full payment method payloads, fingerprints, network internals not needed for staff support.

### Current Payment Timeline Constraints
- `PaymentEvent` (`PaymentHistoryTimeline.tsx`) has no failure field.
- `PaymentRow` (`StaffUsersAdminClient.tsx`) also has no Stripe failure field.
- Timeline status logic currently maps non-paid/non-refunded to `pending`, so failed card attempts appear as pending with no reason.

### Existing Patterns
- Webhook pattern: verify signature, switch on event type, call dedicated handler, return 200 JSON `{ received: true }`, and fail with 500 on handler exception.
- Purchase writes use `upsert` keyed by Stripe IDs.
- Staff payment APIs heavily derive state from `purchase.metadata` (`settlementStatus`, `settlementNote`, date/time keys), so adding nested metadata follows existing conventions.

### Approaches
1. **Metadata-only failure capture (recommended)**
   - Extend webhook switch with failure/expiration events and persist a normalized `metadata.stripeFailure` object.
   - Extend staff payments mapping + timeline types/UI to surface failure reason for card pending rows.
   - Pros: no Prisma migration, minimal surface area, follows existing metadata-driven patterns.
   - Cons: requires careful JSON merge logic to avoid clobbering existing metadata.
   - Effort: Medium.

2. **New dedicated DB columns for failure info**
   - Add explicit Purchase columns (`stripeFailureCode`, `stripeFailureMessage`, etc.), then wire through API/UI.
   - Pros: stronger typing/queryability.
   - Cons: migration overhead; wider refactor; less flexible for future Stripe payload evolution.
   - Effort: Medium-High.

### Recommendation
Use **Approach 1** now:
1. Handle webhook events: `payment_intent.payment_failed`, `checkout.session.expired`, `checkout.session.async_payment_failed` (and optionally `checkout.session.async_payment_succeeded` for cleanup).
2. Persist a normalized nested object in purchase metadata, e.g. `metadata.stripeFailure`.
3. Add precedence rules: never downgrade an already `paid` purchase due to out-of-order failure events; clear/stale-mark `stripeFailure` on success events.
4. Surface in staff timeline by extending `PaymentRow` + `PaymentEvent` with optional `failureInfo`, then render a compact “Failure reason” block for card+pending items.

### Risks
- **Out-of-order webhooks** can overwrite state incorrectly unless idempotency/preference rules are explicit.
- **Metadata overwrite bug risk**: current upserts set `metadata` directly from Stripe metadata; failure info can be lost unless merged.
- **PII/security drift** if full Stripe error/payment method objects are persisted instead of a minimal allowlist.
- **UI noise** if all pending statuses show failure text; must gate to Stripe-card pending rows with actual failure payload.

### Ready for Proposal
Yes — code touchpoints, Stripe event scope, data contract, and key risks are clear enough to proceed to proposal/spec.
