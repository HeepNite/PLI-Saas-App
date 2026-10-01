import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getUser: vi.fn(),
  upsertUser: vi.fn(),
  reserve: vi.fn(),
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  clerkClient: vi.fn(async () => ({ users: { getUser: mocks.getUser } })),
}))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/users", () => ({ upsertUserByIdentifiers: mocks.upsertUser }))
vi.mock("@/lib/bookings/public-package-booking", () => ({ reservePublicPackageBooking: mocks.reserve }))

describe("public package reservation route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: "clerk_1" })
    mocks.getUser.mockResolvedValue({
      firstName: "Demo",
      lastName: "Student",
      primaryEmailAddress: { emailAddress: "demo@example.com" },
      primaryPhoneNumber: { phoneNumber: "+15555550103" },
    })
    mocks.upsertUser.mockResolvedValue({ id: "db_user_1" })
  })

  const request = (body: unknown) => new Request("http://localhost/api/profile/bookings/reserve-package", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null })
    const { POST } = await import("@/app/api/profile/bookings/reserve-package/route")

    const response = await POST(request({ courseSlug: "salsa-night-beginner", date: "2026-10-05", time: "21:10" }))

    expect(response.status).toBe(401)
    expect(mocks.reserve).not.toHaveBeenCalled()
  })

  it("returns a package reservation without accepting a client package id", async () => {
    mocks.reserve.mockResolvedValue({
      kind: "reserved",
      attendanceId: "attendance_1",
      packagePurchaseId: "package_1",
      remainingCredits: 4,
      replayed: false,
    })
    const { POST } = await import("@/app/api/profile/bookings/reserve-package/route")

    const response = await POST(request({
      courseSlug: "salsa-night-beginner",
      date: "2026-10-05",
      time: "21:10",
      packagePurchaseId: "forged_package",
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ ok: true, packagePurchaseId: "package_1" })
    expect(mocks.reserve).toHaveBeenCalledWith(expect.anything(), {
      userId: "db_user_1",
      courseSlug: "salsa-night-beginner",
      date: "2026-10-05",
      time: "21:10",
    })
  })

  it("allows regular checkout fallback when no applicable package exists", async () => {
    mocks.reserve.mockResolvedValue({ kind: "no_package" })
    const { POST } = await import("@/app/api/profile/bookings/reserve-package/route")

    const response = await POST(request({ courseSlug: "salsa-night-beginner", date: "2026-10-05", time: "21:10" }))

    expect(await response.json()).toEqual({ ok: false, reason: "no_package" })
  })
})
