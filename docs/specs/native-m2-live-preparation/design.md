# Design: exact-total native M2 purchase preparation

## Purpose

This design defines the smallest reuse-first transition from the historical fixed USD 1 internal purchase to the active `/staff/terminal` contract. It does not authorize deployment, provider access, device activity, feature-flag changes, or a LIVE charge.

## Existing contracts to reuse

- `/api/checkout/intent` remains the server-authoritative validator for the current course, service, package, add-ons, participants, coupon, account, and calculated total.
- `Purchase` remains the durable immutable purchase/fulfillment record and stable payment idempotency owner.
- `/api/kiosk/terminal/internal-purchase` remains the authenticated staff-terminal/native payment and recovery boundary.
- Existing Stripe webhook processing and `syncPackagePurchaseFromPaidPurchase` remain fulfillment authority after a server-verified paid event.
- Existing native durable state continues to own the post-admission ticket and PaymentIntent identity. JavaScript never receives those values.

## Why an additive schema record is unavoidable

A random opaque reference cannot be verified or consumed exactly once from the existing signed ticket because that ticket is client-readable and carries identifiers. `PreparedCheckoutContext` is an account-verification snapshot, not a one-use payment capability, and its lookup is intentionally non-consuming. `Purchase` has no field that can atomically bind a random reference digest, expiry, caller terminal/session, and consumption state without overloading payment status or mutable JSON.

Add `PreparedNativePurchase` as a narrow capability record:

- random reference digest (unique; plaintext is never stored),
- one-to-one pending `Purchase`,
- originating terminal and terminal-session IDs,
- expiry and consumed timestamp,
- created and updated timestamps.

The migration is additive. Existing rows require no backfill. Rollback disables preparation/consumption while retaining records for reconciliation.

## Preparation contract

`POST /api/checkout/intent` accepts the closed payment surface `native_m2_prepare` only for the exact `/staff/terminal` prepared-account path with a valid terminal session.

The request reuses the existing checkout payload. Client IDs and prices are claims only: existing checkout validation resolves the selected catalog objects and calculates the exact amount. The server then creates or reuses one pending `Purchase` containing the normalized selection, exact amount/currency, recipient, and the same fulfillment metadata used by Stripe webhook handling.

The response exposes only:

```json
{
  "preparedPurchaseReference": "<random opaque value>",
  "state": "prepared"
}
```

It exposes no Purchase ID, PaymentIntent ID, signed ticket, client secret, provider object, terminal/session identifier, or diagnostics. A digest of the random value is persisted. Repeating the same checkout preparation may replace only an unconsumed, expired capability for the same stable pending purchase; it never creates a second purchase for an unresolved payment.

## Native consumption contract

The native host passes the opaque reference directly to `/api/kiosk/terminal/internal-purchase`; JavaScript does not proxy the response. The endpoint authenticates the current terminal session and atomically consumes an unexpired capability whose terminal/session binding matches the caller.

Consumption returns the existing native-only signed attempt contract bound to:

- the prepared Purchase and recipient,
- its exact amount/currency and immutable selection digest,
- the approved terminal/session/reader,
- one stable payment idempotency key.

A stale, substituted, foreign-session, or already-consumed reference fails closed before provider access. Consumption itself creates no PaymentIntent, so a lost consume response cannot create an unknown charge; the operator may safely prepare again after reconciliation of the capability state.

## Payment and recovery

Payment creation reads amount, currency, description, recipient, and metadata from the bound pending `Purchase`; no fixed USD 1 catalog assertion remains on the active path. Stripe creation uses the Purchase-owned stable idempotency key. The PaymentIntent is durably associated with that same Purchase before collection proceeds.

After admission:

- retry/restart retrieves or idempotently resumes only that Purchase's PaymentIntent;
- no web PaymentElement fallback is allowed;
- only fresh server/Stripe status can report paid;
- neither SDK completion nor bridge state fulfills the purchase.

## Fulfillment

The PaymentIntent metadata carries the bound Purchase identity and immutable normalized checkout metadata. The signed webhook validates that the provider amount/currency and metadata agree with the pending Purchase before updating it. Existing fulfillment uses that stored selection, including package metadata required by `syncPackagePurchaseFromPaidPurchase`; it must not reconstruct fulfillment from browser state.

## Implementation slices

Each slice includes tests and stays at or below 400 changed lines.

1. **Capability persistence:** additive schema/migration plus digest, expiry, caller-binding, and atomic one-use helper tests.
2. **Preparation:** checkout validation to pending Purchase/reference response, with substitution and secrecy tests.
3. **Native consumption/payment:** reference consumption, dynamic Purchase-bound ticket/payment/recovery, and duplicate/stale tests.
4. **Fulfillment proof:** paid webhook exact-selection validation and package/service fulfillment regression coverage.

## Failure and rollback

- Preparation failure occurs before native admission and may use the existing embedded PaymentElement fallback.
- Consumption is the native admission point. After successful consumption, no automatic web fallback is permitted.
- Unknown payment outcomes retain the same Purchase and payment identity for native/server recovery.
- Disabling the native preparation/payment gates stops new admissions without deleting capability, Purchase, PaymentIntent, webhook, or entitlement history.
