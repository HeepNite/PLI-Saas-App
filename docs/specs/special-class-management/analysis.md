# Special Classes Management — Analysis

## Reconciliation result

The repository already has the operational Special Class aggregate. The missing capability is an explicit, stable projection from the existing Course Studio authoring aggregate. Reusing the current standalone definition form would preserve two writers and cannot safely reconcile multiple slots.

## Current evidence

| Contract | Repository evidence | Consequence |
|---|---|---|
| Seven-step authoring | `components/front/staff/school/school-wizard-configs.ts` defines Info, Prices, Media, Schedule, Relations, Preview, Publish; `StaffCourseStudioPanel.tsx` renders those steps. | Extend this wizard; do not add another form. |
| Course identity | `prisma/schema.prisma:153-180`: `CourseCatalog.id`, unique `slug`, authoring fields, JSON `scheduleRules`, and `active`; no Special Class relation. | Use `id` as source identity and add an explicit child relation. |
| Operational identity | `prisma/schema.prisma:303-347`: `ClassSession` is unique on `(courseSlug, startsAt)`; `SpecialClass` has unique `slug` and unique required `classSessionId`. | Each authoring slot must map one-to-one to one existing aggregate pair. |
| Attendance/payment | `Purchase.specialClassId/classSessionId/holdExpiresAt`; `Attendance` unique `(userId, sessionId)`; `SpecialClassAuditLog` has per-class correlation/idempotency uniqueness. | Preserve existing money, capacity, audit, and attendance services. |
| Slot shape | `CourseScheduleSlot` contains only optional date/weekday and time. `scheduleRules.specialEvents` groups `{date,times}`. `getCourseSlotKey` uses date/time text. | Date/time is mutable presentation data, not durable identity. |
| Concrete-date parser | `deriveSpecialEventsFromScheduleSlots` persists concrete date/time values. | Reuse normalization but return/store stable slot IDs separately. |
| Expansion gotcha | `lib/course-schedule-blocks.ts:64-138` ignores `specialEvents`; without weekly rules it may use `availableWeekdays/availableTimes` fallback for up to 90 days. | Never use it to materialize Special Classes; parse concrete events directly. |
| Kind coupling | `SPECIAL_EVENT_COURSE_KINDS` and `useStaffCoursesAdmin` derive special-event UI from kind. | Operations must be driven by the explicit switch, not kind. |
| Save contract | `useStaffCoursesCRUD.saveCourseCatalog` POSTs the full form; the route performs a slug-keyed `courseCatalog.upsert` without a transaction. | Add ID-based, idempotent synchronization and keep the existing route surface. |
| Partial-write hazard | `toggleCourseActive` POSTs only slug/title/kind/active, while the route normalizes missing fields and overwrites the row. | The authoring change must use explicit commands/patch semantics, not reuse full-replacement parsing for partial actions. |
| Publication gap | `publish_now`, `coming_soon`, and `launch_date` appear only in route normalization and staff preview/form code. | Keep projections draft until explicit Publish; add no scheduler. |
| Duplicate writer | `StaffSpecialClassesPanel` POSTs create payloads and PATCHes definition fields alongside lifecycle/roster actions. | Remove definition creation/editing while retaining operational controls. |
| Authorization | Course writes use broad `authorizeStaffPortalRequest`; Special Class definitions use `authorizeSpecialClassDefinitionRequest` (owner/admin), roster uses the narrower operational policy. | Any enabled or already-linked authoring mutation must require the definition policy. |
| Locking | `runSpecialClassSerializableTransaction` retries three times; `lockSpecialClassBoundary` locks ClassSession then SpecialClass. | Synchronization must compose with this order and never update operational rows outside it. |

## Selected data direction

Add a `CourseCatalogSpecialClassSlot` child row with a database-generated ID, `courseCatalogId`, and canonical `startsAt`. Link `SpecialClass.authoringSlotId` as nullable and unique. Add `@@unique([courseCatalogId, startsAt])` to reject duplicate concrete slots. This is smaller and safer than embedding UUID strings in JSON or matching by slug/date.

`scheduleRules.specialEvents` remains the existing calendar serialization. For operations-enabled courses, the child rows are the identity authority and API responses hydrate slot IDs for later edits. The CourseCatalog aggregate therefore remains the authoring source without making mutable JSON the relational key.

Add additive CourseCatalog fields for `specialClassOperationsEnabled` (default false) and nullable shared capacity. Add a small authoring-operation receipt keyed by operation UUID and payload hash so a lost-response retry is distinguishable from a conflicting reuse.

## Projection ownership

- Course Studio owns shared definition copy/media and concrete authoring slots.
- A draft generated projection may continue following shared defaults.
- Published/closed/cancelled Special Classes own operational price, capacity, lifecycle, purchases, attendance, and audit history independently.
- Existing public checkout, webhook fulfillment, read model, roster mutations, and kiosk queries remain consumers of `SpecialClass`/`ClassSession`; they do not read CourseCatalog authoring JSON.

## Risks and controls

| Risk | Control |
|---|---|
| Duplicate projections after retry | Database slot ID, one-to-one relation, composite uniqueness, operation receipt, serializable retry. |
| Recurring explosion from one event | Dedicated concrete-event parser; no weekly fallback or 90-day expander. |
| Lost operational overrides | Shared drop-in price/capacity synchronize only while projections are draft; published values change through operations. First-class/discount fields remain CourseCatalog-only. |
| Silent history corruption | Reject move/removal/disable when any affected session has a hold, purchase, or attendance; require explicit operational closure/cancellation. |
| Partial course data loss | ID-based command parsing with full save versus narrow active-toggle contracts. |
| Unauthorized materialization | Existing owner/admin Special Class definition authorizer on enabled/linked mutations. |
| Partial fan-out | One serializable transaction for CourseCatalog, slots, projections, and audit; no external calls. |
| Legacy accidental adoption | Default false/null and no heuristic backfill. |

## Migration/backfill conclusion

This change needs an additive migration, not an inferred data backfill. Existing courses remain disabled; existing standalone Special Classes remain unlinked. Any future adoption tool must be separately approved, dry-run first, and reject anything other than an explicit operator-selected one-to-one relationship.

## Resolved product policy

- B-01 selects the drop-in price only; first-class/discount values are never projected in this delivery.
- B-02 rejects moving/removing committed slots and disabling operations when any affected session has a hold, purchase, or attendance.
- B-03 keeps generated sessions draft until explicit manual Publish; delayed CourseCatalog metadata does not schedule operational publication.

No product ambiguity remains for this delivery. Implementation awaits explicit acceptance of `tasks.md`.
