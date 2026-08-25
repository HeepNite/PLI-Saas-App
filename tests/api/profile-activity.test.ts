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

  it("buckets a backdated staff-added attendance under the class day, not today", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })

    // Fixture: attendance added by staff for a past class session (checkedInAt
    // now correctly set to the session's startsAt, not the staff click time).
    // Use "1 month before today" so it always lands inside the route's
    // rolling 4-month bucket window, regardless of when the suite runs.
    const now = new Date()
    const backdatedCheckedInAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 16, 0, 0))
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "att_backdated",
        status: "checked_in",
        checkedInAt: backdatedCheckedInAt,
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

    // The recentAttendances entry must reflect the class's real day, not "now".
    expect(data.recentAttendances).toHaveLength(1)
    expect(data.recentAttendances[0].checkedInAt).toBe(backdatedCheckedInAt.toISOString())

    // The monthly bucket for the class's real UTC month must be incremented
    // by exactly one, and no other bucket should pick it up — proving the
    // backdated attendance is not grouped under "today"'s bucket.
    const bucketsWithValue = data.monthlyAttendance.filter(
      (bucket: { label: string; value: number }) => bucket.value > 0
    )
    expect(bucketsWithValue).toHaveLength(1)
    expect(bucketsWithValue[0].value).toBe(1)
  })
})
