# Specification: Stripe Payment Failure Info

## 1. stripe-failure-ingestion

### Requirement: Handle payment failure webhooks
The system MUST handle `payment_intent.payment_failed`, `checkout.session.expired`, and `checkout.session.async_payment_failed` Stripe webhook events.

#### Scenario: Payment intent fails
- GIVEN a `payment_intent.payment_failed` event for a Purchase
- WHEN the webhook is processed
- THEN the system MUST store normalized failure info in `Purchase.metadata.stripeFailure`
- AND set the Purchase status to `failed`

#### Scenario: Checkout session expires
- GIVEN a `checkout.session.expired` event for a Purchase
- WHEN the webhook is processed
- THEN the system MUST store expiration info in `Purchase.metadata.stripeFailure`
- AND set the Purchase status to `expired`

#### Scenario: Async payment fails
- GIVEN a `checkout.session.async_payment_failed` event for a Purchase
- WHEN the webhook is processed
- THEN the system MUST store failure info in `Purchase.metadata.stripeFailure`

### Requirement: Protect paid status from late failures
The system MUST NOT overwrite a Purchase status from `paid` to `failed` or `expired` on a late webhook event.

#### Scenario: Failure arrives after success
- GIVEN a Purchase with status `paid`
- WHEN a failure or expiration webhook is received
- THEN the system MUST ignore the event
- AND leave status and metadata unchanged

### Requirement: Clear failure on success
The system MUST remove `stripeFailure` from metadata when a success event arrives after a prior failure.

#### Scenario: Success after failure
- GIVEN a Purchase with `metadata.stripeFailure` set
- WHEN `payment_intent.succeeded` or `checkout.session.completed` fires
- THEN the system MUST clear `stripeFailure` from metadata
- AND set status to `paid`

### Requirement: Deep-merge metadata
The system MUST deep-merge `stripeFailure` into `Purchase.metadata` without replacing the entire metadata object.

#### Scenario: Metadata has existing keys
- GIVEN a Purchase with metadata containing unrelated keys
- WHEN a failure webhook is processed
- THEN existing metadata keys MUST be preserved
- AND `stripeFailure` MUST be added or updated

### Requirement: Enforce PII allowlist
The system MUST store only allowlisted fields in `stripeFailure`.

#### Scenario: Stripe event has extra data
- GIVEN a webhook payload with full billing or payment method objects
- WHEN normalized
- THEN only `eventType`, `occurredAt`, `paymentIntentId`, `checkoutSessionId`, `error.message`, `error.code`, `error.decline_code`, `error.type`, `card.brand`, `card.last4` MAY be persisted

---

## 2. staff-payments-api

### Requirement: Expose failure info in payment rows
The staff payments API MUST include `stripeFailure` in `PaymentRow` when `metadata.stripeFailure` exists.

#### Scenario: Payment has failure info
- GIVEN a Purchase with `metadata.stripeFailure`
- WHEN the staff payments API returns PaymentRow
- THEN `stripeFailure` MUST be present in the response

#### Scenario: Payment has no failure info
- GIVEN a Purchase without `metadata.stripeFailure`
- WHEN the staff payments API returns PaymentRow
- THEN `stripeFailure` MUST be omitted or `null`

---

## 3. payment-history-timeline

### Requirement: Render failure details
The `PaymentHistoryTimeline` MUST display failure details for pending card payments that have `failureInfo`.

#### Scenario: Pending card payment failed
- GIVEN a PaymentEvent with `status === "pending"`, `method === "card"`, and `failureInfo`
- WHEN the timeline renders
- THEN it MUST show the error message
- AND display decline code if available
- AND display card brand and last4 if available
- AND use red/warning styling

#### Scenario: Pending payment without failure
- GIVEN a PaymentEvent with `status === "pending"` and no `failureInfo`
- WHEN the timeline renders
- THEN it MUST show "Pending" as before

#### Scenario: Paid payment
- GIVEN a PaymentEvent with `status === "paid"`
- WHEN the timeline renders
- THEN no failure info block MUST be shown
