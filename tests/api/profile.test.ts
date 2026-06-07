import { describe, it, expect, vi, beforeEach } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUser = vi.fn()

const mockPrisma = {
  studentProfile: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  billingAddress: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  purchase: {
    count: vi.fn(),
  },
  pointsLedger: {
    aggregate: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
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

describe("profile route", () => {
  const usersApi = {
    getUser: vi.fn(),
    updateUser: vi.fn(),
  }

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockUpsertUser.mockReset()
    usersApi.getUser.mockReset()
    usersApi.updateUser.mockReset()
    mockPrisma.studentProfile.findUnique.mockReset()
    mockPrisma.studentProfile.upsert.mockReset()
    mockPrisma.billingAddress.upsert.mockReset()
    mockPrisma.billingAddress.deleteMany.mockReset()
    mockPrisma.purchase.count.mockReset()
    mockPrisma.pointsLedger.aggregate.mockReset()
    mockPrisma.pointsLedger.findUnique.mockReset()
    mockPrisma.pointsLedger.create.mockReset()
    mockPrisma.pointsRule.findUnique.mockReset()

    mockClerkClient.mockResolvedValue({ users: usersApi })
    mockPrisma.purchase.count.mockResolvedValue(0)
    mockPrisma.pointsRule.findUnique.mockResolvedValue(null)
    mockPrisma.pointsLedger.findUnique.mockResolvedValue(null)
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const { GET } = await import("@/app/api/profile/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(401)
  })

  it("returns profile data and points", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      id: "user_123",
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user", email: "test@example.com", name: "Test User", phone: "5555555555" })
    mockPrisma.studentProfile.findUnique.mockResolvedValue({
      id: "profile_1",
      userId: "db_user",
      birthDate: new Date("2020-01-01"),
      emergencyContactName: "Ana",
      emergencyContactRelation: "Madre",
      emergencyContactPhone: "+1 929 555 0000",
    })
    mockPrisma.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 18 } })
    mockPrisma.purchase.count.mockResolvedValue(1)

    const { GET } = await import("@/app/api/profile/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.pointsBalance).toBe(18)
    expect(data.profileComplete).toBe(true)
    expect(data.user.email).toBe("test@example.com")
  })

  it("updates profile and awards points", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      id: "user_123",
      firstName: "Old",
      lastName: "Name",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user", email: "test@example.com", name: "New User", phone: "5555555555" })
    mockPrisma.studentProfile.upsert.mockResolvedValue({ id: "profile_1", userId: "db_user" })
    mockPrisma.studentProfile.findUnique.mockResolvedValue({
      id: "profile_1",
      userId: "db_user",
      birthDate: new Date("2020-01-01"),
      emergencyContactName: "Ana",
      emergencyContactRelation: "Madre",
      emergencyContactPhone: "123",
    })
    mockPrisma.pointsLedger.aggregate.mockResolvedValue({ _sum: { points: 10 } })

    const { PUT } = await import("@/app/api/profile/route")
    const req = new Request("http://localhost/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "New",
        lastName: "User",
        birthDate: "2020-01-01",
        emergencyContactName: "Ana",
        emergencyContactRelation: "Madre",
        emergencyContactPhone: "+1 929 555 0000",
      }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(usersApi.updateUser).toHaveBeenCalled()
    expect(mockPrisma.pointsLedger.create).toHaveBeenCalled()
    expect(data.pointsBalance).toBe(10)
    expect(data.profileComplete).toBe(true)
  })

  it("returns 400 on invalid JSON", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })

    const { PUT } = await import("@/app/api/profile/route")
    const req = new Request("http://localhost/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{",
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 on invalid profile payload", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })

    const { PUT } = await import("@/app/api/profile/route")
    const req = new Request("http://localhost/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        birthDate: "2222-12-12",
      }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(400)
  })
})
