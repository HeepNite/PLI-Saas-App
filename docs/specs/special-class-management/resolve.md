# Special Classes Management — Resolution

## Resolution status

`RESOLVED — IMPLEMENTATION PLAN ACCEPTED; WU1 AUTHORIZED`

## Resolved decisions

### D-01 — One authoring surface

The existing Course Studio is the only definition writer. Its seven steps and visual language remain. `StaffSpecialClassesPanel` becomes operational: list/detail, lifecycle, roster, payments, capacity, attendance, audit, and navigation back to Course Studio.

### D-02 — Explicit activation

Add `CourseCatalog.specialClassOperationsEnabled Boolean @default(false)`. The switch, never `kind`, controls projection behavior. Enabling it requires concrete future slots, positive shared capacity, valid shared price, description, duration, location/room validity, and publishable media/state.

### D-03 — Stable slot identity

Add `CourseCatalogSpecialClassSlot`:

```text
id                  String   primary key, database generated
courseCatalogId     String   required FK -> CourseCatalog(id)
startsAt            DateTime required canonical school-timezone instant
createdAt/updatedAt DateTime
unique(courseCatalogId, startsAt)
```

Add nullable unique `SpecialClass.authoringSlotId` referencing that row. `CourseCatalog` owns the child collection. Legacy standalone Special Classes keep `authoringSlotId = null`.

Mutable title/slug/date/time values are never identity. `scheduleRules.specialEvents` remains a compatibility/calendar view; the relational slot ID is authoritative for synchronization.

### D-04 — Source and projection identity

- `CourseCatalog.id` identifies create-versus-update after the first save.
- `CourseCatalogSpecialClassSlot.id` identifies add/move/remove intent.
- `SpecialClass.id` and `ClassSession.id` remain operational identity.
- Existing uniqueness on session, public slug, one-to-one session, purchases, and attendance remains.
- Existing CourseCatalog slug edits are rejected once projections exist unless a later accepted change defines an atomic slug-rewrite contract. Public Special Class slugs remain stable either way.

### D-05 — Public slugs

On first materialization, generate a valid slug from a bounded CourseCatalog slug prefix plus the full stable slot-row ID. Persist it once. Do not regenerate it when title, CourseCatalog slug, date, or time changes. Collision is a transaction conflict, never a date-based lookup or silent suffix retry.

Legacy Salsa retains its current slug and behavior.

### D-06 — Shared defaults and mapping

- Existing drop-in USD price is the shared initial `SpecialClass.priceCents` for every generated slot. First-class and discount fields remain CourseCatalog-only with no precedence or expiry behavior in this delivery.
- Add nullable `CourseCatalog.specialClassCapacity`; show it in Schedule only when operations are enabled.
- New projections receive shared price/capacity. Existing draft projections may track shared changes. Published or terminal sessions keep independent operational values; later changes use existing Special Class operations.
- Map title and description to SpecialClass; title, slot instant, duration, location, default room, and capacity to ClassSession; cover image and price/currency to SpecialClass.
- Do not project kind, category, level, preview video, recurrence, Relations-step links, first-class price, or discounts without an accepted requirement.

### D-07 — Draft and publish synchronization

The Publish step exposes commands in the existing button language, not a new wizard:

- **Save draft:** save CourseCatalog plus stable slots and create/update only draft projections. Draft projections are not public, reservable, or kiosk-visible.
- **Publish:** validate the complete aggregate, synchronize, and transition every eligible draft projection to published in the same transaction.

Published/closed/cancelled sessions are not silently reverted to draft by later CourseCatalog saves. All generated sessions remain draft until explicit Publish. Coming-soon/launch-date values remain CourseCatalog metadata and never auto-publish operational sessions; no scheduler is added.

### D-08 — Idempotency and retry

Add a compact authoring-operation receipt with globally unique operation UUID, CourseCatalog relation, normalized payload hash, result summary, and timestamps.

1. Client creates one UUID per Save Draft/Publish intent and reuses it only when retrying that intent.
2. Server normalizes and hashes the complete command.
3. Existing UUID + same hash returns the stored result without writing or auditing again.
4. Existing UUID + different hash returns `409 IDEMPOTENCY_KEY_REUSED`.
5. A new command runs in `Serializable` isolation with the existing maximum three attempts for `P2002`, `P2034`, or SQL `40001`.
6. Retry exhaustion returns `409 AUTHORING_CONFLICT`; unexpected errors return the existing redacted `500` shape.

### D-09 — Synchronization algorithm

Within one transaction:

1. lock or create CourseCatalog by stable ID/operation receipt;
2. lock its authoring slots in stable-ID order;
3. normalize concrete date/time entries directly in the school timezone;
4. create new slot rows; update existing rows by ID; reject move/removal/disable when any affected session has a hold, purchase, or attendance;
5. for each affected row in ID order, lock ClassSession then SpecialClass through the existing boundary;
6. validate room collision, lifecycle, capacity, and committed-history constraints;
7. create/update the canonical pairs and one audit entry per changed projection;
8. persist CourseCatalog, compatibility `scheduleRules`, receipt result, and commit.

No Stripe/network call occurs in this transaction. Any failure rolls back the complete authoring command.

### D-10 — Slot edits

- Add creates one slot and one aggregate pair.
- An uncommitted move updates `startsAt` on the same slot and ClassSession, preserving all IDs and public slug.
- Explicit removal/disable is allowed only when every affected generated session has no hold, purchase, or attendance; it executes atomically and is recorded in the authoring operation receipt/audit outcome.
- Duplicate starts, occupied room conflicts, past publish times, stale source revision, and lifecycle conflicts return observable `409`/`422` errors.
- Any hold, purchase, or attendance blocks slot move/removal and disabling operations. Closure/cancellation must be explicit through operations; there is no silent delete, cancel, detach, or rebind.

### D-11 — Authorization and audit

Any request that enables operations or edits an already-linked course uses `authorizeSpecialClassDefinitionRequest` (owner/admin) plus existing rate limiting. Operational reads/actions retain `authorizeSpecialClassRosterRequest`.

Use the established lock order: CourseCatalog, authoring slots by ID, canonical ClassSession/SpecialClass boundaries by slot ID, then Attendance and Purchase rows when needed. Every changed projection records actor, role, source/slot/session identifiers, before/after state, operation UUID, and correlation ID without PII or payment secrets.

### D-12 — Duplicate-writer deprecation

- Remove the panel create form and definition fields.
- Linked rows expose **Open in School Builder**.
- Initial publish for linked drafts occurs in Course Studio; operational close/cancel and permitted per-session price/capacity actions remain in the operations panel.
- Standalone legacy rows remain readable and operational, labelled as standalone, with no inferred authoring link.
- Deprecate browser use of `POST /api/staff/special-classes`; do not remove legacy/backfill data paths until caller evidence proves they are unused.

### D-13 — Migration and rollback

Migration is additive: default operations false, nullable capacity/relation, new slot/receipt tables and indexes. It performs no title/slug/date heuristic matching and changes no existing Salsa or standalone records.

Application rollback disables new synchronization and authoring controls but retains rows, links, receipts, audits, purchases, sessions, and attendance. Once populated, the additive schema is not dropped as an operational rollback. Existing webhook fulfillment remains enabled until open payment states are terminal.

## Resolved product decisions

| ID | Decision | Delivery consequence |
|---|---|---|
| B-01 | Base price only | Project drop-in price; keep first-class/discount fields CourseCatalog-only. |
| B-02 | Reject mutation after commitments | Any hold, purchase, or attendance blocks move/removal/disable; closure/cancellation stays operational. |
| B-03 | Draft only/manual publish | Only explicit Publish transitions generated sessions; no scheduler. |

Product policy is complete. The user explicitly accepted `tasks.md`; WU1 implementation is authorized.
