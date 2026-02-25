import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUser = vi.fn()

const mockPrisma = {
  pointsLedger: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  pointsRule: {
    findUnique: vi.fn(),
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

describe("profile points route", () => {
  const usersApi = {
    getUser: vi.fn(),
  }

  beforeEach(() => {
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockUpsertUser.mockReset()
    usersApi.getUser.mockReset()
    mockPrisma.pointsLedger.findMany.mockReset()
    mockPrisma.pointsLedger.aggregate.mockReset()
    mockPrisma.pointsRule.findUnique.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi })
    mockPrisma.pointsRule.findUnique.mockResolvedValue(null)
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const { GET } = await import("@/app/api/profile/points/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(401)
  })

  it("returns points balance and entries", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockPrisma.pointsLedger.findMany.mockResolvedValue([
      {
        id: "pl_1",
        type: "PROFILE_COMPLETED",
        points: 10,
        meta: { source: "profile" },
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
      },
    ])
    mockPrisma.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 10 } })

    const { GET } = await import("@/app/api/profile/points/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.balance).toBe(10)
    expect(data.freeClassThreshold).toBe(500)
    expect(data.pointsToNextFreeClass).toBe(490)
    expect(data.freeClassesAvailable).toBe(0)
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0].type).toBe("PROFILE_COMPLETED")
  })
})
