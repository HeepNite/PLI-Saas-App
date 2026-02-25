import { beforeEach, describe, expect, it, vi } from "vitest"

const mockConsumePackageCredit = vi.fn()

const mockPrisma = {
  user: {
    findFirst: vi.fn(),
  },
  classSession: {
    upsert: vi.fn(),
  },
  attendance: {
    upsert: vi.fn(),
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

vi.mock("@/lib/packages", () => ({
  consumePackageCreditForAttendance: (...args: unknown[]) => mockConsumePackageCredit(...args),
}))

describe("staff checkin route", () => {
  beforeEach(() => {
    mockPrisma.user.findFirst.mockReset()
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.attendance.upsert.mockReset()
    mockPrisma.attendance.update.mockReset()
    mockPrisma.attendance.count.mockReset()
    mockPrisma.pointsRule.findUnique.mockReset()
    mockPrisma.pointsLedger.create.mockReset()
    mockConsumePackageCredit.mockReset()
    process.env.STAFF_CHECKIN_TOKEN = "test-token"
  })

  it("returns 401 for invalid token", async () => {
    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "wrong" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", email: "test@example.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates checkin and consumes package credit", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1" })
    mockPrisma.attendance.upsert.mockResolvedValue({
      id: "att_1",
      checkedInAt: new Date("2026-02-14T12:00:00.000Z"),
    })
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockConsumePackageCredit.mockResolvedValue({
      packagePurchase: {
        id: "pkg_1",
        packageId: "morning-3-week",
        packageLabel: "Morning 3-week pack",
        isUnlimited: false,
        remainingCredits: 11,
        status: "active",
      },
      consumed: true,
    })

    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", email: "test@example.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.package.packageId).toBe("morning-3-week")
    expect(data.attendance.status).toBe("checked_in")
  })

  it("returns 400 on invalid staff payload", async () => {
    const { POST } = await import("@/app/api/staff/checkin/route")
    const req = new Request("http://localhost/api/staff/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-staff-token": "test-token" },
      body: JSON.stringify({ courseSlug: "Musica Bebes", email: "test@example.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("marks attendance without package when no credits available", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "db_user" })
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1" })
    mockPrisma.attendance.upsert.mockResolvedValue({
      id: "att_1",
      checkedInAt: new Date("2026-02-14T12:00:00.000Z"),
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
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", email: "test@example.com" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.attendance.update).toHaveBeenCalled()
    const data = await res.json()
    expect(data.attendance.status).toBe("checked_in_no_package")
  })
})
