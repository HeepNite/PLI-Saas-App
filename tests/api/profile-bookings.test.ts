import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUser = vi.fn()
const mockSyncScheduled = vi.fn()

const mockPrisma = {
  purchase: {
    findMany: vi.fn(),
  },
  attendance: {
    findMany: vi.fn(),
  },
  packagePurchase: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUser(...args),
}))

vi.mock("@/lib/bookings", () => ({
  syncScheduledAttendanceFromPurchase: (...args: unknown[]) => mockSyncScheduled(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

describe("profile bookings route", () => {
  const usersApi = { getUser: vi.fn() }

  beforeEach(() => {
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockUpsertUser.mockReset()
    mockSyncScheduled.mockReset()
    usersApi.getUser.mockReset()
    mockPrisma.purchase.findMany.mockReset()
    mockPrisma.attendance.findMany.mockReset()
    mockPrisma.packagePurchase.findMany.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { GET } = await import("@/app/api/profile/bookings/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(401)
  })

  it("returns bookings and packages", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockPrisma.purchase.findMany.mockResolvedValue([])
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "att_1",
        status: "scheduled",
        sessionId: "session_1",
        session: {
          courseSlug: "musica-bebes",
          title: "Musical stimulation for babies",
          startsAt: new Date("2026-03-10T15:00:00.000Z"),
        },
        packageUsage: null,
      },
    ])
    mockPrisma.packagePurchase.findMany.mockResolvedValue([
      {
        id: "pkg_1",
        packageId: "babies-2-week",
        packageLabel: "Babies 2-week pack",
        courseSlug: "musica-bebes",
        remainingCredits: 4,
        totalCredits: 10,
        isUnlimited: false,
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        packagePlan: { courseSlugs: ["musica-bebes"], label: "Babies 2-week pack" },
      },
    ])

    const { GET } = await import("@/app/api/profile/bookings/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.bookings).toHaveLength(1)
    expect(data.packages).toHaveLength(1)
  })
})
