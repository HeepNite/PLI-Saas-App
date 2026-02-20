import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUser = vi.fn()

const mockPrisma = {
  attendance: {
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

describe("profile activity route", () => {
  const usersApi = {
    getUser: vi.fn(),
  }

  beforeEach(() => {
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockUpsertUser.mockReset()
    usersApi.getUser.mockReset()
    mockPrisma.attendance.findMany.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { GET } = await import("@/app/api/profile/activity/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(401)
  })

  it("returns stats and monthly attendance", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "att_1",
        status: "checked_in",
        checkedInAt: new Date("2026-02-14T16:00:00.000Z"),
        session: {
          courseSlug: "salsa-femenina-matutina",
          title: "Salsa",
        },
      },
      {
        id: "att_2",
        status: "checked_in",
        checkedInAt: new Date("2026-02-07T16:00:00.000Z"),
        session: {
          courseSlug: "salsa-femenina-matutina",
          title: "Salsa",
        },
      },
    ])

    const { GET } = await import("@/app/api/profile/activity/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.stats.classesTaken).toBe(2)
    expect(Array.isArray(data.monthlyAttendance)).toBe(true)
  })
})
