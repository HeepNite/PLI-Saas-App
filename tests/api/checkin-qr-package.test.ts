import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockResolveTerminalKioskSession = vi.fn()
const mockGetCatalogCourseBySlug = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockParseQrCheckInContext = vi.fn()
const mockIsTerminalCheckInAllowed = vi.fn()
const mockIsConsecutiveAddOnPurchaseAllowed = vi.fn()
const mockReservePackageCreditForAttendanceTx = vi.fn()
const mockAwardPointsFromRule = vi.fn()
const mockGetAttendanceMilestoneClasses = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()

const mockPrisma = {
  packagePurchase: {
    findMany: vi.fn(),
  },
  classSession: {
    upsert: vi.fn(),
  },
  attendance: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  purchase: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/checkin/kiosk-session", () => ({
  resolveTerminalKioskSession: (...args: unknown[]) => mockResolveTerminalKioskSession(...args),
}))

vi.mock("@/lib/catalog-courses", () => ({
  getCatalogCourseBySlug: (...args: unknown[]) => mockGetCatalogCourseBySlug(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("@/lib/checkin/qr", () => ({
  parseQrCheckInContext: (...args: unknown[]) => mockParseQrCheckInContext(...args),
  isTerminalCheckInAllowed: (...args: unknown[]) => mockIsTerminalCheckInAllowed(...args),
  isConsecutiveAddOnPurchaseAllowed: (...args: unknown[]) => mockIsConsecutiveAddOnPurchaseAllowed(...args),
}))

vi.mock("@/lib/packages", () => ({
  reservePackageCreditForAttendanceTx: (...args: unknown[]) => mockReservePackageCreditForAttendanceTx(...args),
}))

vi.mock("@/lib/points/service", () => ({
  awardPointsFromRule: (...args: unknown[]) => mockAwardPointsFromRule(...args),
  getAttendanceMilestoneClasses: (...args: unknown[]) => mockGetAttendanceMilestoneClasses(...args),
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUserByIdentifiers(...args),
}))

describe("qr check-in package route", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-31T15:00:00.000Z"))

    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockResolveTerminalKioskSession.mockReset()
    mockGetCatalogCourseBySlug.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()
    mockParseQrCheckInContext.mockReset()
    mockIsTerminalCheckInAllowed.mockReset()
    mockIsConsecutiveAddOnPurchaseAllowed.mockReset()
    mockReservePackageCreditForAttendanceTx.mockReset()
    mockAwardPointsFromRule.mockReset()
    mockGetAttendanceMilestoneClasses.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockPrisma.packagePurchase.findMany.mockReset()
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.attendance.findUnique.mockReset()
    mockPrisma.attendance.update.mockReset()
    mockPrisma.attendance.create.mockReset()
    mockPrisma.attendance.count.mockReset()
    mockPrisma.purchase.findFirst.mockReset()
    mockPrisma.purchase.create.mockReset()
    mockPrisma.$executeRaw.mockReset()
    mockPrisma.$transaction.mockReset()

    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockParseQrCheckInContext.mockReturnValue({
      courseSlug: "salsa-femenina-matutina",
      date: "2026-03-31",
      time: "11:00",
      durationMinutes: 60,
      startsAt: new Date("2026-03-31T15:00:00.000Z"),
      endsAt: new Date("2026-03-31T16:00:00.000Z"),
      opensAt: new Date("2026-03-31T13:00:00.000Z"),
      closesAt: new Date("2026-03-31T18:00:00.000Z"),
    })
    mockIsTerminalCheckInAllowed.mockReturnValue(true)
    mockIsConsecutiveAddOnPurchaseAllowed.mockReturnValue(true)
    mockGetCatalogCourseBySlug.mockResolvedValue({ title: "Salsa femenina matutina" })
    mockPrisma.packagePurchase.findMany.mockResolvedValue([
      {
        id: "pkg_purchase_1",
        packageId: "pkg_10",
        packageLabel: "10 Classes",
        courseSlug: "salsa-femenina-matutina",
        isUnlimited: false,
        remainingCredits: 4,
        expiresAt: new Date("2026-04-30T00:00:00.000Z"),
        status: "active",
      },
    ])
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1" })
    mockPrisma.attendance.findUnique.mockResolvedValue(null)
    mockPrisma.attendance.create.mockResolvedValue({
      id: "attendance_1",
      status: "checked_in",
      checkedInAt: new Date("2026-03-31T15:00:00.000Z"),
    })
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockPrisma.purchase.findFirst.mockResolvedValue(null)
    mockReservePackageCreditForAttendanceTx.mockResolvedValue({
      packagePurchase: {
        id: "pkg_purchase_1",
        packageId: "pkg_10",
        packageLabel: "10 Classes",
        isUnlimited: false,
        remainingCredits: 3,
        status: "active",
        expiresAt: new Date("2026-04-30T00:00:00.000Z"),
      },
    })
    mockGetAttendanceMilestoneClasses.mockResolvedValue(5)
    mockAwardPointsFromRule.mockResolvedValue({ awarded: false, points: 0 })
    mockPrisma.purchase.create.mockResolvedValue({ id: "purchase_1" })
    mockPrisma.$executeRaw.mockResolvedValue(1)
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    })

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", date: "2026-02-24", time: "11:00" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 409 when regular (non-add-on) check-in is truly past closesAt", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockIsTerminalCheckInAllowed.mockReturnValue(false)

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", date: "2026-03-31", time: "11:00" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toBe("Check-in is closed for this class.")
    expect(data.opensAt).toBe("2026-03-31T13:00:00.000Z")
    expect(data.closesAt).toBe("2026-03-31T18:00:00.000Z")
    expect(data.endsAt).toBeUndefined()
    expect(mockIsConsecutiveAddOnPurchaseAllowed).not.toHaveBeenCalled()
  })

  it("succeeds for regular (non-add-on) check-in far before startsAt (pre-window, previously blocked by opensAt)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockResolveTerminalKioskSession.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "customer_clerk_1",
          firstName: "Jane",
          lastName: "Student",
          primaryEmailAddress: { emailAddress: "student@example.com" },
          primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
        }),
      },
    })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    // Terminal check-in has no lower bound — allowed even far before startsAt.
    mockIsTerminalCheckInAllowed.mockReturnValue(true)

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", date: "2026-03-31", time: "11:00" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockIsTerminalCheckInAllowed).toHaveBeenCalled()
  })

  it("returns 400 for invalid payload", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockParseQrCheckInContext.mockReturnValue({ status: 400, error: "Invalid context" })

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "", date: "2026-02-24", time: "11:00" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("ignores owner or staff Clerk auth in kiosk flow and applies the kiosk customer package", async () => {
    const getUser = vi.fn().mockImplementation(async (userId: string) => {
      if (userId === "staff_user_1") {
        return {
          id: "staff_user_1",
          firstName: "Owner",
          lastName: "Account",
          publicMetadata: { role: "owner" },
          privateMetadata: {},
          unsafeMetadata: {},
          primaryEmailAddress: { emailAddress: "owner@example.com" },
          primaryPhoneNumber: { phoneNumber: "+1 555 999 0000" },
        }
      }

      return {
        id: "customer_clerk_1",
        firstName: "Jane",
        lastName: "Student",
        primaryEmailAddress: { emailAddress: "student@example.com" },
        primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
      }
    })

    mockClerkClient.mockResolvedValue({
      users: {
        getUser,
      },
    })
    mockAuth.mockResolvedValue({ userId: "staff_user_1" })
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "db_user_kiosk_1",
          clerkId: "customer_clerk_1",
          email: "student@example.com",
          name: "Jane Student",
          phone: "+1 555 111 2222",
        },
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-03-31",
        time: "11:00",
        flowContext: "kiosk_terminal",
        kioskSessionToken: "session_1",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      attendance: {
        id: "attendance_1",
        status: "checked_in",
      },
      package: {
        id: "pkg_purchase_1",
        remainingCredits: 3,
      },
    })
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockPrisma.packagePurchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "db_user_kiosk_1" }),
      })
    )
    expect(getUser).toHaveBeenNthCalledWith(1, "staff_user_1")
  })

  it("applies the kiosk customer package instead of an active customer Clerk session", async () => {
    const getUser = vi.fn().mockResolvedValue({
      id: "melanie_clerk_1",
      firstName: "Melanie",
      lastName: "Padilla",
      primaryEmailAddress: { emailAddress: "melanie@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 000 9999" },
    })

    mockClerkClient.mockResolvedValue({ users: { getUser } })
    mockAuth.mockResolvedValue({ userId: "melanie_clerk_1" })
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "jhon_db_1",
          clerkId: "jhon_clerk_1",
          email: "jhon@doe.com",
          name: "Jhon Doe",
          phone: "+1 555 666 6666",
        },
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-03-31",
        time: "11:00",
        flowContext: "kiosk_terminal",
        kioskSessionToken: "jhon_kiosk_session",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockResolveTerminalKioskSession).toHaveBeenCalledWith("jhon_kiosk_session")
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockPrisma.packagePurchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "jhon_db_1" }),
      })
    )
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(getUser).toHaveBeenCalledWith("melanie_clerk_1")
  })

  it("does not create a duplicate package purchase when the attendance already has one", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockPrisma.purchase.findFirst.mockResolvedValue({ id: "purchase_existing" })

    const getUser = vi.fn().mockResolvedValue({
      id: "user_123",
      firstName: "Jane",
      lastName: "Student",
      primaryEmailAddress: { emailAddress: "student@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
    })
    mockClerkClient.mockResolvedValue({ users: { getUser } })

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", date: "2026-03-31", time: "11:00" }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("creates package-credit purchases with participants set to one", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })

    const getUser = vi.fn().mockResolvedValue({
      id: "user_123",
      firstName: "Jane",
      lastName: "Student",
      primaryEmailAddress: { emailAddress: "student@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
    })
    mockClerkClient.mockResolvedValue({ users: { getUser } })

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", date: "2026-03-31", time: "11:00" }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockPrisma.purchase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participants: 1,
        }),
      })
    )
  })
})
