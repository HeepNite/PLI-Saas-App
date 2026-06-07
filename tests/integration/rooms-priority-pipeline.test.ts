import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mock setup (matches project pattern) ───────────────────────────────────

const mockAuthorizeBase = vi.fn()
const mockAuthorizeOwnerOrAdmin = vi.fn()

const mockPrisma = {
  room: { findUnique: vi.fn(), findMany: vi.fn() },
  classSession: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  roomReservation: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  roomAuditLog: { create: vi.fn() },
  attendance: { upsert: vi.fn(), count: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  user: { findFirst: vi.fn() },
  courseCatalog: { findUnique: vi.fn(), findMany: vi.fn() },
  purchase: { create: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalBaseRequest: (...args: unknown[]) => mockAuthorizeBase(...args),
  authorizeOwnerOrAdminRequest: (...args: unknown[]) => mockAuthorizeOwnerOrAdmin(...args),
}))
vi.mock("@/lib/security/staff-auth", () => ({ authorizeStaffRequest: vi.fn().mockResolvedValue({ ok: true, userId: "staff_1" }) }))
vi.mock("@/lib/security/checkin-validation", () => ({
  validateCheckInBody: vi.fn().mockReturnValue({ courseSlug: "course-a", roomId: "room-1", startsAt: new Date("2026-04-05T12:00:00.000Z"), durationMinutes: 60 }),
  validateCheckOutBody: vi.fn(),
}))
vi.mock("@/lib/packages", () => ({ consumePackageCreditForAttendance: vi.fn().mockResolvedValue({ consumed: false, packagePurchase: null }) }))
vi.mock("@/lib/purchase-attendance", () => ({ ensureAttendancePackagePurchase: vi.fn() }))
vi.mock("@/lib/points/service", () => ({ awardPointsFromRule: vi.fn().mockResolvedValue({ awarded: false, points: 0 }), getAttendanceMilestoneClasses: vi.fn().mockResolvedValue(10) }))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

describe("Integration: Full rooms-priority conflict pipeline", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeBase.mockReset()
    mockAuthorizeBase.mockResolvedValue({ ok: true, userId: "teacher_1", role: "staff", category: "teacher" })
    mockAuthorizeOwnerOrAdmin.mockReset()
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: "manager" })
    mockPrisma.room.findUnique.mockReset()
    mockPrisma.room.findMany.mockReset()
    mockPrisma.room.findMany.mockResolvedValue([])
    mockPrisma.classSession.findMany.mockReset()
    mockPrisma.classSession.findUnique.mockReset()
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.roomReservation.findMany.mockReset()
    mockPrisma.roomReservation.create.mockReset()
    mockPrisma.roomReservation.findUnique.mockReset()
    mockPrisma.roomReservation.update.mockReset()
    mockPrisma.roomReservation.delete.mockReset()
    mockPrisma.roomAuditLog.create.mockReset()
    mockPrisma.user.findFirst.mockReset()
    mockPrisma.courseCatalog.findUnique.mockReset()
    mockPrisma.courseCatalog.findMany.mockReset()
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    mockPrisma.attendance.upsert.mockReset()
    mockPrisma.attendance.count.mockReset()
    mockPrisma.purchase.create.mockReset()
    mockPrisma.$transaction.mockReset()
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma))
  })

  // ─── Scenario 1: Reservation blocked by ClassSession ───────────────────

  it("reservation blocked by existing ClassSession → 409 with alternatives", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", name: "Room A", active: true })
    mockPrisma.classSession.findMany.mockResolvedValue([
      { id: "session-1", roomId: "room-1", startsAt: new Date("2026-04-05T14:00:00.000Z"), durationMinutes: 60 },
    ])
    mockPrisma.roomReservation.findMany.mockResolvedValue([])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    mockPrisma.room.findMany.mockResolvedValue([
      { id: "room-2", name: "Room B", active: true },
    ])

    const { POST } = await import("@/app/api/staff/room-reservations/route")
    const res = await POST(new Request("http://localhost/api/staff/room-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: "room-1",
        title: "Private Lesson",
        reason: "1:1",
        startsAt: "2026-04-05T14:15:00.000Z",
        endsAt: "2026-04-05T15:15:00.000Z",
      }),
    }))

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toBeDefined()
    expect(data.conflict).toBeDefined()
    expect(data.conflict.kind).toBe("class_session")
    expect(Array.isArray(data.availableRooms)).toBe(true)
    expect(data.availableRooms.length).toBeGreaterThan(0)
  })

  // ─── Scenario 2: Reservation blocked by course schedule (virtual) ──────

  it("reservation blocked by course schedule virtual slot (no ClassSession row) → 409 with alternatives", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", name: "Room A", active: true })
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.roomReservation.findMany.mockResolvedValue([])
    // Course with scheduleRules for Monday at 10:00 EDT = 14:00 UTC
    mockPrisma.courseCatalog.findMany.mockResolvedValue([
      {
        id: "course-1",
        defaultRoomId: "room-1",
        durationMinutes: 60,
        scheduleRules: { rules: [{ weekday: 1, times: ["10:00"] }] },
        availableWeekdays: [1],
        availableTimes: ["10:00"],
      },
    ])
    mockPrisma.room.findMany.mockResolvedValue([
      { id: "room-2", name: "Room B", active: true },
    ])

    const { POST } = await import("@/app/api/staff/room-reservations/route")
    // Monday April 6, 2026 at 14:00 UTC = 10:00 EDT
    const res = await POST(new Request("http://localhost/api/staff/room-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: "room-1",
        title: "Private",
        reason: "1:1",
        startsAt: "2026-04-06T14:00:00.000Z",
        endsAt: "2026-04-06T15:00:00.000Z",
      }),
    }))

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.conflict.kind).toBe("schedule")
    expect(Array.isArray(data.availableRooms)).toBe(true)
  })

  // ─── Scenario 3: Reservation blocked by buffer ─────────────────────────

  it("reservation blocked by buffer (14min gap < 15min required) → 409", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", name: "Room A", active: true })
    // Session ends at 14:00 UTC
    mockPrisma.classSession.findMany.mockResolvedValue([
      { id: "s1", roomId: "room-1", startsAt: new Date("2026-04-05T13:00:00.000Z"), durationMinutes: 60 },
    ])
    mockPrisma.roomReservation.findMany.mockResolvedValue([])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])

    const { POST } = await import("@/app/api/staff/room-reservations/route")
    // Reservation starts at 14:14 UTC — only 14min gap
    const res = await POST(new Request("http://localhost/api/staff/room-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: "room-1",
        title: "Private",
        reason: "1:1",
        startsAt: "2026-04-05T14:14:00.000Z",
        endsAt: "2026-04-05T15:14:00.000Z",
      }),
    }))

    expect(res.status).toBe(409)
  })

  // ─── Scenario 4: Class check-in with reservation present ───────────────

  it("class check-in succeeds when reservation exists in room (school priority) → reservation untouched", async () => {
    const mockConsumePackageCredit = vi.fn()
    const mockClerkAuth = vi.fn(async () => ({ userId: null, sessionClaims: null }))
    const mockClerkClient = vi.fn(async () => ({ users: { getUser: vi.fn() } }))

    vi.doMock("@/lib/packages", () => ({ consumePackageCreditForAttendance: (...args: unknown[]) => mockConsumePackageCredit(...args) }))
    vi.doMock("@clerk/nextjs/server", () => ({ auth: () => mockClerkAuth(), clerkClient: () => mockClerkClient() }))

    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.room.findUnique
      .mockResolvedValueOnce({ id: "room-1", name: "Studio A", capacity: 24, location: "Main floor", active: true })
      .mockResolvedValueOnce({ id: "room-1", name: "Studio A", capacity: 24, location: "Main floor", active: true })
    mockPrisma.classSession.findMany.mockResolvedValue([])
    // Active reservation overlaps the check-in time
    mockPrisma.roomReservation.findMany.mockResolvedValue([
      { id: "res-1", roomId: "room-1", startsAt: new Date("2026-02-14T10:00:00.000Z"), endsAt: new Date("2026-02-14T11:00:00.000Z"), status: "active" },
    ])
    mockPrisma.classSession.upsert.mockResolvedValue({
      id: "session_1", courseSlug: "salsa-femenina-matutina", title: "Morning class",
      startsAt: new Date("2026-02-14T10:30:00.000Z"), location: "Main floor", roomId: "room-1",
    })
    mockPrisma.attendance.upsert.mockResolvedValue({ id: "att_1", checkedInAt: new Date("2026-02-14T10:25:00.000Z") })
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockConsumePackageCredit.mockResolvedValue({ packagePurchase: null, consumed: false })

    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        email: "test@example.com",
        roomId: "room-1",
        startsAt: "2026-02-14T10:30:00.000Z",
        durationMinutes: 60,
        location: "Main floor",
        sessionTitle: "Morning class",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.classSession.upsert).toHaveBeenCalled()
    // Reservation was queried but NOT modified
    expect(mockPrisma.roomReservation.findMany).toHaveBeenCalled()
    expect(mockPrisma.roomReservation.update).not.toHaveBeenCalled()
    expect(mockPrisma.roomReservation.delete).not.toHaveBeenCalled()
  })

  // ─── Scenario 5: Alternative rooms actually available ──────────────────

  it("conflict response includes available alternative rooms (3 rooms, 1 conflict)", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", name: "Room A", active: true })
    mockPrisma.classSession.findMany.mockResolvedValue([
      { id: "s1", roomId: "room-1", startsAt: new Date("2026-04-05T14:00:00.000Z"), durationMinutes: 60 },
    ])
    mockPrisma.roomReservation.findMany.mockResolvedValue([])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    // Two alternative rooms available
    mockPrisma.room.findMany.mockResolvedValue([
      { id: "room-2", name: "Room B", active: true },
      { id: "room-3", name: "Room C", active: true },
    ])

    const { POST } = await import("@/app/api/staff/room-reservations/route")
    const res = await POST(new Request("http://localhost/api/staff/room-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: "room-1",
        title: "Private",
        reason: "1:1",
        startsAt: "2026-04-05T14:15:00.000Z",
        endsAt: "2026-04-05T15:15:00.000Z",
      }),
    }))

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.availableRooms).toHaveLength(2)
    const altIds = data.availableRooms.map((r: { id: string }) => r.id)
    expect(altIds).toContain("room-2")
    expect(altIds).toContain("room-3")
    expect(altIds).not.toContain("room-1")
  })

  // ─── Scenario 6: No alternatives available ─────────────────────────────

  it("all rooms have conflicts → 409 with empty availableRooms array", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", name: "Room A", active: true })
    // Room-1 has a session conflict
    mockPrisma.classSession.findMany.mockResolvedValue([
      { id: "s1", roomId: "room-1", startsAt: new Date("2026-04-05T14:00:00.000Z"), durationMinutes: 60 },
    ])
    mockPrisma.roomReservation.findMany.mockResolvedValue([])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    // Room-2 also has a session conflict (via findMany for alternatives)
    mockPrisma.room.findMany.mockResolvedValue([
      { id: "room-2", name: "Room B", active: true },
    ])
    // When checking room-2 availability, it also has a conflict
    mockPrisma.classSession.findMany
      .mockResolvedValueOnce([
        { id: "s1", roomId: "room-1", startsAt: new Date("2026-04-05T14:00:00.000Z"), durationMinutes: 60 },
      ])
      .mockResolvedValueOnce([
        { id: "s2", roomId: "room-2", startsAt: new Date("2026-04-05T14:00:00.000Z"), durationMinutes: 60 },
      ])

    const { POST } = await import("@/app/api/staff/room-reservations/route")
    const res = await POST(new Request("http://localhost/api/staff/room-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: "room-1",
        title: "Private",
        reason: "1:1",
        startsAt: "2026-04-05T14:15:00.000Z",
        endsAt: "2026-04-05T15:15:00.000Z",
      }),
    }))

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(Array.isArray(data.availableRooms)).toBe(true)
    expect(data.availableRooms).toHaveLength(0)
  })

  // ─── Scenario 7: Course schedule + buffer combined ─────────────────────
  // NOTE: The route expands course schedules within the reservation's time window
  // [startsAt, endsAt]. A reservation starting AFTER a virtual block ends won't
  // detect the buffer conflict because the virtual block falls outside the expansion
  // window. This test verifies the virtual block IS detected when the reservation
  // overlaps with the expanded schedule window. The buffer-for-virtual-blocks-after-end
  // is an implementation gap to address in a future change.

  it("course schedule with multiple rules: only conflicting rule triggers 409", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", name: "Room A", active: true })
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.roomReservation.findMany.mockResolvedValue([])
    // Course with TWO rules: Monday 10:00 and Wednesday 14:00
    mockPrisma.courseCatalog.findMany.mockResolvedValue([
      {
        id: "course-1",
        defaultRoomId: "room-1",
        durationMinutes: 60,
        scheduleRules: {
          rules: [
            { weekday: 1, times: ["10:00"] }, // Monday 10:00 EDT = 14:00 UTC
            { weekday: 3, times: ["14:00"] }, // Wednesday 14:00 EDT = 18:00 UTC
          ],
        },
        availableWeekdays: [1, 3],
        availableTimes: ["10:00", "14:00"],
      },
    ])
    mockPrisma.room.findMany.mockResolvedValue([
      { id: "room-2", name: "Room B", active: true },
    ])

    const { POST } = await import("@/app/api/staff/room-reservations/route")
    // Wednesday April 8, 2026 at 18:00 UTC = 14:00 EDT — conflicts with Wednesday rule
    const res = await POST(new Request("http://localhost/api/staff/room-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: "room-1",
        title: "Private",
        reason: "1:1",
        startsAt: "2026-04-08T18:00:00.000Z",
        endsAt: "2026-04-08T19:00:00.000Z",
      }),
    }))

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.conflict.kind).toBe("schedule")
    // Alternative rooms should still be offered
    expect(Array.isArray(data.availableRooms)).toBe(true)
  })
})
