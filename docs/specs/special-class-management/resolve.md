# Special Classes Management — Resolution

## Resolution status

`RESOLVED — READY FOR IMPLEMENTATION PLAN EXECUTION`

## Decisions

### D-01 — Aggregate and canonical identity

Add a `SpecialClass` record with a required, unique `classSessionId` relation to `ClassSession`. It owns lifecycle, public copy/media, checkout configuration, and sales controls. `ClassSession` remains the sole owner of start, duration, room/location, and capacity.

`Purchase` receives nullable `specialClassId`, nullable `classSessionId`, and nullable `holdExpiresAt` fields. The two IDs are written from the resolved `SpecialClass`, must agree with its canonical session, and are indexed for capacity/roster queries. `Purchase.participants` is fixed to `1` for this module.

### D-02 — Lifecycle states

- `SpecialClass.status`: `draft | published | closed | cancelled`.
- Reservation `Purchase.status` continues using existing terminal/payment vocabulary. Module-specific reservation state is derived from status plus `holdExpiresAt`; no second reservation table is introduced.
- Attendance continues using its current status model. A paid reservation creates/reuses one scheduled/check-in-capable attendance according to existing booking conventions.

### D-03 — Capacity formula and holds

At one captured transaction timestamp, a special class is full when:

```text
count(Purchase where specialClassId = X and
  (status is durable-paid OR (status = pending AND holdExpiresAt > now)))
>= ClassSession.capacity
```

The hold expires exactly three minutes after successful admission. `holdExpiresAt`, rather than `createdAt`, decides whether it counts. Expiring a hold is an idempotent conditional transition from `pending` to `expired`; reads/admissions must exclude it even if asynchronous cleanup is late.

### D-04 — Atomic admission and Stripe recovery

The reservation service performs identity resolution before admission, then a bounded-retry serializable transaction that:

1. loads the published, future, non-cancelled special class and canonical session;
2. expires the caller's stale same-attempt hold if present;
3. recovers a valid same-attempt hold or rejects a duplicate attendee reservation;
4. expires stale holds relevant to the capacity query;
5. counts the formula in D-03 and creates one pending `Purchase` with an immutable expiry and idempotency key;
6. commits before Stripe is called.

Stripe Session creation/recovery uses that purchase's idempotency key and persisted amount/currency. The special-class branch uses manual capture and eligible card methods only. The internal three-minute `holdExpiresAt` is never passed as Stripe Checkout `expires_at`; Stripe expiry is omitted or independently valid under Stripe's limits. A Stripe failure marks only the still-pending hold failed.

When Stripe reports that the PaymentIntent authorization is capturable, fulfillment uses a bounded-retry serializable transaction to lock/reload the linked Purchase, SpecialClass, and canonical ClassSession. It validates the immutable Purchase amount/currency and participant/session links. An unexpired original hold is admitted; an expired hold is re-admitted only when the D-03 occupancy formula remains below capacity. Successful admission creates/reuses canonical Attendance and records an admission audit before the PaymentIntent is captured exactly once.

If capacity is unavailable, fulfillment creates no Attendance, persists terminal `no_capacity` state and audit, and cancels the PaymentIntent authorization. Capture/cancel/user-resolution failures are transient: the event claim remains incomplete so Stripe can retry. The claim becomes complete only after either admitted attendance plus successful capture or durable no-capacity state plus successful authorization cancellation. Authorization alone never counts as paid or occupied capacity.

### D-05 — API contracts

Reuse the existing checkout endpoint with an additive request:

```json
{ "checkoutKind": "special-class", "specialClassSlug": "<public-slug>", "attemptId": "<UUID>", "name": "...", "phone": "...", "email": "..." }
```

The server resolves class, price, currency, session, capacity, and expiry. It rejects/ignores all browser-supplied overrides.

Add staff-only routes under `/api/staff/special-classes`:

| Contract | Authorization | Purpose |
|---|---|---|
| `GET /api/staff/special-classes` | owner/admin/staff | Paginated operational list and derived summaries. |
| `POST /api/staff/special-classes` | owner/admin | Create draft plus canonical session. |
| `GET/PATCH /api/staff/special-classes/:id` | GET owner/admin/staff; PATCH owner/admin | Detail and allowed lifecycle/definition changes. |
| `GET /api/staff/special-classes/:id/roster` | owner/admin/staff | Minimal authorized roster. |
| `POST /api/staff/special-classes/:id/roster/:attendanceId/actions` | owner/admin/staff | Supported attendance/check-in/cancellation action, idempotency key, reason when required. |

All routes use existing staff guards, validation, response/error conventions, rate limiting, and audit pattern. Public queries return presentation/availability only and never roster data.

Published capacity changes use the same serializable locking boundary as checkout admission. A change cannot commit below active paid occupancy plus unexpired holds. Cancelled classes are excluded from kiosk selection and reject roster check-in.

### D-06 — Staff and kiosk UI boundaries

The staff panel gets a Special Classes navigation entry and bounded list/detail/roster screens. It uses the staff API only. The public site gets generic published-special-class pages that call existing checkout. Kiosk receives no special module UI: it sees the canonical `ClassSession` through normal selection and check-in surfaces.

### D-07 — Audit and observability

Create a dedicated `SpecialClassAuditLog` or extend the repository's equivalent audit storage with: special class/session/purchase/attendance reference, action, actor Clerk ID/role, prior/next state snapshots, reason, correlation ID, and timestamp. Never log contact values, Stripe secrets, or raw webhook bodies.

Emit structured, redacted events/counters for admission outcome, hold expiry/release, payment fulfillment, capacity conflict, roster mutation, and authorization denial. Alerting thresholds are operational configuration, not a product behavior change.

### D-08 — Migration and backfill

1. Add nullable relations/expiry and the new `SpecialClass`/audit model in a backward-compatible migration.
2. Create the Salsa `SpecialClass` linked to its existing canonical `(courseSlug, startsAt)` session. If no session exists, create it once with the existing Salsa values.
3. Backfill identifiable Salsa purchases with the special class/session relation only when existing links are absent or already match. Any conflicting class/session binding aborts reconciliation; the backfill never silently rebinds records. Preserve amount, status, Stripe IDs, timestamps, and metadata; assign no new hold to historical/paid purchases.
4. Validate paid count, active occupancy, existing attendance/session identity, and canonical session capacity before enabling generic writes. A mismatch is a reported conflict, not a repair guess.
5. Only after validation, require the new links for all newly created special-class purchases in application logic.

The backfill is dry-run capable, idempotent, chunked, and records reconciliation output without PII.

### D-09 — Rollback

Each work unit is deployable independently. Roll back by disabling new special-class creation/publication and the `checkoutKind: special-class` branch while retaining webhook fulfillment and existing records until all open Stripe sessions/holds are terminal. Never delete paid purchases, canonical sessions, attendances, or audit records as rollback.

## Non-decisions intentionally deferred

- Refund eligibility and automatic refund execution.
- Waitlist behavior.
- Multi-attendee reservations.
- Package-credit eligibility for special classes.
- Teacher access to roster data.

These are explicit non-goals, not blockers for the specified first delivery.
