# Tasks: Stripe Payment Failure Info

## Phase 1: Foundation

### 1.1 Create `lib/stripe-failure.ts` with types and normalizer functions

**Description**: Create the pure utility module that defines the `StripeFailureInfo` type, normalizer functions, and metadata merge/clear helpers. This is the single chokepoint for PII allowlisting.

**Files**:
- `lib/stripe-failure.ts` (CREATE)

**Acceptance Criteria**:
- Exports `StripeFailureInfo` type with fields: `eventType`, `occurredAt`, `paymentIntentId?`, `checkoutSessionId?`, `error?{message, code, declineCode, type}`, `card?{brand, last4}`
- Exports `normalizeFailureFromPaymentIntent(intent, event)` — extracts only allowlisted fields from `last_payment_error`; drops `billing_details`, `fingerprint`, `doc_url`, full `payment_method.id`
- Exports `normalizeFailureFromCheckoutSession(session, event)` — handles both `expired` and `async_payment_failed` event types
- Exports `mergeFailureIntoMetadata(existing, failure)` — deep-merges `stripeFailure` into existing metadata JsonObject, preserving unrelated keys; handles null/undefined/non-object existing
- Exports `clearFailureFromMetadata(existing)` — removes only `stripeFailure` key; returns `undefined` when metadata becomes empty
- No I/O, no Prisma calls, no side effects — pure functions only

**Dependencies**: None

---

### 1.2 Add unit tests for normalizer (`tests/lib/stripe-failure.test.ts`)

**Description**: Unit tests covering all public functions in `lib/stripe-failure.ts`.

**Files**:
- `tests/lib/stripe-failure.test.ts` (CREATE)

**Acceptance Criteria**:
- `normalizeFailureFromPaymentIntent`: extracts allowlisted fields from `last_payment_error`; drops `billing_details`, `fingerprint`, `doc_url`, `payment_method.id`; handles missing `last_payment_error`
- `normalizeFailureFromCheckoutSession`: handles `expired` and `async_payment_failed` event types correctly
- `mergeFailureIntoMetadata`: preserves unrelated keys; replaces `stripeFailure` sub-object; handles null/undefined/non-object existing metadata
- `clearFailureFromMetadata`: removes only `stripeFailure` key; returns `undefined` when metadata becomes empty after removal
- All tests pass independently

**Dependencies**: 1.1

---

## Phase 2: Webhook Handlers

### 2.1 Add `payment_intent.payment_failed` handler to webhook route

**Description**: Add a new switch case in the webhook route for `payment_intent.payment_failed` events. Lookup purchase by `stripePaymentIntentId`, apply status guard, then update with failure info.

**Files**:
- `app/api/stripe/webhook/route.ts` (MODIFY)

**Acceptance Criteria**:
- New case `payment_intent.payment_failed` in webhook switch
- Handler uses `normalizeFailureFromPaymentIntent` to create `StripeFailureInfo`
- Looks up purchase by `stripePaymentIntentId` via `findUnique`
- Applies status guard (see 2.4)
- Calls `prisma.purchase.update` with `mergeFailureIntoMetadata` + `status: "failed"`
- Returns 200 even if no purchase found (failures never create purchases)
- Does NOT pass raw `event.data.object.metadata` to Prisma

**Dependencies**: 1.1

---

### 2.2 Add `checkout.session.expired` handler to webhook route

**Description**: Add switch case for `checkout.session.expired`. Lookup by `stripeCheckoutSessionId`, apply status guard, update with expiration info.

**Files**:
- `app/api/stripe/webhook/route.ts` (MODIFY)

**Acceptance Criteria**:
- New case `checkout.session.expired` in webhook switch
- Handler uses `normalizeFailureFromCheckoutSession` with event type `"expired"`
- Looks up purchase by `stripeCheckoutSessionId` via `findUnique`
- Applies status guard (see 2.4)
- Calls `prisma.purchase.update` with `mergeFailureIntoMetadata` + `status: "expired"`
- Returns 200 even if no purchase found

**Dependencies**: 1.1, 2.4

---

### 2.3 Add `checkout.session.async_payment_failed` handler to webhook route

**Description**: Add switch case for `checkout.session.async_payment_failed`. Same pattern as 2.2 but status becomes `"failed"`.

**Files**:
- `app/api/stripe/webhook/route.ts` (MODIFY)

**Acceptance Criteria**:
- New case `checkout.session.async_payment_failed` in webhook switch
- Handler uses `normalizeFailureFromCheckoutSession` with event type `"failed"`
- Looks up purchase by `stripeCheckoutSessionId` via `findUnique`
- Applies status guard (see 2.4)
- Calls `prisma.purchase.update` with `mergeFailureIntoMetadata` + `status: "failed"`
- Returns 200 even if no purchase found

**Dependencies**: 1.1, 2.4

---

### 2.4 Add status guard to prevent paid→failed downgrade

**Description**: Implement the status guard logic used by all failure handlers. Must run BEFORE any write.

**Files**:
- `app/api/stripe/webhook/route.ts` (MODIFY)

**Acceptance Criteria**:
- Guard function/check: if `purchase.status === "paid"` → return 200 immediately, no write
- Guard runs after `findUnique` but before any `update`
- Guard is reused by all three failure handlers (2.1, 2.2, 2.3)
- Logged or silently ignored (no error response — late failures are expected)

**Dependencies**: None (can be done in parallel with 1.1, but must exist before 2.1-2.3 ship)

---

### 2.5 Fix existing success handlers to deep-merge metadata (not clobber)

**Description**: The existing `handleCheckoutSession` and `handlePaymentIntent` handlers currently set `metadata: session.metadata ?? undefined` directly, which clobbers any `stripeFailure` already written. Fix to use `mergeFailureIntoMetadata` pattern.

**Files**:
- `app/api/stripe/webhook/route.ts` (MODIFY)

**Acceptance Criteria**:
- `handleCheckoutSession` no longer replaces entire metadata object
- `handlePaymentIntent` no longer replaces entire metadata object
- When status transitions to `"paid"`, incoming Stripe metadata is merged with existing metadata
- Existing unrelated metadata keys are preserved
- No behavioral change for fresh purchases (no existing metadata)

**Dependencies**: 1.1

---

### 2.6 Clear `stripeFailure` on success events

**Description**: When `payment_intent.succeeded` or `checkout.session.completed` fires for a purchase that has existing `stripeFailure`, remove it.

**Files**:
- `app/api/stripe/webhook/route.ts` (MODIFY)

**Acceptance Criteria**:
- On `payment_intent.succeeded`: if existing purchase has `metadata.stripeFailure`, call `clearFailureFromMetadata` and include result in update
- On `checkout.session.completed`: same behavior
- Other metadata keys are preserved
- Status is set to `"paid"` as before
- Post-conditions: `syncPackagePurchaseFromPaidPurchase`, `syncScheduledAttendanceFromPurchase`, `awardPointsFromRule` still fire as before

**Dependencies**: 1.1, 2.5

---

## Phase 3: API Extension

### 3.1 Add `stripeFailure` field to PaymentRow type

**Description**: Extend the `PaymentRow` type/interface to include an optional `stripeFailure` field.

**Files**:
- `app/api/staff/payments/shared.ts` (MODIFY) — or wherever `PaymentRow` is defined

**Acceptance Criteria**:
- `PaymentRow` type includes `stripeFailure?: StripeFailureInfo | null`
- Type import from `lib/stripe-failure.ts` is clean (no circular deps)
- No runtime behavior change yet

**Dependencies**: 1.1

---

### 3.2 Extract and expose `stripeFailure` in staff payments API response

**Description**: In the staff payments API route, read `metadata.stripeFailure` from each Purchase, type-narrow with a guard, and project to `PaymentRow.stripeFailure`.

**Files**:
- `app/api/staff/payments/route.ts` (MODIFY)

**Acceptance Criteria**:
- Each purchase row extracts `metadata.stripeFailure` if present
- Type-narrowing guard (`isStripeFailureInfo` or equivalent) validates shape before including
- Invalid/missing shapes result in `stripeFailure` being omitted or `null` in response
- Valid shapes are projected to match `PaymentRow.stripeFailure` type
- No other fields in the response are affected

**Dependencies**: 3.1

---

## Phase 4: UI

### 4.1 Extend `PaymentEvent` interface with `failureInfo`

**Description**: Update the `PaymentEvent` interface used by the staff UI components to include failure info from the API.

**Files**:
- `components/front/staff/StaffUsersAdminClient.tsx` (MODIFY) — or wherever `PaymentEvent` is defined

**Acceptance Criteria**:
- `PaymentEvent` interface includes `failureInfo?: StripeFailureInfo | null`
- Data mapping from `PaymentRow` to `PaymentEvent` passes through `stripeFailure` → `failureInfo`
- No logic changes — typed pass-through only

**Dependencies**: 3.2

---

### 4.2 Transform API response to include failure info in timeline data

**Description**: Ensure the data pipeline from the staff payments API to the `PaymentHistoryTimeline` component carries the failure info.

**Files**:
- `components/front/staff/StaffUsersAdminClient.tsx` (MODIFY)

**Acceptance Criteria**:
- Timeline data objects include `failureInfo` when present in API response
- No transformation or enrichment logic — direct pass-through
- Existing timeline data fields unchanged

**Dependencies**: 4.1

---

### 4.3 Render failure details in PaymentHistoryTimeline

**Description**: Add a `<FailureDetails>` block to `PaymentHistoryTimeline` that renders when `status === "pending" && method === "card" && failureInfo != null`.

**Files**:
- `components/front/staff/PaymentHistoryTimeline.tsx` (MODIFY)

**Acceptance Criteria**:
- Renders error message as primary text (from `failureInfo.error.message`)
- Renders decline code as secondary text if available (`failureInfo.error.declineCode`)
- Renders card brand + last4 as tertiary text if available (`failureInfo.card.brand`, `failureInfo.card.last4`)
- Renders timestamp (`failureInfo.occurredAt`)
- Uses red/warning styling consistent with existing error patterns in the app
- Gated: only shows for `status === "pending" && method === "card" && failureInfo != null`
- Pending payments without `failureInfo` show "Pending" as before (no regression)
- Paid payments never show failure info block

**Dependencies**: 4.2

---

## Phase 5: Testing

### 5.1 Add integration tests for failure webhook handlers

**Description**: Extend the existing webhook test suite with integration tests for all failure scenarios.

**Files**:
- `tests/api/stripe-webhook-checkout-session.test.ts` (EXTEND) or new test file

**Acceptance Criteria**:
- `payment_intent.payment_failed` for existing purchase → `status=failed`, `metadata.stripeFailure` set, other keys preserved
- `checkout.session.expired` → `status=expired`, failure metadata set
- `checkout.session.async_payment_failed` → `status=failed`, failure metadata set
- Status guard: failure event for paid purchase → no write, returns 200
- Unknown purchase: failure event with no matching ID → no write, returns 200
- Clear-on-success: purchase with existing `stripeFailure` receives `payment_intent.succeeded` → `status=paid`, `stripeFailure` removed, other keys preserved
- Regression: `checkout.session.completed` for fresh session still creates purchase normally

**Dependencies**: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6

---

### 5.2 Verify existing tests still pass

**Description**: Run the full test suite to confirm no regressions from the webhook handler changes.

**Files**:
- All existing test files

**Acceptance Criteria**:
- All existing tests pass unmodified
- Staff payments fixtures may gain optional `stripeFailure` assertion if needed
- No test file requires structural changes beyond optional field additions
- `npm test` (or project test command) exits with code 0

**Dependencies**: All previous tasks

---

## Dependency Graph

```
1.1 ──→ 1.2
  │
  ├──→ 2.1 ──┐
  ├──→ 2.2 ──┤
  ├──→ 2.3 ──┤    2.4 (parallel with 1.1, required by 2.1-2.3)
  ├──→ 2.5 ──┤
  │     │    │
  │     └──→ 2.6
  │
  ├──→ 3.1 ──→ 3.2 ──→ 4.1 ──→ 4.2 ──→ 4.3
  │
  └──→ 5.1 (depends on all Phase 2 + Phase 3)
        │
        └──→ 5.2 (depends on all)
```

## Execution Order (linearized)

1. **1.1** Create `lib/stripe-failure.ts`
2. **1.2** Unit tests for normalizer
3. **2.4** Status guard (can parallelize with 1.1)
4. **2.1** `payment_intent.payment_failed` handler
5. **2.2** `checkout.session.expired` handler
6. **2.3** `checkout.session.async_payment_failed` handler
7. **2.5** Fix success handlers metadata merge
8. **2.6** Clear `stripeFailure` on success
9. **3.1** Add `stripeFailure` to PaymentRow type
10. **3.2** Expose in staff payments API
11. **4.1** Extend PaymentEvent interface
12. **4.2** Transform API response for timeline
13. **4.3** Render failure details in UI
14. **5.1** Integration tests for failure webhooks
15. **5.2** Verify all existing tests pass
