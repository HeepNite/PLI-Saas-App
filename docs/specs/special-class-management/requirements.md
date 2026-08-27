# Special Classes Management — Requirements

## Status

`RESOLVED — MANUAL-CAPTURE CONTRACT APPROVED FOR IMPLEMENTATION`

## Outcome

Provide a reusable Special Classes capability for staff-managed, paid one-off classes. Every special class has exactly one canonical `ClassSession`; web checkout and kiosk check-in operate on that same session and therefore share attendance and capacity.

## Scope

### In scope

- Staff creation, editing, publication, cancellation, and roster operations for special classes.
- Public special-class presentation and checkout using the existing checkout, Stripe, `Purchase`, and webhook flows.
- A three-minute maximum online capacity hold, safe expiry/release, and concurrency-safe final-spot claims.
- Session-level capacity, paid/pending/checked-in counts, and attendance operations in the staff panel.
- Kiosk recognition of a special class as a normal selectable `ClassSession`.
- Role-based authorization, audit records, observability, migration/backfill, and focused tests.

### Non-goals

- A parallel payment provider, payment ledger, checkout route, or attendance system.
- Multi-attendee reservations, packages/credits as payment for a special class, waitlists, coupons, automated refunds, or customer self-service cancellation.
- A separate kiosk-only session or special-class capacity counter.
- Replacing ordinary recurring-class scheduling or the existing special Salsa page in the first delivery unit.

## Product rules

1. One reservation represents one attendee.
2. A special class is backed by one canonical `ClassSession`; no second session may be created for web or kiosk use.
3. Capacity is computed from that session's capacity, confirmed reservations, and unexpired holds. No stored or UI-specific counter is authoritative.
4. A successful online checkout initiation creates one internal capacity hold that expires no later than three minutes after admission. Stripe Checkout expiry is independent and must satisfy Stripe's limits.
5. Special-class Checkout uses manual capture with eligible card methods. Authorization is not captured payment and does not reserve capacity after the internal hold expires.
6. Stripe webhook fulfillment is the authority for capacity reconfirmation, capture, and attendance creation/reuse.
7. If an authorization becomes capturable after its hold expires, fulfillment re-admits it only when canonical-session capacity remains. If full, it cancels the authorization, creates no attendance, and records an auditable terminal no-capacity outcome.
8. Kiosk renders and checks in the special session through existing normal-class behavior. A paid web reservation is visible to kiosk through the shared attendance/session data.

## Authorization matrix

| Actor | Create/edit draft | Publish/cancel | View roster/capacity | Check in/manage attendance | Public checkout | Kiosk check-in |
|---|---:|---:|---:|---:|---:|---:|
| Owner | Yes | Yes | Yes | Yes | N/A | Existing staff-terminal policy |
| Admin | Yes | Yes | Yes | Yes | N/A | Existing staff-terminal policy |
| Front desk (`staff`) | No | No | Yes | Yes | N/A | Existing staff-terminal policy |
| Teacher | No | No | No | No | No special access | No special access |
| Student | No | No | No | No | May reserve a published class | Existing student flow only |
| Unauthenticated visitor | No | No | No | No | May reserve a published class | No |

All staff operations must use the existing staff portal authentication and rate-limit patterns. Authorization is server-enforced; hiding a UI control is not authorization.

## Lifecycle

### Special-class lifecycle

```text
DRAFT -> PUBLISHED -> CLOSED
                  \-> CANCELLED
```

- **DRAFT:** staff-only, not public or reservable.
- **PUBLISHED:** publicly discoverable/reservable when its start time is in the future and capacity remains.
- **CLOSED:** no new reservations; roster remains available. It is entered when staff closes sales or the session has started.
- **CANCELLED:** no new reservations/check-ins through this feature; staff receives the roster and existing payment records for manual operational handling. This specification does not automate refunds.

### Reservation lifecycle

```text
ADMITTED_HOLD -> PAID -> CHECKED_IN
       |             \-> CANCELLED_BY_STAFF
       +-> EXPIRED | FAILED | RELEASED
```

- A hold is represented by a pending `Purchase` linked to the special class and expires at its immutable `holdExpiresAt`.
- `PAID` is reached only after signed webhook fulfillment atomically admits capacity, creates/reuses one `Attendance` for the canonical session, and captures the PaymentIntent exactly once.
- A capturable authorization that cannot be re-admitted transitions to an auditable no-capacity terminal state after its authorization is cancelled. Transient capture, cancellation, or identity-resolution failures remain retryable and must not complete the webhook event claim.
- `CHECKED_IN` is the existing attendance check-in state, not a second reservation record.
- Staff cancellation updates the reservation/attendance through existing safe patterns and releases capacity only when the paid reservation is no longer active according to the resolved cancellation policy.

## Functional requirements

### FR-01 — Canonical session and invariants

- Creating a special class creates or associates exactly one `ClassSession` before publication.
- The special-class record and its `ClassSession` are one-to-one. The session retains the existing unique `(courseSlug, startsAt)` identity.
- Public checkout, payment fulfillment, staff roster, and kiosk check-in resolve the same session ID.
- The canonical session capacity must be positive and is the only capacity limit. Any special-class capacity field is prohibited or derived solely for presentation.
- A special class cannot be published when its session is missing, starts in the past, or its required commercial/public fields are invalid.

### FR-02 — Staff management

- Owners/admins can create a draft with a stable slug, title, description, public media, start time, duration, location/room, capacity, currency, price, and sales controls.
- Owners/admins can edit drafts. Published changes that affect time, capacity, price, or availability must be validated and audited before becoming effective.
- Owners/admins can publish, close sales, or cancel a special class.
- Front desk can view the operational list and detail but cannot alter class definition or publication state.

### FR-03 — Public discovery and checkout

- Only published, upcoming, non-cancelled special classes are public and reservable.
- Public pages present server-authoritative facts and availability; clients cannot provide price, currency, session identity, capacity, or hold expiry.
- Checkout reuses `POST /api/checkout/session`, existing guest/account-resolution behavior, Stripe Hosted Checkout, and the signed Stripe webhook.
- Only the special-class branch requests manual capture and restricts Checkout to manual-capture-compatible card methods. Other checkout flows remain unchanged.
- The checkout response returns only the existing safe checkout response shape and no roster or account-existence information.

### FR-04 — Holds, capacity, and concurrency

- Each admitted checkout attempt creates at most one pending `Purchase` for one attendee and one immutable expiry at `now + 3 minutes`.
- The three-minute expiry is an internal capacity lease and must never be sent to Stripe as Checkout `expires_at`; Stripe Session expiry is omitted or independently Stripe-valid.
- The same idempotency key returns/reuses the safe in-progress checkout result and never consumes another spot.
- A customer cannot hold or pay for the same special class twice.
- Counted occupancy equals active paid reservations plus pending holds whose `holdExpiresAt > now`. `failed`, `expired`, released, refunded/cancelled, and expired pending records do not count.
- Admission, duplicate detection, expiry transition, and capacity check occur atomically in a serializable transaction with bounded retry for serialization/unique conflicts.
- The losing concurrent request for the final place receives `409 SOLD_OUT` and no Checkout URL.
- Expiry must be enforced lazily during every admission/read and eagerly by the repository's approved scheduled-job mechanism when available; both mechanisms must be idempotent.

### FR-05 — Payment and attendance synchronization

- A capturable webhook locks the canonical session and linked Purchase in a serializable transaction, validates the immutable checkout amount/currency, and reconfirms the original hold or re-admits capacity before attendance is created.
- Fulfillment creates or reuses exactly one `Attendance(userId, sessionId)` for the canonical session, then captures the PaymentIntent exactly once.
- When no capacity remains, fulfillment cancels the PaymentIntent authorization, creates no attendance, and persists the Purchase as terminal `no_capacity` with an audit record.
- Transient identity, database, capture, or cancellation failures return an error so Stripe retries; the webhook event claim is completed only after the terminal admitted/captured or no-capacity/cancelled outcome is durable.
- Web and kiosk show the same paid and checked-in attendee because they read the same attendance/session relation.
- Failed/expired payment never creates confirmed attendance and releases capacity safely.

### FR-06 — Staff panel and roster

- The staff panel has a Special Classes section with list, detail, create/edit, and roster views.
- List/detail show lifecycle status; session start; capacity; remaining capacity; active holds; paid reservations; pending holds; checked-in count; and operational warnings.
- Roster is limited to authorized staff and includes attendee identity/contact data only as needed for front-desk operations, reservation/payment state, attendance state, timestamps, and permitted actions.
- Owners/admins/front desk can mark check-in, undo an erroneous check-in where current attendance policy permits it, and record supported attendance/cancellation actions. Every mutation records actor, target, before/after state, reason when required, and correlation ID.

### FR-07 — Kiosk compatibility

- A published special class becomes selectable by normal kiosk session-selection rules for its canonical `ClassSession`.
- Kiosk must not branch to a special payment or special attendance implementation.
- Kiosk check-in must preserve the existing duplicate-attendance uniqueness rule and display the result of the canonical attendance record.

## Acceptance criteria

### Scenario: one shared session

```gherkin
Given a published special class has session S with capacity 20
When a visitor reserves and pays online
Then the paid reservation creates or reuses Attendance for S
And kiosk class selection exposes S as a normal class
And staff roster, web availability, and kiosk check-in read the same session and attendance records
```

### Scenario: three-minute final-spot race

```gherkin
Given 19 of 20 places are paid or actively held
When two distinct valid checkout attempts are admitted concurrently
Then exactly one receives a Checkout URL and one pending Purchase hold
And the other receives 409 SOLD_OUT without a Checkout URL
And counted occupancy never exceeds 20
```

### Scenario: hold expiry

```gherkin
Given a pending special-class Purchase expires at T
When availability is read or a new checkout is admitted at or after T
Then the pending Purchase is terminal or non-counting
And its spot is available to a later valid checkout
And no Attendance is created
```

### Scenario: roster authorization

```gherkin
Given a teacher or student requests a special-class roster
When the server authorizes the request
Then it returns 403 without roster data
But an owner, admin, or front-desk user receives only the permitted operational roster
```

### Scenario: webhook replay

```gherkin
Given a paid checkout has a pending reservation for canonical session S
When the signed Stripe completion webhook is delivered twice
Then one Purchase is paid and one Attendance exists for the attendee and S
And paid, checked-in, and remaining counts are consistent
```

### Scenario: authorization arrives after hold expiry

```gherkin
Given Stripe authorized a special-class PaymentIntent after its three-minute internal hold expired
When the signed capturable webhook is processed
Then fulfillment transactionally rechecks the canonical session capacity
And when capacity remains it admits the Purchase, creates or reuses Attendance, and captures exactly once
But when capacity is full it cancels the authorization, creates no Attendance, records terminal no-capacity state, and does not oversell
And transient fulfillment failures preserve Stripe retry semantics
```

## Definition of done

- [ ] All acceptance scenarios and authorization boundaries have automated coverage.
- [ ] A real PostgreSQL concurrency test proves the capacity invariant.
- [ ] Existing checkout, webhook, kiosk, and attendance regressions pass.
- [ ] Audit and metric events are observable without PII or payment secrets.
- [ ] Migration/backfill and rollback steps have been rehearsed in a non-production environment.
