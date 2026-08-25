import { describe, expect, it } from "vitest"
import {
  findAvailableRoomsForSlot,
  findRoomAvailabilityConflict,
  type RoomAvailabilityInput,
  type RoomReservationLike,
  type RoomScheduleSessionLike,
  type VirtualBlock,
} from "@/lib/room-availability"
import { expandCourseScheduleSlots, type CourseScheduleLike } from "@/lib/course-schedule-blocks"

const ROOM_A = "room-a"
const ROOM_B = "room-b"
const ROOM_C = "room-c"

// ─── Task 2.1: bufferMinutes ────────────────────────────────────────────────

describe("findRoomAvailabilityConflict — bufferMinutes", () => {
  const sessions: RoomScheduleSessionLike[] = [
    {
      id: "session-1",
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      durationMinutes: 60, // ends at 11:00
    },
  ]
  const reservations: RoomReservationLike[] = []

  it("no buffer: 10:50-11:00 does NOT conflict with 10:00-11:00 (strict overlap)", () => {
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T10:50:00.000Z"),
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
    })
    // Strict overlap: 10:50 < 11:00 && 11:00 > 10:00 → yes, overlaps
    expect(conflict).toMatchObject({ kind: "class_session", id: "session-1" })
  })

  it("buffer 15min: gap of 14min conflicts (insufficient buffer)", () => {
    // session ends at 11:00, new event starts at 11:14 → gap = 14min < 15min
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T11:14:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      bufferMinutes: 15,
    })
    expect(conflict).toMatchObject({ kind: "class_session", id: "session-1" })
  })

  it("buffer 15min: gap of 16min does NOT conflict (sufficient buffer)", () => {
    // session ends at 11:00, new event starts at 11:16 → gap = 16min > 15min
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T11:16:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      bufferMinutes: 15,
    })
    expect(conflict).toBeNull()
  })

  it("buffer 15min: gap of exactly 15min conflicts (boundary-inclusive)", () => {
    // session ends at 11:00, new event starts at 11:15 → gap = 15min
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T11:15:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      bufferMinutes: 15,
    })
    expect(conflict).toMatchObject({ kind: "class_session", id: "session-1" })
  })

  it("buffer applies to reservation conflicts too", () => {
    const res: RoomReservationLike[] = [
      {
        id: "res-1",
        roomId: ROOM_A,
        startsAt: new Date("2026-06-01T10:00:00.000Z"),
        endsAt: new Date("2026-06-01T11:00:00.000Z"),
        status: "active",
      },
    ]
    // gap = 14min < 15min buffer
    const conflict = findRoomAvailabilityConflict([], res, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T11:14:00.000Z"),
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      bufferMinutes: 15,
    })
    expect(conflict).toMatchObject({ kind: "reservation", id: "res-1" })
  })
})

// ─── Task 2.1: mode 'school-priority' ───────────────────────────────────────

describe("findRoomAvailabilityConflict — mode: 'school-priority'", () => {
  const sessions: RoomScheduleSessionLike[] = [
    {
      id: "session-1",
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      durationMinutes: 60,
    },
  ]
  const reservations: RoomReservationLike[] = [
    {
      id: "res-1",
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T10:30:00.000Z"),
      endsAt: new Date("2026-06-01T11:30:00.000Z"),
      status: "active",
    },
  ]

  it("symmetric (default): reservation conflicts still detected", () => {
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T10:45:00.000Z"),
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
      mode: "symmetric",
    })
    // Session conflict takes priority (checked first)
    expect(conflict?.kind).toBe("class_session")
  })

  it("school-priority: reservation conflicts SKIPPED entirely", () => {
    // Time slot that only conflicts with reservation, not session
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T11:30:00.000Z"), // session ends at 11:00
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      mode: "school-priority",
    })
    // Reservation at 10:30-11:30 overlaps with 11:30-12:00? No, 11:30 == 11:30
    // Strict overlap: 11:30 < 11:30 is false → no overlap
    expect(conflict).toBeNull()
  })

  it("school-priority: session conflicts STILL detected", () => {
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T10:30:00.000Z"),
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
      mode: "school-priority",
    })
    expect(conflict).toMatchObject({ kind: "class_session", id: "session-1" })
  })

  it("school-priority: overlapping reservation does not block", () => {
    // Slot that overlaps ONLY with the reservation
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T11:01:00.000Z"), // after session ends
      endsAt: new Date("2026-06-01T11:29:00.000Z"), // before reservation ends
      mode: "school-priority",
    })
    expect(conflict).toBeNull()
  })
})

// ─── Task 2.1: virtualBlocks ────────────────────────────────────────────────

describe("findRoomAvailabilityConflict — virtualBlocks", () => {
  const virtualBlocks: VirtualBlock[] = [
    {
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
    },
  ]

  it("virtual block treated as session-like event, blocks reservations", () => {
    const conflict = findRoomAvailabilityConflict([], [], {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T10:30:00.000Z"),
      endsAt: new Date("2026-06-01T11:30:00.000Z"),
      virtualBlocks,
    })
    expect(conflict).toMatchObject({
      kind: "schedule",
      startsAt: new Date("2026-06-01T10:00:00.000Z"),
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
    })
  })

  it("virtual block + buffer: respects bufferMinutes", () => {
    const conflict = findRoomAvailabilityConflict([], [], {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T11:14:00.000Z"), // 14min gap
      endsAt: new Date("2026-06-01T12:00:00.000Z"),
      virtualBlocks,
      bufferMinutes: 15,
    })
    expect(conflict).toMatchObject({ kind: "schedule" })
  })

  it("virtualBlocks + school-priority: virtual blocks still checked", () => {
    const reservations: RoomReservationLike[] = [
      {
        id: "res-1",
        roomId: ROOM_A,
        startsAt: new Date("2026-06-01T14:00:00.000Z"),
        endsAt: new Date("2026-06-01T15:00:00.000Z"),
        status: "active",
      },
    ]
    const conflict = findRoomAvailabilityConflict([], reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T10:30:00.000Z"),
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
      virtualBlocks,
      mode: "school-priority",
    })
    // Virtual block conflict detected (school schedule), reservation skipped
    expect(conflict).toMatchObject({ kind: "schedule" })
  })

  it("no virtualBlocks: behaves identically to before", () => {
    const conflict = findRoomAvailabilityConflict([], [], {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T10:30:00.000Z"),
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
    })
    expect(conflict).toBeNull()
  })
})

// ─── Backward compatibility ─────────────────────────────────────────────────

describe("findRoomAvailabilityConflict — backward compatibility", () => {
  it("calling without new params works identically to before", () => {
    const sessions: RoomScheduleSessionLike[] = [
      {
        id: "session-1",
        roomId: ROOM_A,
        startsAt: new Date("2026-06-01T10:00:00.000Z"),
        durationMinutes: 60,
      },
    ]
    const reservations: RoomReservationLike[] = [
      {
        id: "res-1",
        roomId: ROOM_A,
        startsAt: new Date("2026-06-01T12:00:00.000Z"),
        endsAt: new Date("2026-06-01T13:00:00.000Z"),
        status: "active",
      },
    ]

    // Same tests as the original test file
    const sessionConflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T10:30:00.000Z"),
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
    })
    expect(sessionConflict).toMatchObject({ kind: "class_session", id: "session-1" })

    const reservationConflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId: ROOM_A,
      startsAt: new Date("2026-06-01T12:15:00.000Z"),
      endsAt: new Date("2026-06-01T12:45:00.000Z"),
    })
    expect(reservationConflict).toMatchObject({ kind: "reservation", id: "res-1" })
  })
})

// ─── Task 2.2: findAvailableRoomsForSlot ────────────────────────────────────

describe("findAvailableRoomsForSlot", () => {
  it("returns all active rooms when no conflicts exist", async () => {
    // This test requires a mock Prisma client
    const mockPrisma = createMockPrisma({
      rooms: [
        { id: ROOM_A, name: "Room A", capacity: 20, active: true },
        { id: ROOM_B, name: "Room B", capacity: 15, active: true },
      ],
      sessions: [],
      reservations: [],
      courses: [],
    })

    const available = await findAvailableRoomsForSlot({
      targetStartsAt: new Date("2026-06-01T10:00:00.000Z"),
      targetEndsAt: new Date("2026-06-01T11:00:00.000Z"),
      prisma: mockPrisma as any,
    })

    expect(available).toHaveLength(2)
    expect(available.map((r) => r.id)).toContain(ROOM_A)
    expect(available.map((r) => r.id)).toContain(ROOM_B)
  })

  it("excludes room with session conflict", async () => {
    const mockPrisma = createMockPrisma({
      rooms: [
        { id: ROOM_A, name: "Room A", capacity: 20, active: true },
        { id: ROOM_B, name: "Room B", capacity: 15, active: true },
      ],
      sessions: [
        {
          id: "session-1",
          roomId: ROOM_A,
          startsAt: new Date("2026-06-01T10:00:00.000Z"),
          durationMinutes: 60,
        },
      ],
      reservations: [],
      courses: [],
    })

    const available = await findAvailableRoomsForSlot({
      targetStartsAt: new Date("2026-06-01T10:30:00.000Z"),
      targetEndsAt: new Date("2026-06-01T11:00:00.000Z"),
      prisma: mockPrisma as any,
    })

    expect(available).toHaveLength(1)
    expect(available[0].id).toBe(ROOM_B)
  })

  it("excludes room with reservation conflict", async () => {
    const mockPrisma = createMockPrisma({
      rooms: [
        { id: ROOM_A, name: "Room A", capacity: 20, active: true },
        { id: ROOM_B, name: "Room B", capacity: 15, active: true },
      ],
      sessions: [],
      reservations: [
        {
          id: "res-1",
          roomId: ROOM_B,
          startsAt: new Date("2026-06-01T10:00:00.000Z"),
          endsAt: new Date("2026-06-01T11:00:00.000Z"),
          status: "active",
        },
      ],
      courses: [],
    })

    const available = await findAvailableRoomsForSlot({
      targetStartsAt: new Date("2026-06-01T10:30:00.000Z"),
      targetEndsAt: new Date("2026-06-01T11:00:00.000Z"),
      prisma: mockPrisma as any,
    })

    expect(available).toHaveLength(1)
    expect(available[0].id).toBe(ROOM_A)
  })

  it("excludes room by excludeRoomId even when available", async () => {
    const mockPrisma = createMockPrisma({
      rooms: [
        { id: ROOM_A, name: "Room A", capacity: 20, active: true },
        { id: ROOM_B, name: "Room B", capacity: 15, active: true },
      ],
      sessions: [],
      reservations: [],
      courses: [],
    })

    const available = await findAvailableRoomsForSlot({
      targetStartsAt: new Date("2026-06-01T10:00:00.000Z"),
      targetEndsAt: new Date("2026-06-01T11:00:00.000Z"),
      excludeRoomId: ROOM_A,
      prisma: mockPrisma as any,
    })

    expect(available).toHaveLength(1)
    expect(available[0].id).toBe(ROOM_B)
  })

  it("empty result when all rooms have conflicts", async () => {
    const mockPrisma = createMockPrisma({
      rooms: [
        { id: ROOM_A, name: "Room A", capacity: 20, active: true },
        { id: ROOM_B, name: "Room B", capacity: 15, active: true },
      ],
      sessions: [
        {
          id: "session-a",
          roomId: ROOM_A,
          startsAt: new Date("2026-06-01T10:00:00.000Z"),
          durationMinutes: 60,
        },
        {
          id: "session-b",
          roomId: ROOM_B,
          startsAt: new Date("2026-06-01T10:00:00.000Z"),
          durationMinutes: 60,
        },
      ],
      reservations: [],
      courses: [],
    })

    const available = await findAvailableRoomsForSlot({
      targetStartsAt: new Date("2026-06-01T10:30:00.000Z"),
      targetEndsAt: new Date("2026-06-01T11:00:00.000Z"),
      prisma: mockPrisma as any,
    })

    expect(available).toHaveLength(0)
  })

  it("excludes inactive rooms", async () => {
    const mockPrisma = createMockPrisma({
      rooms: [
        { id: ROOM_A, name: "Room A", capacity: 20, active: true },
        { id: ROOM_B, name: "Room B", capacity: 15, active: false },
      ],
      sessions: [],
      reservations: [],
      courses: [],
    })

    const available = await findAvailableRoomsForSlot({
      targetStartsAt: new Date("2026-06-01T10:00:00.000Z"),
      targetEndsAt: new Date("2026-06-01T11:00:00.000Z"),
      prisma: mockPrisma as any,
    })

    expect(available).toHaveLength(1)
    expect(available[0].id).toBe(ROOM_A)
  })

  it("respects bufferMinutes parameter", async () => {
    const mockPrisma = createMockPrisma({
      rooms: [
        { id: ROOM_A, name: "Room A", capacity: 20, active: true },
        { id: ROOM_B, name: "Room B", capacity: 15, active: true },
      ],
      sessions: [
        {
          id: "session-a",
          roomId: ROOM_A,
          startsAt: new Date("2026-06-01T10:00:00.000Z"),
          durationMinutes: 60, // ends 11:00
        },
      ],
      reservations: [],
      courses: [],
    })

    // With 15min buffer: slot at 11:14 conflicts (14min gap), slot at 11:16 doesn't
    const withConflict = await findAvailableRoomsForSlot({
      targetStartsAt: new Date("2026-06-01T11:14:00.000Z"),
      targetEndsAt: new Date("2026-06-01T12:00:00.000Z"),
      bufferMinutes: 15,
      prisma: mockPrisma as any,
    })
    expect(withConflict.map((r) => r.id)).not.toContain(ROOM_A)

    const withoutConflict = await findAvailableRoomsForSlot({
      targetStartsAt: new Date("2026-06-01T11:16:00.000Z"),
      targetEndsAt: new Date("2026-06-01T12:00:00.000Z"),
      bufferMinutes: 15,
      prisma: mockPrisma as any,
    })
    expect(withoutConflict.map((r) => r.id)).toContain(ROOM_A)
  })

  it("considers course schedule virtual blocks for rooms with default courses", async () => {
    // Debug: check expandCourseScheduleSlots directly
    const courseLike: CourseScheduleLike = {
      defaultRoomId: ROOM_A,
      durationMinutes: 60,
      scheduleRules: {
        rules: [{ weekday: 1, times: ["10:00"] }], // Monday 10:00 EDT
      },
      availableWeekdays: [],
      availableTimes: [],
    }
    // 2026-06-01 is a Monday. In June (EDT = UTC-4), 10:00 AM NY = 14:00 UTC
    const slots = expandCourseScheduleSlots(
      courseLike,
      new Date("2026-05-31T00:00:00.000Z"), // expandStart
      new Date("2026-06-02T23:59:59.000Z"), // expandEnd
    )
    expect(slots.length).toBeGreaterThan(0)
    expect(slots[0].startsAt.toISOString()).toBe("2026-06-01T14:00:00.000Z")

    const mockPrisma = createMockPrisma({
      rooms: [
        { id: ROOM_A, name: "Room A", capacity: 20, active: true },
        { id: ROOM_B, name: "Room B", capacity: 15, active: true },
      ],
      sessions: [],
      reservations: [],
      courses: [
        {
          id: "course-1",
          defaultRoomId: ROOM_A,
          durationMinutes: 60,
          scheduleRules: {
            rules: [{ weekday: 1, times: ["10:00"] }], // Monday 10:00
          },
          availableWeekdays: [],
          availableTimes: [],
        },
      ],
    })

    // Target window overlaps with the virtual block at 14:00-15:00 UTC
    const available = await findAvailableRoomsForSlot({
      targetStartsAt: new Date("2026-06-01T14:30:00.000Z"),
      targetEndsAt: new Date("2026-06-01T15:00:00.000Z"),
      prisma: mockPrisma as any,
    })

    expect(available.map((r) => r.id)).not.toContain(ROOM_A)
    expect(available.map((r) => r.id)).toContain(ROOM_B)
  })
})

// ─── Mock Prisma helper ─────────────────────────────────────────────────────

function createMockPrisma(data: {
  rooms: Array<{ id: string; name: string; capacity: number; active: boolean }>
  sessions: Array<{ id: string; roomId: string; startsAt: Date; durationMinutes: number }>
  reservations: Array<{ id: string; roomId: string; startsAt: Date; endsAt: Date; status: string }>
  courses: Array<{
    id: string
    defaultRoomId: string | null
    durationMinutes: number | null
    scheduleRules: unknown
    availableWeekdays: number[]
    availableTimes: string[]
  }>
}) {
  return {
    room: {
      findMany: async ({ where }: { where?: { active: boolean } } = {}) => {
        if (where?.active !== undefined) {
          return data.rooms.filter((r) => r.active === where.active)
        }
        return data.rooms
      },
    },
    classSession: {
      findMany: async ({ where }: { where: { roomId: { in: string[] } } }) => {
        const roomIds = new Set(where.roomId.in)
        return data.sessions.filter((s) => roomIds.has(s.roomId))
      },
    },
    roomReservation: {
      findMany: async ({ where }: { where: { roomId: { in: string[] } } }) => {
        const roomIds = new Set(where.roomId.in)
        return data.reservations.filter((r) => roomIds.has(r.roomId))
      },
    },
    courseCatalog: {
      findMany: async ({ where }: { where: { defaultRoomId: { in: string[] } } }) => {
        const roomIds = new Set(where.defaultRoomId.in)
        return data.courses.filter((c) => c.defaultRoomId && roomIds.has(c.defaultRoomId))
      },
    },
  }
}
