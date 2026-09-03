# Special Classes Management — Design

## Design summary

Treat Course Studio as an authoring aggregate and the existing Special Class/ClassSession pair as an operational projection. A relational child slot supplies stable identity; one transaction synchronizes authoring state without replacing checkout, payment, roster, attendance, lifecycle, or kiosk contracts.

## Boundaries

| Component | Owns | Must not own |
|---|---|---|
| `CourseCatalog` aggregate | Shared authoring fields, operations switch, initial capacity, concrete child slots | Operational occupancy, attendance, payment, or per-session lifecycle |
| `CourseCatalogSpecialClassSlot` | Stable source-slot ID and canonical authored instant | Public identity or recurrence expansion |
| `SpecialClass` | Public slug/copy/media, price, lifecycle, audit relation | A second capacity counter |
| `ClassSession` | Canonical time, duration, room/location, capacity, kiosk identity | Authoring JSON or payment lifecycle |
| `Purchase` / `Attendance` | Existing reservation/payment and attendee/session invariants | Course authoring state |
| Authoring synchronizer | Validation, idempotency, locking, projection diff | Stripe/network calls or operational roster actions |

## Data shape

```text
CourseCatalog 1 ---- * CourseCatalogSpecialClassSlot
CourseCatalogSpecialClassSlot 1 ---- 0..1 SpecialClass
SpecialClass 1 ---- 1 ClassSession
SpecialClass 1 ---- * Purchase
ClassSession 1 ---- * Purchase / Attendance
CourseCatalog 1 ---- * CourseCatalogAuthoringOperation
```

Additions are nullable/default-off around existing rows. `SpecialClass.authoringSlotId` is unique. `CourseCatalogSpecialClassSlot(courseCatalogId, startsAt)` is unique. The operation receipt has a globally unique operation UUID and normalized payload hash.

## Command model

The existing `/api/staff/school/courses` route remains the transport surface but distinguishes complete commands:

```text
save_draft(courseCatalogId?, expectedUpdatedAt?, operationId, fullForm, concreteSlots)
publish(courseCatalogId?, expectedUpdatedAt?, operationId, fullForm, concreteSlots)
set_active(courseCatalogId, expectedUpdatedAt, active)
```

This avoids the current ambiguity where a partial active-toggle payload passes through full-upsert defaults. Existing unlinked course saves can transition through the same explicit full-form command without materialization.

The response returns CourseCatalog ID/revision and created/updated/unchanged slot, SpecialClass, and ClassSession IDs. It contains no roster, PII, or payment data.

## Slot normalization

- Parse only `scheduleRules.specialEvents`/concrete slot inputs for operations-enabled materialization.
- Convert `YYYY-MM-DD` plus `HH:mm` in `America/New_York` to a UTC instant with DST-safe validation.
- Reject nonexistent/ambiguous local times unless the existing school-time parser produces one unambiguous instant.
- Sort by instant, reject duplicates, and never call `expandCourseScheduleSlots`; that helper ignores concrete events and can fall back to weekly recurrence.
- Existing slots must include their database ID. New slots omit it and receive an ID in the transaction.

## Projection diff

| Desired versus stored slot | Action |
|---|---|
| New, no ID | Create slot, immutable public slug, ClassSession, draft SpecialClass, audit. |
| Same ID/same instant | Update permitted shared draft fields only when changed. |
| Same ID/new instant, no commitments | Update the same ClassSession and audit without changing IDs/slug. |
| Same ID/new instant with hold/purchase/attendance | Reject the complete command without mutation. |
| Stored ID omitted, no commitments | Execute the explicit removal atomically and record its authoring audit outcome. |
| Stored ID omitted with hold/purchase/attendance | Reject; require explicit operational closure/cancellation. |
| Unknown/foreign ID | Reject `409 SLOT_ID_MISMATCH`. |
| Duplicate instant | Reject `409 SLOT_ALREADY_EXISTS`. |

New public slugs use a truncated sanitized CourseCatalog slug prefix plus the full slot ID, bounded to the existing 100-character contract. The stored slug never changes.

## State model

```text
Course Studio Save Draft
  -> CourseCatalog + slots durable
  -> generated SpecialClass status=draft
  -> no public checkout or kiosk visibility

Course Studio Publish
  -> validate all slots and shared fields
  -> synchronize all pairs atomically
  -> draft pairs become published together

Operations panel
  -> per-session close/cancel, roster, attendance, payment/capacity actions
  -> no shared definition writing
```

Published/terminal status is not mirrored backward to CourseCatalog. Authoring is the definition source; operational lifecycle remains independent after publication. Coming-soon/launch-date metadata never changes operational status automatically; explicit Publish is the only transition from generated draft to published.

## Field synchronization

| Field | Draft sync | After publish |
|---|---|---|
| Title/description/cover | Fan out with validation/audit | May fan out only through a permitted synchronized definition edit; terminal rows remain unchanged. |
| Slot/duration/location/room | Update canonical session by stable ID | Reject slot moves when any hold, purchase, or attendance exists; other changes use boundary lock and audit. |
| Shared price/capacity | Fan out to all draft rows | Existing rows retain operational values; new slots receive current defaults. |
| Course kind/category/level/video/relations/recurrence | CourseCatalog only | Never projected. |
| First-class/discount price | CourseCatalog only | Never projected in this delivery. |

## Transaction and authorization

The route parses/authenticates first. Any command enabling or touching linked projections requires owner/admin definition authorization. The synchronizer then uses `Serializable` isolation and the existing three-attempt conflict classifier.

Lock order is CourseCatalog, slot rows by ID, then each ClassSession/SpecialClass boundary by slot ID; Attendance and Purchase follow only when a policy check needs them. Room availability and `(courseSlug, startsAt)` uniqueness are checked before writes. CourseCatalog, compatibility JSON, slot rows, projections, audits, and receipt commit or roll back together.

No Stripe call is part of authoring. Checkout/webhook transactions keep their existing locks and retry semantics.

## Errors and observability

| Status/code | Meaning |
|---|---|
| `403` | Definition authorization denied. |
| `409 IDEMPOTENCY_KEY_REUSED` | Same operation ID, different normalized payload. |
| `409 AUTHORING_CONFLICT` | Retry budget exhausted or stale revision. |
| `409 SLOT_*` | Foreign, duplicate, committed, or policy-blocked slot mutation. |
| `409 ROOM_CONFLICT` | Canonical room interval cannot be assigned. |
| `422 NOT_PUBLISHABLE` | Missing/invalid shared field or any slot is not publishable. |
| `500` | Redacted unexpected failure; transaction rolled back. |

Emit one redacted command outcome and per-projection audit entries with IDs, action, actor, correlation/operation IDs, and before/after state. Do not log raw payloads, contact data, Stripe values, or webhook bodies.

## UI integration

- Info: add the explicit operations switch without changing step order.
- Prices: use the existing drop-in input as the shared initial price; keep first-class/discount inputs CourseCatalog-only.
- Schedule: when enabled, reuse concrete-date controls for every kind and show shared capacity beside them; no weekly materialization.
- Preview: show generated-session count and shared defaults, not operational live counts.
- Publish: retain current Reset/save styling while exposing explicit Save Draft/Publish commands.
- Operations panel: remove create/definition forms; add linked Course Studio navigation and keep operational controls.

## Migration, rollout, rollback

1. Apply additive schema with defaults/nulls; rehearse empty and populated databases.
2. Verify zero existing rows became enabled or linked and Salsa identity/counts are unchanged.
3. Ship read/write synchronization behind the explicit switch; operations-off behavior remains unchanged.
4. Enable panel cutover after Course Studio tests pass.
5. Run a local operational smoke: draft two slots, publish, inspect canonical IDs, adjust one session operationally, and verify the other remains unchanged. Kiosk UI change is not part of this work.

Rollback removes entry points, not durable data. Preserve linked rows, receipts, audits, sessions, purchases, attendance, and webhook processing. Do not drop populated additive schema as an emergency rollback.

## Test strategy

- Pure/unit: slot normalization, stable slug, mapping, publication policy, payload hash, transition decisions.
- API: owner/admin versus front desk, explicit commands, partial-toggle safety, validation, idempotent replay/conflict.
- PostgreSQL integration: migration defaults, multi-slot create, lost-response replay, concurrent publish, stable move, room/session uniqueness, all-or-nothing rollback.
- Component: switch gating, concrete slots for every kind, capacity placement, draft/publish actions, no duplicate panel writer, navigation.
- Regression: checkout, webhook, roster, capacity race, Salsa, attendance, public Special Class, and terminal today-classes projection.
