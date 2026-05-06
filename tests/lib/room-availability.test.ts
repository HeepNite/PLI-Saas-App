import { describe, expect, it } from "vitest"
import {
  buildRoomLifecycleAuditPayload,
  canHardDeletePrivateReservation,
  canViewReservationByScope,
  decideReservationLifecycleAction,
  findRoomAvailabilityConflict,
  getDisableRoomBlockers,
  getSafeDeleteBlockers,
  planRoomReassignmentAllOrNothing,
  type RoomReservationLike,
  type RoomScheduleSessionLike,
} from "@/lib/room-availability"

const ROOM_ID = "room-1"

describe("findRoomAvailabilityConflict", () => {
  const sessions: RoomScheduleSessionLike[] = [
    {
      id: "session-1",
      roomId: ROOM_ID,
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      durationMinutes: 60,
    },
  ]

  const reservations: RoomReservationLike[] = [
    {
      id: "reservation-1",
      roomId: ROOM_ID,
      startsAt: new Date("2026-06-01T12:00:00.000Z"),
      endsAt: new Date("2026-06-01T13:00:00.000Z"),
      status: "active",
    },
    {
      id: "reservation-cancelled",
      roomId: ROOM_ID,
      startsAt: new Date("2026-06-01T14:00:00.000Z"),
      endsAt: new Date("2026-06-01T15:00:00.000Z"),
      status: "cancelled",
    },
  ]

  it("returns class session conflict when session overlaps", () => {
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_ID,
      startsAt: new Date("2026-06-01T10:30:00.000Z"),
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
    })

    expect(conflict).toMatchObject({ kind: "class_session", id: "session-1" })
  })

  it("returns reservation conflict when no session conflict exists", () => {
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_ID,
      startsAt: new Date("2026-06-01T12:15:00.000Z"),
      endsAt: new Date("2026-06-01T12:45:00.000Z"),
    })

    expect(conflict).toMatchObject({ kind: "reservation", id: "reservation-1" })
  })

  it("ignores cancelled reservations", () => {
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_ID,
      startsAt: new Date("2026-06-01T14:10:00.000Z"),
      endsAt: new Date("2026-06-01T14:20:00.000Z"),
    })

    expect(conflict).toBeNull()
  })
})

describe("getDisableRoomBlockers", () => {
  it("returns blockers only for sessions in [now, now+24h)", () => {
    const now = new Date("2026-06-01T10:00:00.000Z")
    const sessions: RoomScheduleSessionLike[] = [
      { id: "past", roomId: ROOM_ID, startsAt: new Date("2026-06-01T09:59:00.000Z"), durationMinutes: 30 },
      { id: "inside", roomId: ROOM_ID, startsAt: new Date("2026-06-01T20:00:00.000Z"), durationMinutes: 45 },
      { id: "edge", roomId: ROOM_ID, startsAt: new Date("2026-06-02T10:00:00.000Z"), durationMinutes: 45 },
    ]

    const blockers = getDisableRoomBlockers(sessions, now)
    expect(blockers.map((item) => item.sessionId)).toEqual(["inside"])
  })
})

describe("getSafeDeleteBlockers", () => {
  it("aggregates all blocker categories", () => {
    const now = new Date("2026-06-01T10:00:00.000Z")
    const blockers = getSafeDeleteBlockers({
      now,
      futureSessions: [{ id: "session-future", startsAt: new Date("2026-06-01T10:30:00.000Z") }],
      reservations: [
        {
          id: "reservation-active",
          roomId: ROOM_ID,
          startsAt: new Date("2026-06-01T09:00:00.000Z"),
          endsAt: new Date("2026-06-01T11:00:00.000Z"),
          status: "active",
        },
        {
          id: "reservation-cancelled",
          roomId: ROOM_ID,
          startsAt: new Date("2026-06-01T11:30:00.000Z"),
          endsAt: new Date("2026-06-01T12:00:00.000Z"),
          status: "cancelled",
        },
      ],
      defaultCourses: [{ slug: "salsa-beginner" }],
      historical: {
        hasAttendanceLinks: true,
      },
    })

    expect(blockers.map((blocker) => blocker.code)).toEqual([
      "FUTURE_SESSION",
      "ACTIVE_OR_FUTURE_RESERVATION",
      "DEFAULT_COURSE_REFERENCE",
      "HISTORICAL_OPERATIONAL_LINK",
    ])
  })

  it("returns empty array when all preconditions pass", () => {
    const blockers = getSafeDeleteBlockers({
      now: new Date("2026-06-01T10:00:00.000Z"),
      futureSessions: [],
      reservations: [
        {
          id: "reservation-cancelled",
          roomId: ROOM_ID,
          startsAt: new Date("2026-06-01T08:00:00.000Z"),
          endsAt: new Date("2026-06-01T09:00:00.000Z"),
          status: "cancelled",
        },
      ],
      defaultCourses: [],
      historical: {},
    })

    expect(blockers).toEqual([])
  })
})

describe("planRoomReassignmentAllOrNothing", () => {
  it("returns blockers and zero moves when any target conflict exists", () => {
    const result = planRoomReassignmentAllOrNothing({
      sourceRoomId: "room-source",
      targetRoomId: "room-target",
      now: new Date("2026-06-01T09:00:00.000Z"),
      sessions: [
        {
          id: "source-session",
          roomId: "room-source",
          startsAt: new Date("2026-06-01T10:00:00.000Z"),
          durationMinutes: 60,
        },
        {
          id: "target-session",
          roomId: "room-target",
          startsAt: new Date("2026-06-01T10:30:00.000Z"),
          durationMinutes: 30,
        },
      ],
      reservations: [],
    })

    expect(result.canCommit).toBe(false)
    expect(result.moves).toEqual([])
    expect(result.blockers).toHaveLength(1)
    expect(result.blockers[0]).toMatchObject({
      code: "TARGET_ROOM_CONFLICT",
      sourceSessionId: "source-session",
    })
  })

  it("returns move plan when no conflicts exist", () => {
    const result = planRoomReassignmentAllOrNothing({
      sourceRoomId: "room-source",
      targetRoomId: "room-target",
      now: new Date("2026-06-01T09:00:00.000Z"),
      sessions: [
        {
          id: "source-session",
          roomId: "room-source",
          startsAt: new Date("2026-06-01T10:00:00.000Z"),
          durationMinutes: 60,
        },
      ],
      reservations: [],
    })

    expect(result).toMatchObject({
      canCommit: true,
      blockers: [],
      moves: [{ sessionId: "source-session", fromRoomId: "room-source", toRoomId: "room-target" }],
    })
  })
})

describe("decideReservationLifecycleAction", () => {
  it("rejects create/update when room is disabled", () => {
    const decision = decideReservationLifecycleAction({
      action: "create",
      roomIsActive: false,
      roomId: ROOM_ID,
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
    })

    expect(decision).toMatchObject({ allowed: false, reasonCode: "ROOM_DISABLED" })
  })

  it("allows cancel transition from active and blocks repeated cancel", () => {
    const allowedCancel = decideReservationLifecycleAction({
      action: "cancel",
      currentStatus: "active",
      roomIsActive: true,
    })
    const blockedCancel = decideReservationLifecycleAction({
      action: "cancel",
      currentStatus: "cancelled",
      roomIsActive: true,
    })

    expect(allowedCancel).toMatchObject({ allowed: true, status: "cancelled" })
    expect(blockedCancel).toMatchObject({ allowed: false, reasonCode: "ALREADY_CANCELLED" })
  })
})

describe("authorization and audit helpers", () => {
  it("enforces professor assigned-only reservation visibility", () => {
    const professorCanViewAssigned = canViewReservationByScope({
      actor: { role: "staff", category: "guest", subCategory: "teacher" },
      actorClerkUserId: "prof-1",
      assignedStaffClerkUserId: "prof-1",
    })

    const professorCannotViewOthers = canViewReservationByScope({
      actor: { role: "staff", category: "guest", subCategory: "teacher" },
      actorClerkUserId: "prof-1",
      assignedStaffClerkUserId: "prof-2",
    })

    expect(professorCanViewAssigned).toBe(true)
    expect(professorCannotViewOthers).toBe(false)
  })

  it("allows private reservation hard delete only for owner/admin without operational links", () => {
    const deniedByRole = canHardDeletePrivateReservation({
      actor: { role: "staff", category: "manager" },
    })

    const deniedByLinks = canHardDeletePrivateReservation({
      actor: { role: "admin", category: "manager" },
      hasPaymentLinks: true,
    })

    const allowed = canHardDeletePrivateReservation({
      actor: { role: "owner", category: "manager" },
    })

    expect(deniedByRole).toMatchObject({ allowed: false, reasonCode: "FORBIDDEN" })
    expect(deniedByLinks).toMatchObject({ allowed: false, reasonCode: "HAS_OPERATIONAL_LINKS" })
    expect(allowed).toMatchObject({ allowed: true })
  })

  it("builds normalized audit payload for room lifecycle events", () => {
    const payload = buildRoomLifecycleAuditPayload({
      action: "room_disable",
      actorClerkUserId: "user-1",
      actorRole: "manager",
      outcome: "denied",
      roomId: "room-1",
      roomNameSnapshot: "Main Room",
      reason: "24h blocker",
      blockers: [{ code: "SESSION_IN_NEXT_24H" }],
    })

    expect(payload).toMatchObject({
      action: "room_disable",
      actorClerkUserId: "user-1",
      outcome: "denied",
      roomId: "room-1",
      roomNameSnapshot: "Main Room",
      reason: "24h blocker",
    })
    expect(payload.blockers).toEqual([{ code: "SESSION_IN_NEXT_24H" }])
  })
})
