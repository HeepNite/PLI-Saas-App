# Design: exact-total native M2 purchase preparation

## Purpose

This design defines the smallest reuse-first transition from the historical fixed USD 1 internal purchase to the active `/staff/terminal` contract. It does not authorize deployment, provider access, device activity, feature-flag changes, or a LIVE charge.

## Existing contracts to reuse

- `/api/checkout/intent` remains the server-authoritative validator for the current course, service, package, add-ons, participants, coupon, account, and calculated total.
- `Purchase` remains the durable immutable purchase/fulfillment record and stable payment idempotency owner.
- `/api/kiosk/terminal/internal-purchase` remains the authenticated staff-terminal/native payment and recovery boundary.
- Existing Stripe webhook processing and `syncPackagePurchaseFromPaidPurchase` remain fulfillment authority after a server-verified paid event.
- Existing native durable state continues to own the post-admission ticket and PaymentIntent identity. JavaScript never receives those values.

## Android native session and prepared transport seam

The exact-total Android transport receives a raw Cookie header only from future native `CookieManager` host wiring. It parses exactly one literal `pli_terminal_session` pair, rejects controls, quotes, malformed/duplicate/variant names, computes the existing SHA-256 association, and binds `StaffSession.origin` to the constructor `ApprovedOrigin` rather than input. The importer neither calls `CookieManager` nor accepts an origin. Its 15-minute fixed local capture TTL is conservative because CookieManager does not expose `Max-Age`; it uses checked addition and does not supersede server validation. The future host persists this value encrypted before bridge admission. `PreparedPurchaseApi` is separate from legacy phone/student actions. Its closed action payloads are `prepared-attempt` plus the opaque reference, `prepared-payment-intent` plus ticket and optional known ID, and `prepared-recover` plus ticket and required known ID. It parses closed ticket/payment/recovery responses with strict UTF-8 non-lenient `JsonReader` streaming to EOF, rejecting duplicate/unknown/nested/wrong-type fields, malformed strings/escapes/surrogates, trailing content, and recovery client secrets. Bridge dispatch and coordinator/host wiring remain separate work.

The local prepared bridge registry allowlists only `startPreparedPurchase` with exactly `preparedPurchaseReference` and `getPreparedPurchaseState` with exactly `operationReference`. It generates the bounded opaque operation reference from the accepted request before launch, rejects a generated-reference collision before insertion or launch, reserves every accepted reference without eviction in a bounded synchronized context registry, and starts one asynchronous server-recovery workflow with both exact references without waiting for network completion. Polling recognizes only an owned current reference and returns coarse `PENDING`, `PAID`, or `REJECTED`; invalidation poisons late completions. `PAID` may come only from the injected fresh server-authoritative recovery completion bound to that reservation, never an SDK/local callback. Duplicate-request caching retains only a SHA-256 digest of the validated UTF-8 raw bytes plus the coarse response, never raw request/capability bytes. No host, coordinator, reader, SDK, provider, or collection composition is included.

## W3m internal prepared workflow

An unhosted native-only workflow schedules bridge admission off the dispatch thread. It consumes the opaque reference once, obtains only the coordinator's internal unresolved `PREPARED` attempt, creates and initializes one ticket-bound collection runtime, then starts one pinned bootstrap. Only bootstrap readiness may request transient collection material and pass that exact durable attempt/client secret to that runtime. Runtime `PAID` is provisional until a second fresh coordinator recovery durably returns `PAID`; `UNRESOLVED`, `RECONNECT_REQUIRED`, manual reconciliation, and all failures are coarse terminal rejection. No host attachment, secret persistence, or JS exposure is included.

## Invisible prepared-reader bootstrap seam

A fakeable Android-only callback seam accepts one unresolved `PREPARED` ticket with strictly future expiry and its provisioned reader ID; its injected clock defaults to production time. It revalidates that context before discovery, every discovery update, and connection/continuation acceptance. It reuses immutable `ConnectedReader` fields and `ReaderPolicy`, selects exactly one compliant discovery result without probing candidates, and freezes its complete first accepted immutable list; any later full-list change, including unrelated entry changes, fails closed, while a stable unrelated entry is allowed. Permission denial, discovery/connect failure, disconnect, lifecycle/session/ticket invalidation (including from idle), or duplicate/late callbacks fail closed into recovery; it never retries candidates, reconnects, issues an attempt, exposes a secret, or claims `Paid`. Host/bridge and Terminal SDK composition remain later work.

## W3n same-runtime bootstrap adapter

`NativeCollectionBootstrapRuntime` adapts permission, discovery, exact-reader selection, and connection to the same initialized `NativeCollectionRuntime` that later performs collection. It never creates a second Terminal path and never auto-reconnects. Operation-scoped state observation is additive and explicitly unsubscribable, preserving the existing owner listener while mapping only `CONNECTED`, pre-connection failure, and post-connection disconnect into the bootstrap callbacks. Production workflow, permission-result routing, lifecycle invalidation, and WebView attachment remain later composition work.

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
