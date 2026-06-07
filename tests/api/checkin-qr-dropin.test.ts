import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockAuthorizeStaffTerminalSession = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockGetCatalogCourseBySlug = vi.fn()
const mockAwardPointsFromRule = vi.fn()
const mockGetAttendanceMilestoneClasses = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockParseQrCheckInContext = vi.fn()
const mockIsQrCheckInWindowAllowed = vi.fn()

const mockPrisma = {
  purchase: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
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
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUserByIdentifiers(...args),
}))

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("@/lib/checkin/qr", () => ({
  parseQrCheckInContext: (...args: unknown[]) => mockParseQrCheckInContext(...args),
  isQrCheckInWindowAllowed: (...args: unknown[]) => mockIsQrCheckInWindowAllowed(...args),
}))

vi.mock("@/lib/catalog-courses", () => ({
  getCatalogCourseBySlug: (...args: unknown[]) => mockGetCatalogCourseBySlug(...args),
}))

vi.mock("@/lib/points/service", () => ({
  awardPointsFromRule: (...args: unknown[]) => mockAwardPointsFromRule(...args),
  getAttendanceMilestoneClasses: (...args: unknown[]) => mockGetAttendanceMilestoneClasses(...args),
}))

describe("qr check-in drop-in route", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z"))

    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockAuthorizeStaffTerminalSession.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockGetCatalogCourseBySlug.mockReset()
    mockAwardPointsFromRule.mockReset()
    mockGetAttendanceMilestoneClasses.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()
    mockParseQrCheckInContext.mockReset()
    mockIsQrCheckInWindowAllowed.mockReset()
    mockPrisma.purchase.findMany.mockReset()
    mockPrisma.purchase.findUnique.mockReset()
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.attendance.findUnique.mockReset()
    mockPrisma.attendance.update.mockReset()
    mockPrisma.attendance.create.mockReset()
    mockPrisma.attendance.count.mockReset()
    mockPrisma.$transaction.mockReset()

    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockParseQrCheckInContext.mockReturnValue({
      courseSlug: "salsa-femenina-matutina",
      date: "2026-03-24",
      time: "11:00",
      durationMinutes: 60,
      startsAt: new Date("2026-03-24T15:00:00.000Z"),
      opensAt: new Date("2026-03-24T13:00:00.000Z"),
      closesAt: new Date("2026-03-24T18:00:00.000Z"),
    })
    mockIsQrCheckInWindowAllowed.mockReturnValue(true)
    mockGetCatalogCourseBySlug.mockResolvedValue({ title: "Salsa femenina matutina" })
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          firstName: "Mora",
          lastName: "Diaz",
          primaryEmailAddress: { emailAddress: "mora@example.com" },
          primaryPhoneNumber: { phoneNumber: "+1 929 387 6584" },
        }),
      },
    })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
    mockPrisma.purchase.findMany.mockResolvedValue([])
    mockPrisma.purchase.findUnique.mockResolvedValue(null)
    mockPrisma.classSession.upsert.mockResolvedValue({ id: "session_1" })
    mockPrisma.attendance.findUnique.mockResolvedValue(null)
    mockPrisma.attendance.create.mockResolvedValue({
      id: "attendance_1",
      status: "checked_in_no_package",
      checkedInAt: new Date("2026-03-24T16:00:00.000Z"),
    })
    mockPrisma.attendance.update.mockResolvedValue({
      id: "attendance_1",
      status: "checked_in_no_package",
      checkedInAt: new Date("2026-03-24T16:00:00.000Z"),
    })
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockGetAttendanceMilestoneClasses.mockResolvedValue(5)
    mockAwardPointsFromRule.mockResolvedValue({ awarded: false, points: 0 })
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const { POST } = await import("@/app/api/checkin/qr/dropin/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", date: "2026-03-24", time: "11:00" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid payload", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockParseQrCheckInContext.mockReturnValue({ status: 400, error: "Invalid context" })

    const { POST } = await import("@/app/api/checkin/qr/dropin/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "", date: "2026-03-24", time: "11:00" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("keeps the authenticated customer flow intact for non-kiosk payments", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_user_1" })
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_card_1",
        userId: "db_user_1",
        status: "succeeded",
        courseSlug: "salsa-femenina-matutina",
        stripePaymentIntentId: "pi_123",
        metadata: {
          date: "2026-03-24",
          time: "11:00",
          packageId: "",
        },
      },
    ])

    const { POST } = await import("@/app/api/checkin/qr/dropin/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentIntentId: "pi_123",
        courseSlug: "salsa-femenina-matutina",
        date: "2026-03-24",
        time: "11:00",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      attendance: {
        id: "attendance_1",
        status: "checked_in_no_package",
        courseSlug: "salsa-femenina-matutina",
      },
      payment: {
        purchaseId: "purchase_card_1",
        paymentIntentId: "pi_123",
        paymentMode: "card",
      },
    })
    expect(mockAuthorizeStaffTerminalSession).not.toHaveBeenCalled()
  })

  it("allows kiosk-safe durable card continuation with terminal session and matching purchase", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: "terminal_session_1",
      terminal: {
        id: "terminal_1",
        slug: "front-desk",
        name: "Front desk",
        location: "Lobby",
        defaultCourseSlug: null,
        active: true,
      },
    })
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: "purchase_kiosk_1",
      userId: "db_user_77",
      status: "paid",
      courseSlug: "salsa-femenina-matutina",
      stripePaymentIntentId: "pi_kiosk_1",
      metadata: {
        date: "2026-03-24",
        time: "11:00",
        packageId: "",
        flowContext: "kiosk_terminal",
        paymentSurface: "hosted_checkout",
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/dropin/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseId: "purchase_kiosk_1",
        courseSlug: "salsa-femenina-matutina",
        date: "2026-03-24",
        time: "11:00",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      payment: {
        purchaseId: "purchase_kiosk_1",
        paymentIntentId: "pi_kiosk_1",
        paymentStatus: "paid",
        paymentMode: "card",
      },
    })
    expect(mockPrisma.purchase.findMany).not.toHaveBeenCalled()
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
  })

  it("rejects kiosk-safe continuation when the durable purchase does not match the requested slot", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: "terminal_session_1",
      terminal: {
        id: "terminal_1",
        slug: "front-desk",
        name: "Front desk",
        location: "Lobby",
        defaultCourseSlug: null,
        active: true,
      },
    })
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: "purchase_kiosk_2",
      userId: "db_user_77",
      status: "paid",
      courseSlug: "salsa-femenina-matutina",
      stripePaymentIntentId: "pi_kiosk_2",
      metadata: {
        date: "2026-03-24",
        time: "12:00",
        packageId: "",
        flowContext: "kiosk_terminal",
        paymentSurface: "hosted_checkout",
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/dropin/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseId: "purchase_kiosk_2",
        courseSlug: "salsa-femenina-matutina",
        date: "2026-03-24",
        time: "11:00",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error: "No successful kiosk card payment was found for this class slot.",
    })
  })
})
