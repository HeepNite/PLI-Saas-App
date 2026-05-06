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

describe("staff room reservations API", () => {
  beforeEach(() => {
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

  it("GET limits professor visibility to assigned reservations", async () => {
    mockPrisma.roomReservation.findMany.mockResolvedValue([
      { id: "r1", assignedStaffClerkUserId: "teacher_1", roomId: "room-1", title: "A", reason: "X", category: null, startsAt: new Date(), endsAt: new Date(), status: "active", createdByClerkUserId: "u", cancellationReason: null },
      { id: "r2", assignedStaffClerkUserId: "teacher_2", roomId: "room-1", title: "B", reason: "Y", category: null, startsAt: new Date(), endsAt: new Date(), status: "active", createdByClerkUserId: "u", cancellationReason: null },
    ])

    const { GET } = await import("@/app/api/staff/room-reservations/route")
    const res = await GET(new Request("http://localhost/api/staff/room-reservations"))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0].id).toBe("r1")
  })

  it("POST rejects reservation when room conflict exists", async () => {
    mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", active: true })
    mockPrisma.classSession.findMany.mockResolvedValue([{ id: "s1", roomId: "room-1", startsAt: new Date("2026-04-05T12:00:00.000Z"), durationMinutes: 60 }])
    mockPrisma.roomReservation.findMany.mockResolvedValue([])

    const { POST } = await import("@/app/api/staff/room-reservations/route")
    const res = await POST(new Request("http://localhost/api/staff/room-reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: "room-1", title: "Private", reason: "1:1", startsAt: "2026-04-05T12:15:00.000Z", endsAt: "2026-04-05T13:15:00.000Z" }),
    }))

    expect(res.status).toBe(409)
  })

  it("checkin route succeeds despite active reservation (school priority)", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1", email: "u@x.com", name: "U", phone: null })
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({ title: "Course", dropInPriceCents: 1000 })
    mockPrisma.classSession.findUnique.mockResolvedValue(null)
    mockPrisma.room.findUnique.mockResolvedValue({ id: "room-1", name: "Room", capacity: 10, location: null, active: true })
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.roomReservation.findMany.mockResolvedValue([{ id: "res1", roomId: "room-1", startsAt: new Date("2026-04-05T12:30:00.000Z"), endsAt: new Date("2026-04-05T13:30:00.000Z"), status: "active" }])
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1", courseSlug: "course-a", startsAt: new Date("2026-04-05T12:00:00.000Z"), roomId: "room-1" })
    mockPrisma.attendance.upsert.mockResolvedValue({ id: "att_1", checkedInAt: new Date(), status: "checked_in" })
    mockPrisma.attendance.count.mockResolvedValue(1)

    const { POST } = await import("@/app/api/staff/checkin/route")
    const res = await POST(new Request("http://localhost/api/staff/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }))
    // School priority: check-in succeeds despite active reservation
    expect(res.status).toBe(200)
  })

  it("safe-delete hard-deletes reservation for owner/admin and writes audit", async () => {
    mockPrisma.roomReservation.findUnique.mockResolvedValue({
      id: "res_1",
      roomId: "room-1",
      title: "Private",
      metadata: null,
    })
    mockPrisma.roomReservation.delete.mockResolvedValue({ id: "res_1" })
    mockPrisma.roomAuditLog.create.mockResolvedValue({ id: "audit_1" })

    const { POST } = await import("@/app/api/staff/room-reservations/[id]/safe-delete/route")
    const res = await POST(
      new Request("http://localhost/api/staff/room-reservations/res_1/safe-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "cleanup" }),
      }),
      { params: Promise.resolve({ id: "res_1" }) }
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.roomReservation.delete).toHaveBeenCalledWith({ where: { id: "res_1" } })
    expect(mockPrisma.roomAuditLog.create).toHaveBeenCalled()
  })

  it("safe-delete denies reservation with operational links", async () => {
    mockPrisma.roomReservation.findUnique.mockResolvedValue({
      id: "res_2",
      roomId: "room-1",
      title: "Private",
      metadata: { hasAttendanceLinks: true },
    })

    const { POST } = await import("@/app/api/staff/room-reservations/[id]/safe-delete/route")
    const res = await POST(
      new Request("http://localhost/api/staff/room-reservations/res_2/safe-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "cleanup" }),
      }),
      { params: Promise.resolve({ id: "res_2" }) }
    )

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toMatchObject({ reasonCode: "HAS_OPERATIONAL_LINKS" })
    expect(mockPrisma.roomReservation.delete).not.toHaveBeenCalled()
  })
})
