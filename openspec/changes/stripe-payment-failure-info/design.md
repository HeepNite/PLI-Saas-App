# Design: Stripe Payment Failure Info

## 1. Architecture Overview

End-to-end data flow:

```
Stripe Event
   │  (signed webhook)
   ▼
app/api/stripe/webhook/route.ts        ← extended switch + status guard
   │
   ▼
lib/stripe-failure.ts                  ← pure normalizer + deep-merge helper
   │  (StripeFailureInfo)
   ▼
prisma.purchase.update                 ← deep-merge into Purchase.metadata.stripeFailure
   │
   ▼
app/api/staff/payments/route.ts        ← read metadata.stripeFailure, expose on PaymentRow
   │
   ▼
components/front/staff/StaffUsersAdminClient.tsx   ← pass-through PaymentRow → PaymentEvent
   │
   ▼
components/front/staff/PaymentHistoryTimeline.tsx  ← render failure block (gated)
```

No new transports, no new persistence layer, no new database columns. The change is contained to a webhook switch extension, a small normalizer module, and a pass-through enrichment from API → UI.

---

## 2. Component Design

### 2.1 Stripe Failure Normalizer — `lib/stripe-failure.ts` (new)

Pure module. No I/O. No Prisma. No Stripe SDK calls (only types).

**Responsibilities:**
- Define `StripeFailureInfo` type (the persisted shape).
- Normalize a `Stripe.PaymentIntent` or `Stripe.Checkout.Session` into a `StripeFailureInfo` with a strict allowlist.
- Provide a deep-merge helper for `Purchase.metadata` that preserves existing keys and replaces only the `stripeFailure` slot.
- Provide a clear helper that strips `stripeFailure` from metadata on success.

**Public surface:**

```typescript
export type StripeFailureInfo = {
  eventType: string                  // e.g. "payment_intent.payment_failed"
  occurredAt: string                 // ISO from event.created
  paymentIntentId?: string
  checkoutSessionId?: string
  error?: {
    message?: string
    code?: string
    declineCode?: string
    type?: string
  }
  card?: {
    brand?: string
    last4?: string
  }
}

export function normalizeFailureFromPaymentIntent(
  intent: Stripe.PaymentIntent,
  event: Pick<Stripe.Event, "type" | "created">,
): StripeFailureInfo

export function normalizeFailureFromCheckoutSession(
  session: Stripe.Checkout.Session,
  event: Pick<Stripe.Event, "type" | "created">,
): StripeFailureInfo

export function mergeFailureIntoMetadata(
  existing: Prisma.JsonValue | null | undefined,
  failure: StripeFailureInfo,
): Prisma.JsonObject

export function clearFailureFromMetadata(
  existing: Prisma.JsonValue | null | undefined,
): Prisma.JsonObject | undefined
```

**Allowlist enforcement:**
The normalizer only reads the fields listed in the spec PII allowlist. Anything else from `last_payment_error` (e.g. `payment_method.id`, `payment_method.billing_details`, `doc_url`, raw request IDs, fingerprints) is dropped at this boundary. The output type is the contract — we never spread the Stripe object into metadata.

### 2.2 Webhook Handler Extensions — `app/api/stripe/webhook/route.ts` (modified)

Add three new cases to the `switch (event.type)` block in `POST`:

| Event | New handler | Action |
|---|---|---|
| `payment_intent.payment_failed` | `handlePaymentIntentFailure(event)` | guard, normalize, deep-merge metadata, set status `failed` |
| `checkout.session.expired` | `handleCheckoutSessionTerminal(event, "expired")` | guard, normalize, deep-merge metadata, set status `expired` |
| `checkout.session.async_payment_failed` | `handleCheckoutSessionTerminal(event, "failed")` | guard, normalize, deep-merge metadata, set status `failed` |

**Status guard (idempotency):**
Before any write, look up the existing purchase by its Stripe identifier:
- `payment_intent.*` events → `findUnique({ where: { stripePaymentIntentId } })`
- `checkout.session.*` events → `findUnique({ where: { stripeCheckoutSessionId } })`

Then:
1. If no purchase exists yet → ignore. Failure events for unknown purchases are not interesting; we never create a purchase row from a failure event (creation is owned by the success/checkout-completed flow).
2. If `purchase.status === "paid"` → ignore the event entirely. Do not write metadata, do not change status. Return cleanly.
3. Otherwise → proceed with the failure write.

**Deep-merge write:**
Failure handlers MUST use `prisma.purchase.update` with `metadata: mergeFailureIntoMetadata(existing.metadata, failure)`. They MUST NOT use `upsert` and MUST NOT pass raw `event.data.object.metadata` to the metadata column.

**Existing handlers (success path):**
`handleCheckoutSession` and `handlePaymentIntent` currently set `metadata: session.metadata ?? undefined` directly, which would clobber any previously-written `stripeFailure`. This is fixed by:
- On successful upsert (`status === "paid"`), call `clearFailureFromMetadata` against the previous `metadata` value and merge with the new Stripe metadata (`{ ...incomingMeta, stripeFailure: undefined }` semantics).
- This satisfies the spec's "Clear failure on success" requirement and is the only behavioral change to the existing success handlers.

**Note on event identification:** failure events do not always populate `metadata.userId` etc. We rely on the unique Stripe identifier (`stripePaymentIntentId` / `stripeCheckoutSessionId`) to find the existing purchase. We never create a new user or purchase from a failure event.

### 2.3 Staff Payments API — `app/api/staff/payments/route.ts` (modified)

Read `metadata.stripeFailure` from the `Purchase` row and project it into the `PaymentRow` response under `stripeFailure` (matching the spec). Type narrowing happens at this boundary using a small `isStripeFailureInfo` guard — we don't trust the JSON shape from the DB.

If `metadata.stripeFailure` is absent or fails the shape guard, the field is omitted from the response (or `null` — TBD by existing API conventions; default to omission for minimal payload diff).

### 2.4 Payment Timeline UI — `components/front/staff/PaymentHistoryTimeline.tsx` and `StaffUsersAdminClient.tsx` (modified)

**`StaffUsersAdminClient.tsx`:** extend the `PaymentRow → PaymentEvent` mapper to pass `failureInfo` through unchanged. No business logic here, just a typed pass-through.

**`PaymentHistoryTimeline.tsx`:**
- Extend `PaymentEvent` interface with optional `failureInfo?: StripeFailureInfo` (import the type from `lib/stripe-failure`).
- Add a `<FailureDetails>` block rendered conditionally:
  - GATE: `event.status === "pending"` AND `event.method === "card"` AND `event.failureInfo != null`
  - CONTENT: error message (primary), decline code (secondary), card brand + last4 (tertiary), event timestamp.
  - STYLE: red/warning treatment consistent with existing destructive UI tokens in the app.
- Paid rows never render the failure block (gate filters them out by status).

The gate matches spec scenarios exactly: pending + card + has failureInfo → render; pending without failureInfo → existing "Pending" label; paid → no failure block ever.

---

## 3. Data Model

**No schema migration.** Use the existing `Purchase.metadata: Json?` column.

```typescript
// Purchase.metadata after this change:
{
  // ...existing keys preserved verbatim (courseSlug, packageId, settlementStatus, etc.)
  stripeFailure?: {
    eventType: string;
    occurredAt: string;
    paymentIntentId?: string;
    checkoutSessionId?: string;
    error?: {
      message?: string;
      code?: string;
      declineCode?: string;
      type?: string;
    };
    card?: {
      brand?: string;
      last4?: string;
    };
  }
}
```

**Status field:**
The existing `Purchase.status: String` column is reused. New persisted values:
- `failed` — written by `payment_intent.payment_failed` and `checkout.session.async_payment_failed` handlers.
- `expired` — written by `checkout.session.expired` handler.

`lib/purchase-status.ts` already passes through any non-success status verbatim, so no change is required there. Downstream consumers that key off `status === "paid"` continue to behave correctly.

---

## 4. Key Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | **No DB migration** — use `Purchase.metadata` JSON | Lowest friction; staff UI already reads metadata-driven fields (`settlementStatus`, etc.); failure shape may evolve as we observe Stripe payloads. |
| 2 | **Deep-merge metadata** | Existing success handlers replace `metadata` wholesale today. A failure write that follows the same pattern would clobber unrelated keys. The merge helper is also the only safe way to satisfy the spec's "preserve existing keys" requirement. |
| 3 | **PII allowlist enforced in normalizer** | Single chokepoint. The normalizer's output type IS the contract — there is no path from the Stripe object into the DB that bypasses it. |
| 4 | **Status guard before any write** | Spec mandates "never downgrade paid". Implementing this at the handler entry point (not at merge time) keeps the rule loud and visible, and makes the no-op cheap (single `findUnique`, no write). |
| 5 | **Clear `stripeFailure` on success** | A successful retry should not leave stale failure context visible in the staff UI. Clearing on success is the cheapest UX-correct behavior. |
| 6 | **Failure events never create purchases** | Purchase creation is owned by `checkout.session.completed` / `payment_intent.succeeded`. A failure event for an unknown PI/session ID is logged-and-ignored — it likely belongs to a flow we don't track (e.g. SetupIntent, manual capture testing). |
| 7 | **Failure UI gated to `pending + card`** | Spec gate. Avoids noisy failure blocks on cash/manual rows that happen to be pending for unrelated reasons. |
| 8 | **No retry / no notifications** | Out of scope per proposal. Staff diagnose; the customer flow is unchanged. |

---

## 5. Testing Strategy

### 5.1 Unit tests — `lib/stripe-failure.test.ts` (new)

- `normalizeFailureFromPaymentIntent`:
  - extracts `error.message/code/decline_code/type` from `last_payment_error`
  - extracts `card.brand/last4` from `last_payment_error.payment_method.card`
  - drops non-allowlisted fields (billing_details, fingerprint, doc_url, payment_method.id)
  - handles missing `last_payment_error` (returns failure with no `error` field)
- `normalizeFailureFromCheckoutSession`:
  - handles `expired` event (no `last_payment_error`, just metadata + IDs)
  - handles `async_payment_failed` event
- `mergeFailureIntoMetadata`:
  - preserves existing unrelated keys
  - replaces (not merges) the `stripeFailure` sub-object on second call
  - works when existing metadata is `null` / `undefined` / non-object
- `clearFailureFromMetadata`:
  - removes only the `stripeFailure` key
  - returns `undefined` when metadata becomes empty (so Prisma can omit it)

### 5.2 Integration tests — `app/api/stripe/webhook/route.test.ts` (extended)

Mock Stripe signature verification and Prisma. Cover:

- `payment_intent.payment_failed` for an existing purchase → status becomes `failed`, `metadata.stripeFailure` set, other metadata keys preserved.
- `checkout.session.expired` for an existing purchase → status becomes `expired`, failure metadata set.
- `checkout.session.async_payment_failed` for an existing purchase → status becomes `failed`, failure metadata set.
- **Status guard:** failure event for a `paid` purchase → no DB write, 200 response.
- **Unknown purchase:** failure event with no matching Stripe ID → no DB write, 200 response.
- **Clear-on-success:** purchase with existing `metadata.stripeFailure` receives `payment_intent.succeeded` → status becomes `paid`, `stripeFailure` removed, other metadata keys preserved.
- **Existing success path regression:** `checkout.session.completed` for a fresh session still creates the purchase with the existing fields and no `stripeFailure`.

### 5.3 Existing tests
All existing webhook + staff payments + timeline tests must continue to pass with no modifications, except the staff payments test fixtures which gain an optional `stripeFailure` projection assertion.

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Out-of-order webhooks (failure arrives after success) | Medium | High — paid purchase wrongly marked failed | Status guard rejects any failure write when `status === "paid"`. Implemented at handler entry, before any DB write. |
| Metadata clobber on upsert | Medium | High — staff loses settlement notes, package context | All failure writes go through `mergeFailureIntoMetadata`. Success handlers updated to merge instead of replace, and to clear `stripeFailure`. |
| PII leakage from full Stripe payloads | Low | High — compliance risk | Single allowlist enforced in `lib/stripe-failure.ts` normalizer. The `StripeFailureInfo` type is the contract — there is no other code path from Stripe object → metadata. |
| UI noise (failure block on unrelated pending rows) | Low | Low | Gate render on `status === "pending"` AND `method === "card"` AND `failureInfo != null`. |
| Failure event for purchase not yet persisted (race) | Low | Low | Failure handler is no-op when no purchase row exists. The eventual success/checkout-completed event creates the row; failure context for a never-created purchase is acceptable to drop. |
| Future Stripe API shape changes break normalizer | Low | Medium | Normalizer is the only Stripe-facing surface; unit-tested against fixtures. Adding fields is additive — type stays minimal. |

---

## 7. Open Questions

None blocking. Possible follow-ups (not in scope):
- Should `failed` purchases auto-clear after N days?
- Should we capture `payment_intent.requires_action` (3DS challenges) as a distinct pending sub-state?
- Should we surface failures in a dedicated `/staff/failed-payments` view instead of inline timeline?
