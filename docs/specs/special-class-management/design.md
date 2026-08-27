# Special Classes Management — Design

## Design summary

Build a small special-class aggregate around existing `ClassSession`, `Purchase`, `Attendance`, checkout, webhook, kiosk, and staff authorization contracts. The aggregate adds class-specific metadata and lifecycle, not a parallel booking or payment system.

## Domain boundaries

| Component | Responsibility | Must not do |
|---|---|---|
| `SpecialClass` | Lifecycle, public/commercial metadata, links to its canonical session | Store a second capacity or attendance counter. |
| `ClassSession` | Time, duration, room/location, authoritative capacity, kiosk selection | Know whether attendance originated on web or kiosk. |
| `Purchase` | Paid/pending reservation, price, Stripe linkage, hold expiry | Create attendance before webhook confirmation. |
| `Attendance` | Reservation/check-in presence for one attendee/session | Count capacity independently of purchases. |
| Reservation service | Serializable admission, idempotency, expiry/release | Call Stripe inside a database transaction. |
| Webhook fulfillment | Signed payment completion and attendance synchronization | Recompute client-supplied price or create a second session. |
| Staff service | Authorized management, summaries, roster mutation/audit | Bypass attendance and payment invariants. |

## Data shape

```text
SpecialClass 1 ---- 1 ClassSession
SpecialClass 1 ---- * Purchase
ClassSession 1 ---- * Attendance
Purchase (paid) ---- 1 attendee represented by Attendance(userId, ClassSession.id)
```

Proposed `SpecialClass` fields: `id`, `slug`, `status`, `classSessionId`, `title`, `description`, `coverImageUrl`, `currency`, `priceCents`, `salesOpenAt`, `salesCloseAt`, `publishedAt`, `cancelledAt`, `createdBy`, timestamps. Add only fields required by the staff/public experiences; do not duplicate session capacity or time.

## State and synchronization model

| Event | Purchase | Attendance | Capacity effect |
|---|---|---|---|
| Checkout admitted | `pending`, immutable `holdExpiresAt` | None | Counts while unexpired |
| Stripe authorization | pending/authorized, not captured | None | Counts only while the internal hold is valid |
| Capturable webhook, capacity admitted | durable paid after capture | Create/reuse canonical-session attendance | Counts |
| Capturable webhook, capacity unavailable | terminal `no_capacity` after authorization cancellation | None | Does not count |
| Stripe failure/expiry | terminal non-paid | None | Does not count |
| Hold reaches expiry | `expired` conditionally | None | Does not count |
| Kiosk/front-desk check-in | unchanged paid state | Existing attendance becomes checked in | Still counts |
| Staff cancellation | resolved terminal/refund state | Existing policy-driven cancellation state | Does not count only after cancellation is final |

All summaries are query projections over `ClassSession.capacity`, `Purchase`, and `Attendance` at one server timestamp. Cache invalidation, if introduced later, is non-authoritative.

## Transaction and failure path

```text
public checkout request
  -> validate + resolve identity
  -> serializable reservation admission
       -> resolve SpecialClass + ClassSession
       -> expire stale holds
       -> duplicate/idempotency check
       -> capacity check
       -> create/recover pending Purchase
  -> commit
  -> create/recover manual-capture Stripe Checkout Session using purchase idempotency key
       -> card methods only
       -> no three-minute Stripe expires_at
  -> persist Stripe session ID or fail pending hold

Stripe capturable webhook
  -> verify signature + claim event
  -> resolve user without completing event claim on failure
  -> serializable capacity reconfirmation
       -> validate immutable Purchase amount/currency/class/session
       -> admit valid hold or re-admit expired hold when capacity remains
       -> create/reuse Attendance and admission audit
       -> otherwise persist audited no-capacity state with no Attendance
  -> admitted: capture PaymentIntent exactly once
  -> no capacity: cancel PaymentIntent authorization exactly once
  -> complete event claim only after the corresponding Stripe action succeeds
```

## API and UI response boundaries

- Public detail: title, description/media, session facts, price, availability state. No roster, attendee, internal IDs, or account-existence signals.
- Staff list: class status, session time, capacity/remaining/holds/paid/checked-in derived at request time.
- Staff roster: authorized operational fields only; actions require an idempotency key and a reason for cancellation or reversal.
- Errors: `404` not public/published or unknown, `409` sold out/in progress/already reserved, `403` staff authorization, `422` invalid staff transition, `429` rate limited. Map messages through existing response conventions.

## Security and audit rules

- Authenticate staff server-side before querying roster data.
- Use the existing staff role/category claims and terminal policies; never trust role data from the browser.
- Validate UUIDs, slugs, status transitions, money integers, session times, and action reasons server-side.
- Use Stripe webhook signature verification before paid mutations.
- Store audit snapshots with stable identifiers and redacted values; log correlation IDs rather than PII.
- Generate operation IDs server-side. Client idempotency values may deduplicate an operation but never choose the audit identity. Every successful mutation has one audit record containing every Purchase and Attendance state changed by that operation.

## Test strategy

| Layer | Coverage |
|---|---|
| Unit | Lifecycle transitions, authorization policy, capacity predicate, expiry boundaries, price validation, audit payload redaction. |
| Database integration | Serializable final-spot race, idempotency, stale-hold release, same-user duplicate prevention, migration/backfill reconciliation. |
| API | Staff guards/role matrix, public publication visibility, checkout error contracts, roster action validation. |
| Webhook | Signed completion, failure/expiry, replay idempotency, canonical session preservation. |
| Component/E2E | Staff summary/roster access and actions; public availability; kiosk selection/check-in regression through shared session. |

## Operational rollout

1. Ship schema plus read-only/backfill tooling behind no public generic route.
2. Validate Salsa reconciliation and staff read model.
3. Enable staff create/publish and roster operations.
4. Enable generic public checkout and webhook recognition.
5. Verify kiosk observes the same session/attendance in a controlled environment before broader release.

Rollback reverses traffic/features, not durable financial or attendance history.
