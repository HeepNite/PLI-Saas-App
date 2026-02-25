import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUser = vi.fn()

const mockPrisma = {
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

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

describe("profile packages route", () => {
  const usersApi = {
    getUser: vi.fn(),
  }

  beforeEach(() => {
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockUpsertUser.mockReset()
    usersApi.getUser.mockReset()
    mockPrisma.packagePurchase.findMany.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { GET } = await import("@/app/api/profile/packages/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(401)
  })

  it("returns package list and summary", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockPrisma.packagePurchase.findMany.mockResolvedValue([
      {
        id: "pkg_1",
        packageId: "morning-3-week",
        packageLabel: "Morning 3-week pack",
        courseSlug: "zumba-matutino",
        status: "active",
        isUnlimited: false,
        totalCredits: 16,
        remainingCredits: 12,
        purchasedAt: new Date("2026-02-01T00:00:00.000Z"),
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        lastUsedAt: null,
        source: "stripe",
        packagePlan: { label: "Morning 3-week pack", courseSlug: "zumba-matutino", cadence: "3/semana" },
      },
    ])

    const { GET } = await import("@/app/api/profile/packages/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.packages).toHaveLength(1)
    expect(data.summary.activePackages).toBe(1)
    expect(data.summary.totalRemainingCredits).toBe(12)
  })
})
