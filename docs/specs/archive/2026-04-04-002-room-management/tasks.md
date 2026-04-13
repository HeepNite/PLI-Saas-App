# Tasks: 002-room-management

## Phase 1 - Data Foundation

- [x] 1.1 (M) Update `prisma/schema.prisma` to add `Room`, `ClassSession.roomId`, `CourseCatalog.defaultRoomId`, and the indexes/relations needed for legacy null-room records.
- [x] 1.2 (S) Create `prisma/migrations/<timestamp>_room_management/migration.sql` to add the room table and foreign keys without backfilling existing sessions.
- [x] 1.3 (S) Extend `lib/security/checkin-validation.ts` and `app/api/staff/school/courses/route.ts` payload parsing to accept optional `roomId` / `defaultRoomId` with spec-aligned validation.

## Phase 2 - Room API

- [x] 2.1 (M) Create `app/api/staff/rooms/route.ts` with staff auth, GET list/search/filter support, and POST create validation for unique names and `capacity > 0`.
- [x] 2.2 (M) Create `app/api/staff/rooms/[id]/route.ts` with PUT update and DELETE soft-disable behavior, including `404`, `409`, and `422` error handling from the design.
- [x] 2.3 (S) Keep a shared room response shape inside `app/api/staff/rooms/route.ts` and `app/api/staff/rooms/[id]/route.ts` so UI consumers receive consistent `id/name/capacity/location/active` data.

## Phase 3 - Conflict Detection And Wiring

- [x] 3.1 (M) Add room-overlap helpers to `lib/class-schedule.ts` using strict UTC comparisons and optional `excludeSessionId` support for session updates.
- [x] 3.2 (L) Update `app/api/staff/checkin/route.ts` to validate assigned rooms, reject inactive/missing rooms, return `409` on overlaps, and preserve the null-room legacy flow.
- [x] 3.3 (M) Update `app/api/staff/school/courses/route.ts` reads/writes so `CourseCatalog.defaultRoomId` persists without breaking existing `location` and `scheduleRules` behavior.

## Phase 4 - UI Adjustments

- [x] 4.1 (L) Update `components/front/staff/StaffUsersAdminClient.tsx` to fetch `/api/staff/rooms`, expose an optional default-room selector in the school course form, and submit `defaultRoomId`.
- [x] 4.2 (M) Extend `components/front/staff/StaffUsersAdminClient.tsx` with a room management panel for listing, creating, editing, and disabling rooms plus inline error states.
- [x] 4.3 (M) Update `components/front/staff/StaffCheckInClient.tsx` and related check-in payload wiring to show room details and surface room-conflict responses clearly.

## Phase 5 - Tests And Verification

- [x] 5.1 (S) Extend `tests/class-schedule.test.ts` for overlapping, edge-touching, excluded-session, and null-room availability scenarios.
- [x] 5.2 (M) Extend `tests/api/staff-checkin.test.ts` for available-room success, `409` conflict rejection, inactive-room rejection, and legacy null-room success.
- [x] 5.3 (M) Extend `tests/api/staff-school.test.ts` and add `tests/api/staff-rooms.test.ts` for room CRUD, course `defaultRoomId`, and disable-in-use rules.
- [x] 5.4 (M) Extend `components/front/staff/__tests__/StaffUsersAdminClient.test.ts` for room selectors, disable flows, and room error banners.
