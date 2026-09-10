# Staff Fast Class Payment Specification

## Purpose

Defines how staff Fast Pay, its promo add-on (`createPromoCash`), and Fast Sign-In classify an existing `Purchase` for the current slot: paid (any channel) blocks, cash-processable open reuses, card-in-flight and terminal statuses are ignored — so staff never create a duplicate `Purchase`.

## Requirements

### Requirement: Slot Identity Resolution

The system MUST resolve slot identity as `(userId, courseSlug, metadata.date, metadata.time)` OR a `Purchase` whose `metadata.attendanceId` matches the slot's attendance, independent of `metadata.paymentChannel`, without requiring an existing `Attendance` row.

#### Scenario: Web cash pending purchase matches without an attendanceId
- GIVEN a `Purchase` from web `cash_checkout` matching `userId`, `courseSlug`, `metadata.date`/`time`, with no `metadata.attendanceId`
- WHEN staff presses Fast Pay for that user and slot
- THEN the system MUST match it via slot fields alone, not by attendance

### Requirement: Reuse Existing Pending Purchase

When slot identity resolves an open (non-`paid`, non-terminal) `Purchase` that is cash-processable — `metadata.paymentChannel === "cash"`, or channel `unknown` with no `stripePaymentIntentId`/`stripeCheckoutSessionId` — the system MUST reuse the earliest such match: create/update the `Attendance`, backfill `metadata.attendanceId` when absent, keep the existing `amount`, create no new `Purchase`, and return success. Applies identically to the main handler and `createPromoCash`. A still-open card-channel purchase with Stripe evidence MUST be ignored — neither reused nor blocked.

#### Scenario: Repeat Fast Pay press reuses instead of blocking
- GIVEN a prior Fast Pay press already created a pending cash `Purchase` with `metadata.attendanceId` set
- WHEN staff presses Fast Pay again for the same slot
- THEN the system MUST reuse it and return success — it MUST NOT return `pending_payment`

#### Scenario: Web cash pending purchase is reused and backfilled
- GIVEN a pending web `cash_checkout` `Purchase` matching slot identity with no `metadata.attendanceId`
- WHEN staff presses Fast Pay
- THEN the system MUST backfill `metadata.attendanceId` and return success with no second `Purchase`

#### Scenario: Promo add-on reuses its pending purchase
- GIVEN `createPromoCash` resolves an existing pending `Purchase` for the linked slot
- WHEN the promo add-on runs
- THEN it MUST reuse that purchase, keeping its amount and backfilling `attendanceId` when absent

#### Scenario: Card payment still in flight is ignored
- GIVEN a `Purchase` with Stripe evidence (`stripePaymentIntentId`/`stripeCheckoutSessionId`) and an open, non-terminal status for the slot
- WHEN staff presses Fast Pay
- THEN the system MUST NOT block and MUST NOT reuse it — it MUST create a new pending cash `Purchase` as today

### Requirement: Block on Existing Paid Purchase

When slot identity resolves a `Purchase` whose status is `paid` (per `isCompletedPaymentStatus`), on any `metadata.paymentChannel` (cash, card/Stripe evidence, or `package_credit`), the system MUST return `409` with code `completed_purchase` and MUST NOT create or reuse a purchase. This check takes precedence over the reuse rule above: paid (any channel) → block; else earliest cash-processable open → reuse; else create.

#### Scenario: Stripe-paid slot blocks Fast Pay
- GIVEN a `Purchase` with Stripe evidence (`stripePaymentIntentId`/`stripeCheckoutSessionId`) and completed status for the slot
- WHEN staff presses Fast Pay
- THEN the system MUST return 409 `completed_purchase`

#### Scenario: Package-credit-paid slot blocks Fast Pay
- GIVEN a `Purchase` with `metadata.paymentChannel === "package_credit"` and completed status for the slot
- WHEN staff presses Fast Pay
- THEN the system MUST return 409 `completed_purchase`

### Requirement: Ignore Terminal Failed Purchases

Purchases with status `failed`, `refunded`, or `expired` (the Stripe webhook status for an abandoned checkout session) MUST be excluded from reuse and block classification; the system MUST proceed as if no prior purchase exists.

#### Scenario: Terminal purchase neither blocks nor is reused
- GIVEN the only prior `Purchase` for the slot has status `refunded`, `failed`, or `expired`
- WHEN staff presses Fast Pay
- THEN the system MUST create a new pending purchase

### Requirement: Transactional Concurrency Safety

The reuse-vs-block classification MUST be re-read inside the existing serializable transaction, to catch a purchase that became `paid` between the pre-check and the transaction (e.g. a concurrent customer self-checkout).

#### Scenario: Concurrent self-checkout completes during Fast Pay
- GIVEN a pending purchase for the slot becomes `paid` after the pre-check but before commit
- WHEN the transaction re-reads it
- THEN the system MUST abort the reuse and return 409 `completed_purchase`

### Requirement: Preview and Fast Sign-In Modes Unaffected

`previewOnly` requests MUST classify and short-circuit before any write. When a usable package exists, `fast_sign_in` mode MUST keep using package-credit reservation, unaffected by this guard.

#### Scenario: previewOnly short-circuits before any write
- GIVEN `previewOnly: true` and an existing paid purchase for the slot
- WHEN staff previews Fast Pay
- THEN the system MUST return the 409 classification with no database write

#### Scenario: Fast Sign-In bypasses the purchase guard
- GIVEN the user holds a usable package for the current class
- WHEN staff triggers the action
- THEN the system MUST use `fast_sign_in` mode and package-credit reservation

### Requirement: Security Boundary Unchanged

The guard MUST run only inside the existing staff-authenticated route (`withStaffGuard`, rate limit 60/60s) and MUST NOT introduce a new endpoint or relax authorization.

#### Scenario: Unauthenticated request is rejected before classification
- GIVEN a request without valid staff authentication
- WHEN it hits the Fast Pay endpoint
- THEN the system MUST reject it before any purchase classification runs
