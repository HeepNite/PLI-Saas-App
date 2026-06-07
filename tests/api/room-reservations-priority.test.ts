import { beforeEach, describe, expect, it, vi } from "vitest"

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

describe("room reservation priority API", () => {
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

  describe("POST reservation with buffer and virtual blocks", () => {
    it("returns 409 with availableRooms when reservation overlaps existing ClassSession", async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", active: true })
      mockPrisma.classSession.findMany.mockResolvedValue([
        { id: "s1", roomId: "room-1", startsAt: new Date("2026-04-05T14:00:00.000Z"), durationMinutes: 60 },
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
          title: "Private",
          reason: "1:1",
          startsAt: "2026-04-05T14:15:00.000Z",
          endsAt: "2026-04-05T15:15:00.000Z",
        }),
      }))

      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.availableRooms).toBeDefined()
      expect(Array.isArray(data.availableRooms)).toBe(true)
    })

    it("returns 409 with availableRooms when reservation overlaps course schedule virtual slot", async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", active: true })
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
      expect(data.availableRooms).toBeDefined()
    })

    it("returns 409 when reservation has 14min gap (buffer violation)", async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", active: true })
      // Session ends at 14:00 UTC
      mockPrisma.classSession.findMany.mockResolvedValue([
        { id: "s1", roomId: "room-1", startsAt: new Date("2026-04-05T13:00:00.000Z"), durationMinutes: 60 },
      ])
      mockPrisma.roomReservation.findMany.mockResolvedValue([])
      mockPrisma.courseCatalog.findMany.mockResolvedValue([])

      const { POST } = await import("@/app/api/staff/room-reservations/route")
      // Reservation starts at 14:14 UTC — only 14min gap (buffer is 15min)
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

    it("returns 201 when reservation has 16min gap (sufficient buffer)", async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", active: true })
      // Session ends at 14:00 UTC
      mockPrisma.classSession.findMany.mockResolvedValue([
        { id: "s1", roomId: "room-1", startsAt: new Date("2026-04-05T13:00:00.000Z"), durationMinutes: 60 },
      ])
      mockPrisma.roomReservation.findMany.mockResolvedValue([])
      mockPrisma.courseCatalog.findMany.mockResolvedValue([])
      mockPrisma.roomReservation.create.mockResolvedValue({ id: "res-new" })
      mockPrisma.roomAuditLog.create.mockResolvedValue({ id: "audit-1" })

      const { POST } = await import("@/app/api/staff/room-reservations/route")
      // Reservation starts at 14:16 UTC — 16min gap exceeds 15min buffer
      const res = await POST(new Request("http://localhost/api/staff/room-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: "room-1",
          title: "Private",
          reason: "1:1",
          startsAt: "2026-04-05T14:16:00.000Z",
          endsAt: "2026-04-05T15:16:00.000Z",
        }),
      }))

      expect(res.status).toBe(201)
    })

    it("returns 201 for reservation on free slot", async () => {
      mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", active: true })
      mockPrisma.classSession.findMany.mockResolvedValue([])
      mockPrisma.roomReservation.findMany.mockResolvedValue([])
      mockPrisma.courseCatalog.findMany.mockResolvedValue([])
      mockPrisma.roomReservation.create.mockResolvedValue({ id: "res-new" })
      mockPrisma.roomAuditLog.create.mockResolvedValue({ id: "audit-1" })

      const { POST } = await import("@/app/api/staff/room-reservations/route")
      const res = await POST(new Request("http://localhost/api/staff/room-reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: "room-1",
          title: "Private",
          reason: "1:1",
          startsAt: "2026-04-05T18:00:00.000Z",
          endsAt: "2026-04-05T19:00:00.000Z",
        }),
      }))

      expect(res.status).toBe(201)
    })
  })

  describe("PUT reservation with buffer and virtual blocks", () => {
    it("returns 409 with availableRooms when edited reservation creates new overlap", async () => {
      mockPrisma.roomReservation.findUnique.mockResolvedValue({
        id: "res-1",
        roomId: "room-1",
        title: "Old",
        reason: "old reason",
        category: null,
        startsAt: new Date("2026-04-05T10:00:00.000Z"),
        endsAt: new Date("2026-04-05T11:00:00.000Z"),
        status: "active",
        createdByClerkUserId: "u",
        assignedStaffClerkUserId: null,
        cancellationReason: null,
      })
      mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", active: true })
      mockPrisma.classSession.findMany.mockResolvedValue([
        { id: "s1", roomId: "room-1", startsAt: new Date("2026-04-05T14:00:00.000Z"), durationMinutes: 60 },
      ])
      mockPrisma.roomReservation.findMany.mockResolvedValue([
        { id: "res-1", roomId: "room-1", startsAt: new Date("2026-04-05T10:00:00.000Z"), endsAt: new Date("2026-04-05T11:00:00.000Z"), status: "active" },
      ])
      mockPrisma.courseCatalog.findMany.mockResolvedValue([])
      mockPrisma.room.findMany.mockResolvedValue([
        { id: "room-2", name: "Room B", active: true },
      ])

      const { PUT } = await import("@/app/api/staff/room-reservations/[id]/route")
      // Edit reservation to overlap with session at 14:00
      const res = await PUT(
        new Request("http://localhost/api/staff/room-reservations/res-1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startsAt: "2026-04-05T13:30:00.000Z",
            endsAt: "2026-04-05T14:30:00.000Z",
          }),
        }),
        { params: Promise.resolve({ id: "res-1" }) }
      )

      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.availableRooms).toBeDefined()
    })
  })
})
