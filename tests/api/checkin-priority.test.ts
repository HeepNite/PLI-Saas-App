import { beforeEach, describe, expect, it, vi } from "vitest"

const mockConsumePackageCredit = vi.fn()
const mockClerkAuth = vi.fn(async () => ({ userId: null, sessionClaims: null }))
const mockClerkClient = vi.fn(async () => ({
  users: { getUser: vi.fn() },
}))

const mockValidateCheckInBody = vi.fn()
const mockValidateCheckOutBody = vi.fn()

const mockPrisma = {
  user: { findFirst: vi.fn() },
  courseCatalog: { findUnique: vi.fn() },
  purchase: { findFirst: vi.fn(), create: vi.fn() },
  room: { findUnique: vi.fn() },
  classSession: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  attendance: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), count: vi.fn() },
  pointsRule: { findUnique: vi.fn() },
  pointsLedger: { create: vi.fn() },
  roomReservation: { findMany: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))
vi.mock("@/lib/packages", () => ({ consumePackageCreditForAttendance: (...args: unknown[]) => mockConsumePackageCredit(...args) }))
vi.mock("@/lib/security/checkin-validation", () => ({
  validateCheckInBody: (...args: unknown[]) => mockValidateCheckInBody(...args),
  validateCheckOutBody: (...args: unknown[]) => mockValidateCheckOutBody(...args),
}))
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockClerkAuth(),
  clerkClient: () => mockClerkClient(),
}))

describe("check-in school priority", () => {
  beforeEach(() => {
    vi.resetModules()
    mockPrisma.user.findFirst.mockReset()
    mockPrisma.room.findUnique.mockReset()
    mockPrisma.room.findUnique.mockResolvedValue(null)
    mockPrisma.classSession.findUnique.mockReset()
    mockPrisma.classSession.findUnique.mockResolvedValue(null)
    mockPrisma.classSession.findMany.mockReset()
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.attendance.findUnique.mockReset()
    mockPrisma.attendance.upsert.mockReset()
    mockPrisma.attendance.update.mockReset()
    mockPrisma.attendance.count.mockReset()
    mockPrisma.courseCatalog.findUnique.mockReset()
    mockPrisma.courseCatalog.findUnique.mockResolvedValue({ title: "Mock Course", dropInPriceCents: 2000 })
    mockPrisma.purchase.create.mockReset()
    mockPrisma.purchase.findFirst.mockReset()
    mockPrisma.purchase.create.mockResolvedValue({ id: "mock-purchase" })
    mockPrisma.purchase.findFirst.mockResolvedValue(null)
    mockPrisma.pointsRule.findUnique.mockReset()
    mockPrisma.pointsLedger.create.mockReset()
    mockPrisma.$executeRaw.mockReset()
    mockPrisma.$executeRaw.mockResolvedValue(1)
    mockPrisma.$transaction.mockReset()
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
    mockConsumePackageCredit.mockReset()
    mockClerkAuth.mockReset()
    mockClerkAuth.mockResolvedValue({ userId: null, sessionClaims: null })
    mockClerkClient.mockReset()
    mockPrisma.roomReservation.findMany.mockReset()
    mockValidateCheckInBody.mockReset()
    mockValidateCheckInBody.mockReturnValue({
      courseSlug: "salsa-femenina-matutina",
      roomId: "room-1",
      startsAt: new Date("2026-02-14T10:30:00.000Z"),
      durationMinutes: 60,
    })
    mockValidateCheckOutBody.mockReset()
    process.env.STAFF_CHECKIN_TOKEN = "test-token"
    delete process.env.ENABLE_RATE_LIMIT_IN_TESTS
    vi.useRealTimers()
  })

  it("check-in succeeds when active reservation exists in the room (school priority)", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.room.findUnique
      .mockResolvedValueOnce({
        id: "room-1",
        name: "Studio A",
        capacity: 24,
        location: "Main floor",
        active: true,
      })
      .mockResolvedValueOnce({
        id: "room-1",
        name: "Studio A",
        capacity: 24,
        location: "Main floor",
        active: true,
      })
    mockPrisma.classSession.findMany.mockResolvedValue([])
    // Active reservation overlaps the check-in time
    mockPrisma.roomReservation.findMany.mockResolvedValue([
      {
        id: "res-1",
        roomId: "room-1",
        startsAt: new Date("2026-02-14T10:00:00.000Z"),
        endsAt: new Date("2026-02-14T11:00:00.000Z"),
        status: "active",
      },
    ])
    mockPrisma.classSession.upsert.mockResolvedValue({
      id: "session_1",
      courseSlug: "salsa-femenina-matutina",
      title: "Morning class",
      startsAt: new Date("2026-02-14T10:30:00.000Z"),
      location: "Main floor",
      roomId: "room-1",
    })
    mockPrisma.attendance.upsert.mockResolvedValue({
      id: "att_1",
      checkedInAt: new Date("2026-02-14T10:25:00.000Z"),
    })
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockConsumePackageCredit.mockResolvedValue({
      packagePurchase: null,
      consumed: false,
    })

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
    // Reservation should still exist — not cancelled or modified
    expect(mockPrisma.roomReservation.findMany).toHaveBeenCalled()
  })

  it("check-in still blocked when overlapping ClassSession exists in room", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.room.findUnique.mockResolvedValue({
      id: "room-1",
      name: "Studio A",
      capacity: 24,
      location: "Main floor",
      active: true,
    })
    // Another class session overlaps
    mockPrisma.classSession.findMany.mockResolvedValue([
      {
        id: "session_conflict",
        roomId: "room-1",
        startsAt: new Date("2026-02-14T10:00:00.000Z"),
        durationMinutes: 60,
        title: "Existing class",
        courseSlug: "bachata-beginners",
      },
    ])
    mockPrisma.roomReservation.findMany.mockResolvedValue([])

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
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(409)
    expect(mockPrisma.classSession.upsert).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toMatchObject({
      error: "Room is unavailable for the requested time slot.",
      conflict: {
        sessionId: "session_conflict",
      },
    })
  })

  it("reservation remains in database after successful check-in (not cancelled)", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.room.findUnique
      .mockResolvedValueOnce({ id: "room-1", name: "Studio A", capacity: 24, location: null, active: true })
      .mockResolvedValueOnce({ id: "room-1", name: "Studio A", capacity: 24, location: null, active: true })
    mockPrisma.classSession.findMany.mockResolvedValue([])
    mockPrisma.roomReservation.findMany.mockResolvedValue([
      {
        id: "res-1",
        roomId: "room-1",
        startsAt: new Date("2026-02-14T10:00:00.000Z"),
        endsAt: new Date("2026-02-14T11:00:00.000Z"),
        status: "active",
      },
    ])
    mockPrisma.classSession.upsert.mockResolvedValue({
      id: "session_1",
      courseSlug: "salsa-femenina-matutina",
      title: "Morning class",
      startsAt: new Date("2026-02-14T10:30:00.000Z"),
      roomId: "room-1",
    })
    mockPrisma.attendance.upsert.mockResolvedValue({
      id: "att_1",
      checkedInAt: new Date("2026-02-14T10:25:00.000Z"),
    })
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
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    // Verify no reservation update/delete was called
    expect(mockPrisma.roomReservation.findMany).toHaveBeenCalled()
    // The reservation query was for checking — no mutation happened
  })
})
