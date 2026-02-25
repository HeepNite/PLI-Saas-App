import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUser = vi.fn()

const mockPrisma = {
  attendance: {
    findFirst: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  pointsRule: {
    findUnique: vi.fn(),
  },
  pointsLedger: {
    create: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUser(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

describe("profile bookings check-in route", () => {
  const usersApi = { getUser: vi.fn() }

  beforeEach(() => {
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockUpsertUser.mockReset()
    usersApi.getUser.mockReset()
    mockPrisma.attendance.findFirst.mockReset()
    mockPrisma.attendance.update.mockReset()
    mockPrisma.attendance.count.mockReset()
    mockPrisma.pointsRule.findUnique.mockReset()
    mockPrisma.pointsLedger.create.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { POST } = await import("@/app/api/profile/bookings/checkin/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId: "att_1" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid payload", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    const { POST } = await import("@/app/api/profile/bookings/checkin/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId: "" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("checks in a scheduled class and awards milestone points", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    const startsAt = new Date(Date.now() + 30 * 60 * 1000)
    mockPrisma.attendance.findFirst.mockResolvedValue({
      id: "att_1",
      userId: "db_user",
      status: "scheduled",
      checkedInAt: new Date("2026-02-14T12:00:00.000Z"),
      metadata: { source: "package_assignment" },
      session: {
        id: "session_1",
        courseSlug: "salsa-femenina-matutina",
        title: "Salsa Femenina",
        startsAt,
      },
      packageUsage: {
        packagePurchaseId: "pkg_1",
        packagePurchase: {
          id: "pkg_1",
          packageId: "morning-3-week",
          packageLabel: "Morning 3-week pack",
          isUnlimited: false,
          remainingCredits: 4,
          status: "active",
        },
      },
    })
    mockPrisma.attendance.update.mockResolvedValue({
      id: "att_1",
      status: "checked_in",
      checkedInAt: new Date("2026-02-14T12:15:00.000Z"),
      session: {
        id: "session_1",
        courseSlug: "salsa-femenina-matutina",
        title: "Salsa Femenina",
        startsAt,
      },
      packageUsage: {
        packagePurchase: {
          id: "pkg_1",
          packageId: "morning-3-week",
          packageLabel: "Morning 3-week pack",
          isUnlimited: false,
          remainingCredits: 4,
          status: "active",
        },
      },
    })
    mockPrisma.attendance.count.mockResolvedValue(3)
    mockPrisma.pointsRule.findUnique.mockResolvedValue(null)
    mockPrisma.pointsLedger.create.mockResolvedValue({ id: "points_1" })

    const { POST } = await import("@/app/api/profile/bookings/checkin/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId: "att_1" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.alreadyCheckedIn).toBe(false)
    expect(data.attendance.status).toBe("checked_in")
    expect(data.points.awarded).toBeGreaterThan(0)
    expect(mockPrisma.attendance.update).toHaveBeenCalled()
    expect(mockPrisma.pointsLedger.create).toHaveBeenCalled()
  })

  it("returns 400 when check-in is attempted too early", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    const startsAt = new Date(Date.now() + 3 * 60 * 60 * 1000)
    mockPrisma.attendance.findFirst.mockResolvedValue({
      id: "att_early",
      userId: "db_user",
      status: "scheduled",
      checkedInAt: startsAt,
      metadata: null,
      session: {
        id: "session_1",
        courseSlug: "salsa-femenina-matutina",
        title: "Salsa Femenina",
        startsAt,
      },
      packageUsage: null,
    })

    const { POST } = await import("@/app/api/profile/bookings/checkin/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId: "att_early" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(mockPrisma.attendance.update).not.toHaveBeenCalled()
  })

  it("returns 400 when check-in window is already closed", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    const startsAt = new Date(Date.now() - 5 * 60 * 60 * 1000)
    mockPrisma.attendance.findFirst.mockResolvedValue({
      id: "att_late",
      userId: "db_user",
      status: "scheduled",
      checkedInAt: startsAt,
      metadata: null,
      session: {
        id: "session_1",
        courseSlug: "salsa-femenina-matutina",
        title: "Salsa Femenina",
        startsAt,
        durationMinutes: 60,
      },
      packageUsage: null,
    })

    const { POST } = await import("@/app/api/profile/bookings/checkin/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId: "att_late" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(mockPrisma.attendance.update).not.toHaveBeenCalled()
  })
})
