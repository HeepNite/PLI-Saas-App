# Proposal: 002-room-management

## Intent

The system currently relies on free-text strings for locations, which prevents overlap detection, capacity management, and room-based availability. The intent of this change is to introduce a formal `Room` model to provide concrete conflict prevention and room recommendations, replacing the unvalidated strings.

## Scope

### In Scope
- Create `Room` database model (id, name, capacity, location, active).
- Update `ClassSession` to include an optional `roomId` foreign key.
- Update `CourseCatalog` to optionally support a default `roomId`.
- Implement API for Room CRUD operations.
- Implement basic conflict detection at check-in (session creation) time.

### Out of Scope
- Full schedule pre-generation (expanding `scheduleRules` into future sessions).
- Complex calendar UI grids for room bookings.
- Migrating/backfilling existing `ClassSession` data with specific rooms (will remain null/legacy).

## Approach

We will implement Approach 1 from the exploration: creating a first-class `Room` model with an optional foreign key on `ClassSession`. 
- `prisma/schema.prisma` will be updated to include the `Room` model and relations.
- The check-in flow (`app/api/staff/checkin/route.ts`) will be updated to validate room availability and prevent overlapping sessions for the same room.
- A new set of CRUD endpoints for Rooms will be added under `app/api/staff/rooms/`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | Add `Room` model, relations to `ClassSession` and `CourseCatalog`. |
| `app/api/staff/rooms/route.ts` | New | API for Room CRUD operations. |
| `app/api/staff/checkin/route.ts` | Modified | Add room validation and conflict detection on session upsert. |
| `lib/class-schedule.ts` | Modified | Add room-aware slot validation logic. |
| `components/front/staff/` | Modified | UI adjustments for room selection/assignment. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Null room IDs on existing sessions | High | Make `roomId` optional on `ClassSession` and handle nulls gracefully in logic. |
| Timezone issues in conflict detection | Medium | Ensure all comparisons use strict UTC ranges. |
| Schedule rules format changes | Medium | Maintain backward compatibility for `scheduleRules` JSON when adding room refs. |

## Rollback Plan

Revert the Prisma schema changes (drop `Room` table, remove `roomId` columns) and restore the previous check-in route and class-schedule lib files. Drop the new `rooms` API routes.

## Dependencies

- Prisma schema migration deployment.

## Success Criteria

- [ ] Staff can create, update, and disable Rooms via UI/API.
- [ ] Courses can be assigned to specific Rooms.
- [ ] The system rejects check-ins (session creation) if the Room is already booked for that time slot.
- [ ] Existing sessions (without rooms) continue to function without errors.