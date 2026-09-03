# Special Classes Management — Requirements

## Status

`RESOLVED — IMPLEMENTATION PLAN ACCEPTED; WU1 AUTHORIZED`

## Outcome

Use the existing seven-step School Builder/Course Studio as the only definition authoring experience for special classes. A `CourseCatalog` is the authoring source; every enabled concrete date/time slot projects to one independent `SpecialClass` and its one canonical `ClassSession` for public sales, roster, capacity, payment, audit, lifecycle, and kiosk consumption.

## Scope

### In scope

- Authoring through Info, Prices, Media, Schedule, Relations, Preview, and Publish.
- An explicit **Enable Special Class operations** switch; course `kind` remains presentation taxonomy.
- Multiple concrete slots with one shared initial price and capacity.
- Idempotent draft/save/publish synchronization into independent operational sessions.
- Removal of duplicate definition controls from `StaffSpecialClassesPanel` while preserving operational management and School Builder navigation.
- Additive identity/migration work, authorization, audit, rollback, and focused tests.

### Non-goals

- A second wizard, redesigned Course Studio, new payment/attendance system, or kiosk UI work.
- Inferring special-class behavior from `course`, `program`, `bootcamp`, `workshop`, `convention`, or `congress`.
- Waitlists, packages/credits, coupons, multi-attendee reservations, or automated refunds.
- Hardcoded Salsa titles, slugs, dates, or special-case authoring behavior.

## Product rules

1. The operations switch is the only authoring signal that creates or updates operational projections.
2. With the switch off, saving any course kind creates no `SpecialClass` or special `ClassSession`.
3. With the switch on, Schedule uses the existing concrete-date controls and requires at least one future date/time slot; weekly fallback expansion must not materialize recurrence.
4. Each concrete slot owns an independent `SpecialClass` and canonical `ClassSession` under one `CourseCatalog` authoring aggregate.
5. Each generated session owns independent lifecycle, capacity, purchases, roster, attendance, and kiosk visibility.
6. The wizard provides one shared initial drop-in price and one shared initial capacity. Draft projections follow those defaults; published or operationally adjusted sessions do not lose independent values.
7. `ClassSession.capacity` remains authoritative. `Purchase` and `Attendance` continue to enforce the existing payment, hold, uniqueness, locking, audit, and lifecycle invariants.
8. Public checkout and kiosk resolve the canonical session already linked to the generated `SpecialClass`; no duplicate session or counter is permitted.
9. A generated public slug is stable after creation. Title, source slug, date, or time edits do not regenerate it.
10. Existing standalone `SpecialClass` rows, including legacy Salsa, remain valid and are not guessed into a Course Studio relationship.

## Authorization

| Actor | Course authoring with operations enabled | Publish generated sessions | Operational list/roster | Attendance actions |
|---|---:|---:|---:|---:|
| Owner | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes | Yes |
| Front desk (`staff`) | No | No | Yes | Yes, within existing policy |
| Teacher/student/public | No | No | No | No |

All server paths retain existing staff authentication, rate limiting, response minimization, and role checks. UI hiding is not authorization.

## Functional requirements

### FR-01 — Authoring source and identity

- `CourseCatalog.id`, not slug/date matching, identifies the authoring aggregate.
- Every concrete authoring slot has a stable database ID and at most one linked `SpecialClass`.
- Every linked `SpecialClass` has exactly one canonical `ClassSession`.
- Existing `ClassSession(courseSlug, startsAt)`, `SpecialClass.slug`, `SpecialClass.classSessionId`, and `Attendance(userId, sessionId)` uniqueness remains enforced.

### FR-02 — Existing wizard, no parallel writer

- The switch is added to the existing Info step; shared capacity belongs beside concrete slots in Schedule; shared initial price uses the existing drop-in field in Prices.
- Media, room/location, duration, preview, and publish controls retain the current visual language.
- `StaffSpecialClassesPanel` no longer creates or edits title, description, media, time, duration, location, or room.
- The panel retains operational lifecycle, roster, payment/capacity controls, audit visibility, and navigation to the linked Course Studio item.

### FR-03 — Projection mapping

| Course Studio source | Generated projection |
|---|---|
| Title | `SpecialClass.title`, `ClassSession.title` |
| Description | `SpecialClass.description`; required before publish |
| Cover image | `SpecialClass.coverImageUrl` |
| Concrete slot | Authoring slot `startsAt`, then `ClassSession.startsAt` |
| Duration | `ClassSession.durationMinutes` |
| Location/default room | `ClassSession.location` / `ClassSession.roomId` |
| Drop-in price | Shared initial `SpecialClass.priceCents` |
| Currency | Existing School Builder currency contract (`usd`) |
| Shared capacity | Initial `ClassSession.capacity` for every generated slot |
| Draft/publish action | Generated `SpecialClass.status` and timestamps |

`kind`, category, level, preview video, first-class price, discounts, recurrence controls, and Relations-step links are not projected in this delivery.

### FR-04 — Draft, save, publish, and retry

- Save Draft atomically persists the `CourseCatalog`, stable slot rows, and draft projections; nothing becomes public or kiosk-selectable.
- Publish performs the same synchronization and publishes every eligible generated session as one all-or-nothing operation.
- A request carries one operation UUID. Repeating the same UUID with the same normalized payload returns the recorded result; reusing it with different payload returns `409`.
- Serialization/unique conflicts use the existing bounded retry policy. Exhaustion returns an observable conflict and no partial CourseCatalog/projection mutation.
- Validation or authorization failure occurs before durable mutation where possible. Unexpected failure rolls back the transaction.

### FR-05 — Editing slots safely

- Adding a slot creates one new stable slot row, `SpecialClass`, and `ClassSession`; retries do not duplicate them.
- Moving a permitted slot updates the existing rows by stable IDs and preserves public slug, purchases, attendance, and audit history.
- Moving/removing a slot or disabling operations is rejected when any affected generated session has a hold, purchase, or attendance. Closure/cancellation must be explicit through operations; no authoring command silently deletes, cancels, detaches, or rebinds committed data.
- An explicit move/removal with no commitments remains one atomic, audited authoring command and preserves stable IDs for moves.
- Source slug changes never regenerate public slugs and must not leave the canonical session or Course Studio references inconsistent.

### FR-06 — Operational invariants

- One reservation represents one attendee and uses the existing three-minute internal hold.
- Capacity equals durable paid occupancy plus unexpired holds against canonical `ClassSession.capacity`.
- Serializable admission and webhook fulfillment preserve final-place concurrency, immutable purchase money/session links, replay safety, manual capture, and canonical attendance creation/reuse.
- Stripe calls stay outside database transactions. Kiosk integration consumes the canonical rows without a special payment or attendance branch.

### FR-07 — Migration and compatibility

- New relations are nullable and the operations switch defaults to false for existing courses.
- Existing CourseCatalog events do not auto-materialize, regardless of kind or concrete dates.
- Existing standalone Special Classes remain unlinked; Salsa data, slugs, money, sessions, purchases, and attendance are unchanged.
- Migration/backfill rehearsal is dry-run capable, idempotent, and aborts on ambiguous or conflicting identity.

## Acceptance scenarios

### Explicit activation and independent slots

```gherkin
Given a CourseCatalog has two concrete future slots and Special Class operations are off
When an owner saves it
Then no SpecialClass is created
When the owner enables operations and publishes with shared price P and capacity C
Then two independent SpecialClass and ClassSession pairs exist under stable authoring slot IDs
And each starts with P and C
```

### Idempotent lost-response retry

```gherkin
Given a publish transaction committed but its response was lost
When the same operation UUID and normalized payload are retried
Then the recorded result is returned
And no CourseCatalog, authoring slot, SpecialClass, ClassSession, or audit row is duplicated
```

### Stable move

```gherkin
Given an uncommitted generated slot has stable slot ID A and public slug S
When its date/time is moved in School Builder
Then the same SpecialClass and ClassSession IDs remain linked to A
And S, purchases, attendance, and audit history remain unchanged
```

### Committed slot mutation is rejected

```gherkin
Given a generated session has a hold, purchase, or attendance
When School Builder tries to move or remove its slot or disable operations
Then the complete authoring command returns a conflict without mutation
And closure or cancellation remains an explicit operations action
```

### Legacy compatibility

```gherkin
Given existing CourseCatalog events and standalone SpecialClass rows including Salsa
When the additive migration is applied
Then existing courses remain operations-disabled
And standalone rows remain unlinked and operational
And no relationship is inferred from title, kind, slug, date, or time
```

## Resolved product decisions

### B-01 — Base price only

Every generated `SpecialClass` uses the CourseCatalog drop-in price as its shared initial price. First-class and special-discount fields remain CourseCatalog-only. This delivery defines no discount precedence or expiry behavior.

### B-02 — Reject mutation after commitments

If an affected generated session has any hold, purchase, or attendance, School Builder rejects moving/removing the slot or disabling operations. Staff must close or cancel through operations. No authoring path silently deletes, cancels, detaches, or rebinds committed data.

### B-03 — Draft only and manual publish

Generated sessions remain draft until the user invokes explicit Publish in Course Studio. Coming-soon and launch-date values remain CourseCatalog authoring metadata and never auto-publish operational sessions. No scheduler is added.

## Definition of done

- [x] B-01 through B-03 are resolved in this contract.
- [x] The implementation plan is explicitly accepted before code changes.
- [ ] Every acceptance scenario and authorization boundary has automated coverage.
- [ ] Migration applies to empty and representative populated PostgreSQL databases and rollback boundaries are rehearsed.
- [ ] Existing special-class checkout, webhook, roster, attendance, Salsa, and kiosk regressions pass.
- [ ] Operational smoke proves Course Studio publish to canonical staff/public data without PII or payment secrets in logs.
