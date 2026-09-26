# Requirements: internal USD 1 general-class-credit preparation

## Confirmed scope

The user has superseded the former Stripe-only/no-benefit contract. USD 1 is now a genuine, finite entitlement sale: it buys exactly one general class credit for one existing student selected and immutably bound before PaymentIntent creation. This documentation and planning change authorizes no source, provider, database, device, deployment, or activation operation.

Parent-supplied evidence confirms idempotent creation of one Product and one Price, followed by GET verification under the same LIVE merchant; this documentation task made no API calls.

- Product: `prod_VJV0rf6b1sjK9x`, `PLI — Internal Purchase USD 1`.
- Price: `price_1UIs02RtYdjwed35ZB3jho1F`, lookup key `pli_internal_usd1_live`, `unit_amount: 100`, `currency: usd`, `type: one_time`, `active: true`, `livemode: true`.

The product's former no-benefit description is historical evidence, not fulfillment authority. Before activation, catalog-facing wording and metadata must accurately represent the one-credit entitlement under a separately authorized provider change.

Target: Palladium Latin Art, LIVE account `acct_1PWRzcRtYdjwed35`; school location `tml_GqQ6wPY5rSAhAt`. Work remains on `feat/native-m2-live-preparation`, based on MAIN `87563a6ce50ae8af584f4fa842a96e7f84158983`.

Creating a catalog object does not authorize a LIVE charge, refund, card collection, deployment, or production database write. Those remain separately gated.

## Required behavior for the proposed local integration

| Boundary | Acceptance criterion |
| --- | --- |
| Price authority | The server selects an approved Stripe Price ID and verifies it under the intended LIVE account: LIVE Product/Price, both active, one-time, USD, exactly 100 cents. Missing or mismatched evidence fails closed. |
| Client input | No client amount, currency, or arbitrary Price ID may override the approved server selection. Existing class checkout pricing remains unchanged. |
| Caller authority | Reuse MAIN's authenticated, active staff-terminal session and rate limiting. Derive terminal identity from authorization, not request fields. Preserve internal gateway authorization wherever delegation is used; never expose that secret to a device. No public LIVE debug route or TEST bearer reuse. Native session transport remains outside this backend slice. |
| Attempt identity | Retain one attempt identity, idempotency key, and PaymentIntent association through retry/restart. Unknown outcome must recover the same payment, never automatically create a replacement charge. |
| Result authority | Client success alone cannot mark payment complete. A fresh server-verified Stripe PaymentIntent status governs completion; an idempotent creation response may contain historical state. |
| Credit binding | Before creating payment, an authenticated staff-terminal operator selects exactly one existing student. Bind that student and one finite general class credit immutably to the pending purchase/attempt; neither the client nor a retry may substitute a student, quantity, price, or credit type. |
| Purchase and payment identity | Reuse the pending `Purchase` endpoint semantics and retain one stable idempotency identity across retry/restart. Reuse the same pending `Purchase`, never create a replacement for an unresolved outcome. Stripe/server-verified PaymentIntent status remains payment authority. |
| Fulfillment | A paid, correctly bound purchase invokes `syncPackagePurchaseFromPaidPurchase` to create exactly one finite-credit `PackagePurchase`. This is an explicit internal-webhook fulfillment path, not ordinary class checkout, attendance, enrollment, or generic webhook behavior. |
| Recovery | Never use an in-memory attempt map as durable authority. Validate terminal ownership, immutable student/credit binding, amount, currency and LIVE mode before exposing a recovered PaymentIntent's client secret. Known payments must be retrieved, not replaced. Expired or unresolved attempts outside Stripe's finite idempotency retention must fail closed for operator reconciliation. |
| Reversal | On a refund or dispute, atomically revoke only an unused credit. If the credit is consumed, its state is ambiguous, or the relevant linkage cannot be proven, preserve payment and entitlement history and require manual resolution. |
| Webhook isolation | Preserve signature verification and ordinary transaction handling. Recognized internal-flow events use the explicit internal fulfillment/reversal path and must not fall into ordinary class checkout processing. Malformed or unproven reserved markers fail closed. |
| Student lookup boundary | Expose lookup and selection only through the narrow authenticated staff-terminal boundary. It may return only the minimum existing-student information needed to select and bind a student; it must not grant or proxy broad staff-portal access. |
| Schema and concurrency | B2 requires an additive `StripeWebhookEvent` purchase binding and durable resolution-reason fields. Preserve existing records and compatibility; a local additive migration is authorized but must not run against production. Use transactional guarded updates and prove provider-event/database idempotency in tests. |
| Release | The feature flag defaults OFF and fails closed before any provider operation. Enabled operation requires production configuration, a separate dedicated LIVE runtime credential, verified merchant/catalog/location and separate activation approval. Connection-token acquisition does not create a payment. Catalog creation alone cannot enable collection. |
| Isolation | Preserve MAIN, the prototype, TEST configuration and the existing web/QR checkout. No wholesale prototype merge or unrelated migration deletion. |

## Permissions and non-goals

- The user added and confirmed Products Write and Prices Write on the existing restricted setup key through the Dashboard. The key remains outside repositories at its unchanged path; these are catalog-setup permissions, not runtime PaymentIntent or connection-token authorization. This task reads no keys.
- Runtime connection-token and PaymentIntent permissions, any required catalog/provider reads, and webhook configuration need a separate bounded credential/access approval. No full-access key assumption or automatic permission escalation.
- Implementation is awaiting user acceptance of this reconciled scope. When authorized, local backend and mocked tests may implement the ordered units below. No SQL/schema change is authorized without its explicit justification; no production database access, secret/environment edits, device operations, staging, commits, deployment or real provider calls are authorized.
- If dependencies are needed, only an isolated installation from the unchanged lockfile is permitted, with a cost forecast first. Never share or regenerate another worktree's Prisma client. Do not load production environment files or run a production build.
- No real PAN handling or storage. No deadline or payment-readiness promise.

## Retained implementation evidence — former no-benefit contract

- [x] Record Product/Price IDs after authorized creation and same-account verification reported by the parent.
- [x] With fixtures, reject wrong account/mode/currency/amount, inactive or recurring prices, and client overrides.
- [x] With mocked dependencies, deny unauthorized or terminal-assignment-mismatched callers before provider access; connection-token creation requires a fresh successful preflight.
- [x] With mocks, prove stable idempotency keys across retry/restart/concurrency, known-ID retrieval, authoritative current status and no replacement creation after an expired unknown result.
- [x] With mocks, prove signature-first internal webhook isolation without application side effects, unchanged ordinary checkout processing, and default-OFF creation gates.

The existing action route supports signed attempt issuance, payment-intent preparation and read-only recovery. Both feature flags default OFF; no runtime settings are provided. `paymentCreationEnabled` reports the payment flag, not hardware/payment readiness. Backend tests, existing checkout/auth/token/webhook regressions, full typechecking and touched-file lint passed for the former no-benefit contract. They do not prove the new purchase-binding, credit-fulfillment, or reversal behavior. No real payment, provider operation, production database access or physical M2 validation has occurred.

## Superseding entitlement decision and ordered execution boundary

The earlier Stripe-only ledger decision is superseded only for this USD 1 flow. The new contract requires the selected existing-student binding, reusable pending `Purchase`, finite-credit `PackagePurchase`, and explicit internal fulfillment described above. MAIN's existing staff-terminal authorization remains the selected caller boundary. See [resolve.md](resolve.md) for reuse limits and [the ODD task document](../../../odd/tasks/native-m2-live-internal-purchase.md) for the acceptance-pending, reviewable order: backend binding/fulfillment, reversal, native student selection/operator integration, then separately approved physical M2 activation and validation.

## Authorized B2 reversal correction — pre-write contract

The user authorized B2's additive fields and local migration planning before source/schema writes. The accepted USD 1.00 / one-general-credit contract and B1's runtime Elvira Gutierrez selection by existing complete-phone identity remain unchanged; B2 must not hardcode personal data or replace the selected binding.

- Add an additive `StripeWebhookEvent` → purchase binding and durable resolution-reason fields. Existing webhook and purchase rows remain readable under the migration; no destructive rewrite, backfill assumption, or production migration execution is authorized.
- Classify ordinary refund/dispute events locally from their verified event shape and known internal binding **before** any provider retrieval. Unrelated ordinary checkout handling remains unchanged; only proven internal events enter B2 reversal processing.
- A successful reversal writes a durable reversal tombstone in the same guarded transaction. The tombstone blocks every later paid fulfillment or credit regrant for that purchase, including out-of-order paid-after-reversal delivery and concurrent webhook delivery.
- A consumed, ambiguous, or otherwise non-revocable entitlement reaches a terminal manual-resolution state with a durable reason. That terminal state is excluded from retry reclaim; later duplicate/retry events may observe it but cannot reopen, revoke again, fulfill, or regrant.
- Route every package-credit consumption path through shared guarded transactional helpers. No alternate consumption path may consume a credit after reversal, bypass the tombstone, or race a reversal decision.

### B2 strict-TDD acceptance cases

Before implementation, add the smallest behavior tests and observe RED for: additive binding/reason persistence; refund and dispute local classification without provider retrieval; unused-credit reversal; consumed/ambiguous terminal manual resolution with retry-reclaim exclusion; duplicate delivery idempotency; paid-before-refund, refund-before-paid, and concurrent paid/refund ordering; and every package-credit consumption entry point racing or following a reversal tombstone. GREEN must cover the same cases using transactional test doubles; PostgreSQL concurrency remains a stated unexecuted limitation unless separately authorized.

### B2 rollback and migration compatibility

The migration must be additive and reversible by disabling B2 behavior while retaining the new columns, webhook bindings, tombstones, and resolution history for reconciliation. Do not drop fields, erase financial/entitlement history, or run the migration in production as rollback. Local migration generation/application, if later needed, requires the explicitly authorized local command and compatibility verification against pre-existing rows; production execution remains separately gated.

## Authorized Android foundation (native unit 1)

- Android only, no default host. Require an explicitly approved HTTPS origin. Only the existing staff-session login and internal-purchase action paths may receive requests; redirects are forbidden.
- Obtain this application's own `pli_terminal_session` from the login response Set-Cookie, never browser storage or JSON. Encrypt cookie and attempt state in private, backup-excluded storage with an Android Keystore key. Never persist PINs, client secrets or card data.
- Serialize login and purchase actions. Do not replace a session, clear state or issue another attempt while an outcome is unresolved. Missing original session, corrupt storage and failed writes block further operation and require reconciliation.
- Persist ticket, fixed expiry, reader/location and original origin/session association before requesting a PaymentIntent. Persist the returned ID before any future SDK collection. Restart uses known-ID recovery only, or same-ticket replay while an unknown-ID ticket is fresh. Expired unknown outcomes never create replacements.
- Only a fresh, consistent server response can establish Paid. SDK completion is not payment authority. Preserve resolved records too; this unit exposes no reset operation.
- Reader policy requires a provisioned LIVE reader ID matching the ticket plus connected serial `STRM2D533025669`, M2 type and approved location. Discovery identifiers and connection-token location are insufficient. No LIVE reader ID is provisioned here.
- Collection remains disconnected and disabled in this unit. BLE connection, collection lifecycle and temporary operator UI belong to native unit 2. Tests use fixtures only; no login, operational network, installation or activation is authorized.

## Native unit 2 (N5) retained preparation evidence

The following N5 boundary was established before the entitlement decision and remains evidence for safe native collection-context handling. It does not authorize collection, fulfillment, or activation. The native student-selection/operator integration is now a later ordered unit and must incorporate the immutable pre-payment student binding. Actual LIVE collection remains outside implementation and activation gates; no device, provider, network, staging, installation, activation, or LIVE charge test is authorized.

| N5 boundary | Acceptance criterion |
| --- | --- |
| Operator surface | Provide an Android-only operator-facing surface that states the disabled state and exposes only simulated/fake-driven lifecycle behavior. It must not expose a path that can collect, confirm, or otherwise create a LIVE payment. |
| Terminal boundary | Use the already-present Stripe Terminal SDK only behind a narrow adapter boundary. The operator/coordinator depends on that boundary, so tests can use fakes without SDK, reader, or network access. |
| BLE recovery | Require an explicit manual BLE reconnect after a reader disconnect. Never silently reconnect or reuse a previously connected reader as current collection authority. |
| Collection context | Treat collection context as invalid on reader disconnect, application backgrounding, authenticated session change, configured/observed reader change, or expiry. Invalidation blocks collection and does not erase the durable unresolved attempt. |
| Fresh authorization | After reconnect or application resume, require a fresh server-authorized context and current reader/session validation before any future collection could be enabled. A cached ticket, client secret, SDK completion, or prior preflight is insufficient. |
| Recovery and authority | Preserve N4's encrypted durable unresolved-attempt recovery and server/Stripe authority. Recover known attempts read-only; never create a replacement payment or infer Paid from SDK/UI state. |
| Tests | Cover the adapter and lifecycle with fakes/simulation only, including every invalidation trigger and manual reconnect/resume path. No physical M2, BLE, provider, operational network, or LIVE collection test is permitted. |

## Accepted N6 production-composition contract (source work pending)

N6 is the accepted, later Android source-composition unit. It supersedes N5's hard-disabled collection boundary only when the separately compiled native-collection flag is explicitly enabled; it does not satisfy T7b and authorizes no installation, device/BLE operation, provider operation, deployment, activation, or charge.

| Boundary | Acceptance criterion |
| --- | --- |
| Build-time origin and flags | The approved HTTPS origin is a build-time value with a blank default that fails closed. It must be an HTTPS origin and must not be replaced by runtime input, redirects, or a fallback host. A separate native collection build-time flag defaults OFF; origin approval alone cannot enable collection. |
| Session and initialization | Reuse only the original encrypted staff session associated with the unresolved attempt and approved origin. A missing, changed, expired, corrupt, or replacement staff session blocks collection and requires recovery/reconciliation; N6 must not silently log in again or replace the session. Initialize `Terminal` exactly once per process with the application `ConnectionTokenProvider`; no screen, reconnect, or attempt may initialize the SDK again. |
| Reader policy | Request runtime Bluetooth permissions before discovery or connection. Discover using `BluetoothDiscoveryConfiguration(timeout, false)` and require explicit operator reader selection. The selected reader must satisfy the existing provisioned LIVE reader ID, connected serial `STRM2D533025669`, M2 type, and approved location policy. Discovery metadata, a connection token, or an SDK location alone is insufficient proof. |
| Connection | Connect only through an explicit `connectReader` call using `BluetoothConnectionConfiguration(locationId, false, listener)`. The `false` reconnect setting is mandatory. Reader disconnect, failed connection, changed reader, session change, backgrounding, or expiry invalidates collection context. The operator must deliberately rediscover and reconnect; no automatic reconnect, stale-reader reuse, or reader replacement attempt is allowed. |
| Payment composition | After durable server creation/replay has persisted the PaymentIntent ID, retrieve it with `retrievePaymentIntent(clientSecret)`, then call `collectPaymentMethod` and `confirmPaymentIntent` for that same intent. Keep the client secret transient: do not persist, log, return through UI state, or reuse it for a known-ID recovery. No SDK result can create a new attempt or establish Paid. |
| Timeout, cancellation, and recovery | Collection has a local 90-second limit. Retain each Terminal operation's `Cancelable`; on expiry, explicit cancel, disconnect, or lifecycle invalidation, cancel the active operation, wait for its terminal callback, and perform fresh server recovery of the same durable PaymentIntent. Cancellation is not a payment result and must not create a replacement attempt, reconnect automatically, or erase unresolved state. |
| Paid authority | Only a fresh, consistent server recovery/verification response for the original session, ticket, reader, immutable student binding, and PaymentIntent may transition the UI to Paid. `collectPaymentMethod`, `confirmPaymentIntent`, a callback, or any local SDK/UI state is never Paid authority. |

### N6 operator state model

- **Operator login:** `NoSession` → `LoggingIn` → `SessionReady`, or `LoginBlocked`. Login is allowed only before an unresolved attempt; session replacement while unresolved enters `RecoveryRequired`.
- **Discovery:** `DiscoveryIdle` → `Discovering` → `ReaderSelected`, or `DiscoveryBlocked`. Permission denial, no compliant reader, or invalid context returns to `DiscoveryBlocked` without attempting collection.
- **Connection:** `ReaderSelected` → `Connecting` → `Connected`, or `ReconnectRequired`. Disconnect/failure always requires an operator-initiated discovery/connect cycle.
- **Confirmed student:** `StudentUnconfirmed` → `StudentConfirmed` only after the server has immutably bound the existing student and one general credit to the durable pending purchase. Student changes after confirmation require recovery/reconciliation, never local substitution.
- **Start:** `ReadyToStart` → `IntentDurablyCreated` → `RetrievingIntent` → `Collecting` → `Confirming` → `Recovering`. Start is legal only with collection flag enabled, original session, compliant connected reader, confirmed student, and durable PaymentIntent ID.
- **Cancel:** `Collecting` or `Confirming` → `Cancelling` → `Recovering`; cancellation retains the attempt and uses the active `Cancelable`.
- **Recover:** `RecoveryRequired` or `Recovering` → `Paid`, `Unresolved`, or `ManualReconciliation`. Only the fresh server result selects the terminal state; `Unresolved` never auto-starts, reconnects, or replaces the PaymentIntent.

### N6 strict-TDD checklist and rollback

1. **RED:** add focused fake-adapter/coordinator tests for blank/non-HTTPS origin rejection, native collection flag OFF, one-time `Terminal.init`, original-session rejection, Bluetooth permission gating, and the exact discovery/connection configuration values; observe failure before implementation.
2. **GREEN:** implement the smallest composition that passes those tests, including explicit compliant-reader checks and no automatic reconnect/replacement path.
3. **RED:** add tests for the ordered retrieve/collect/confirm sequence on one durable PaymentIntent, transient client secret handling, and server-only Paid authority; observe failure.
4. **GREEN:** implement that sequence behind the adapter and prove fresh server recovery controls `Paid`, `Unresolved`, and manual-reconciliation outcomes.
5. **RED:** add fake-clock tests for the 90-second limit, explicit cancel, disconnect/background/session invalidation, `Cancelable` invocation, callback completion, and same-ID recovery; observe failure.
6. **GREEN:** implement cancellation/recovery without state erasure, replacement intent creation, automatic reconnect, or automatic reader substitution; run the focused fake-only suite.
7. **TRIANGULATE/REFACTOR:** cover alternate permission, reader, session, server-status, cancellation-race, and restart paths; retain the narrow adapter and state transitions only while tests remain green.

Rollback is a build-time disable of the separate native collection flag. It must immediately block new native collection while preserving the original session association, durable unresolved attempt/PaymentIntent ID, and server-only recovery path for reconciliation. Rollback must not clear encrypted state, synthesize cancellation/refund/Paid, remove the approved-origin fail-closed default, or satisfy T7b. Re-enabling collection later requires a new explicit approval and the same original-session, reader, and fresh-server checks.

### Self-service post-payment rollover

A fresh server-authoritative `Paid` result must end the active device collection context and return the kiosk to a clean self-service start state without front-desk enablement or cashier participation. Stripe and the backend retain the financial, Purchase, entitlement, and webhook history. Before another purchase can begin, the device must discard the prior student's selection and the completed local attempt binding, require a new student lookup/confirmation, and create a new signed attempt through the ordinary server path. Rollover is never available from `Unresolved`, `ManualReconciliation`, cancellation, SDK completion, or an uncertain callback; those states retain the same PaymentIntent and remain blocked for recovery or reconciliation. Deployment feature flags remain global activation controls, not per-transaction staff actions. Every listener that can render Android UI must be delivered on the UI thread.
