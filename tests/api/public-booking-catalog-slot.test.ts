import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getUser: vi.fn(),
  upsertUser: vi.fn(),
  getCatalogFrontData: vi.fn(),
  findSession: vi.fn(),
  findAttendance: vi.fn(),
  findPackages: vi.fn(),
  createAttendance: vi.fn(),
  upsertSession: vi.fn(),
  createLedger: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  clerkClient: vi.fn(async () => ({ users: { getUser: mocks.getUser } })),
}))
vi.mock("@/lib/users", () => ({ upsertUserByIdentifiers: mocks.upsertUser }))
vi.mock("@/lib/catalog-courses", () => ({ getCatalogFrontData: mocks.getCatalogFrontData }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}))

const course = {
  slug: "salsa-night-beginner",
  title: "Salsa Night Beginner",
  duration: "55 min",
  schedule: {
    day: "Mon",
    time: "21:10",
    availableWeekdays: [0],
    availableTimes: ["21:10"],
  },
  scheduleRules: { rules: [{ weekday: 1, times: ["21:10"] }] },
}
const link = new URL("https://pli.palladiumlatin.art/courses/salsa-night-beginner?enroll=1&qrBooking=1&date=2026-11-02&time=21%3A10&durationMinutes=55&bookingSource=public_booking")
const request = (time = link.searchParams.get("time")!) => new Request("http://localhost/api/profile/bookings/reserve-package", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ courseSlug: link.pathname.split("/").pop(), date: link.searchParams.get("date"), time }),
})

const assertNoWrites = () => {
  expect(mocks.createAttendance).not.toHaveBeenCalled()
  expect(mocks.upsertSession).not.toHaveBeenCalled()
  expect(mocks.createLedger).not.toHaveBeenCalled()
}

describe("public booking catalog slot through reserve-package POST", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-02T18:00:00.000Z"))
    mocks.auth.mockResolvedValue({ userId: "clerk_1" })
    mocks.getUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: "demo@example.com" } })
    mocks.upsertUser.mockResolvedValue({ id: "db_user_1" })
    mocks.getCatalogFrontData.mockResolvedValue({ courses: [course] })
    mocks.findSession.mockResolvedValue(null)
    mocks.findAttendance.mockResolvedValue(null)
    mocks.findPackages.mockResolvedValue([])
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
      classSession: { findUnique: mocks.findSession, upsert: mocks.upsertSession },
      attendance: { findUnique: mocks.findAttendance, create: mocks.createAttendance },
      packagePurchase: { findMany: mocks.findPackages },
      packageUsageLedger: { create: mocks.createLedger },
    }))
  })

  afterEach(() => vi.useRealTimers())

  it("allows the linked Monday 21:10 class to fall back to regular checkout with no package", async () => {
    const { POST } = await import("@/app/api/profile/bookings/reserve-package/route")
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: false, reason: "no_package" })
    expect(mocks.findPackages).toHaveBeenCalledOnce()
    assertNoWrites()
  })

  it.each([
    ["missing", []],
    ["inactive (omitted from active catalog)", []],
  ])("rejects %s catalog course without touching reservations", async (_label, courses) => {
    mocks.getCatalogFrontData.mockResolvedValue({ courses })
    const { POST } = await import("@/app/api/profile/bookings/reserve-package/route")
    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "The selected class is not available." })
    expect(mocks.findPackages).not.toHaveBeenCalled()
    assertNoWrites()
  })

  it("rejects a time not on the catalog schedule without touching reservations", async () => {
    const { POST } = await import("@/app/api/profile/bookings/reserve-package/route")
    const response = await POST(request("20:10"))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "The selected class is not available." })
    expect(mocks.findPackages).not.toHaveBeenCalled()
    assertNoWrites()
  })
})
