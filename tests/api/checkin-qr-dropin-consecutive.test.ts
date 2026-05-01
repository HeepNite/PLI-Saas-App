import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
const mockCourseLinkFindUnique = vi.fn()
const mockAttendanceFindFirst = vi.fn()

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
  courseLink: {
    findUnique: (...args: unknown[]) => mockCourseLinkFindUnique(...args),
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

vi.mock("@/lib/course-links", () => ({
  findConsecutiveLink: (...args: unknown[]) => mockCourseLinkFindUnique(...args),
}))

vi.mock("@/lib/checkin/consecutive-class", () => ({
  hasAttendedCourseToday: (...args: unknown[]) => mockAttendanceFindFirst(...args),
}))

describe("drop-in consecutive purchase", () => {
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
    mockCourseLinkFindUnique.mockReset()
    mockAttendanceFindFirst.mockReset()
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
      courseSlug: "bachata",
      date: "2026-03-24",
      time: "20:00",
      durationMinutes: 60,
      startsAt: new Date("2026-03-25T00:00:00.000Z"),
      opensAt: new Date("2026-03-24T22:00:00.000Z"),
      closesAt: new Date("2026-03-25T03:00:00.000Z"),
    })
    mockIsQrCheckInWindowAllowed.mockReturnValue(true)
    mockGetCatalogCourseBySlug.mockResolvedValue({ title: "Bachata Basics" })
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          firstName: "Jane",
          lastName: "Student",
          primaryEmailAddress: { emailAddress: "student@example.com" },
          primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
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
    mockPrisma.attendance.count.mockResolvedValue(1)
    mockGetAttendanceMilestoneClasses.mockResolvedValue(5)
    mockAwardPointsFromRule.mockResolvedValue({ awarded: false, points: 0 })
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("validates price matches CourseLink", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      dropInConsecutiveCents: 900,
      active: true,
    })
    mockAttendanceFindFirst.mockResolvedValue({ id: "att_1" })
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_1",
        status: "paid",
        courseSlug: "bachata",
        metadata: { date: "2026-03-24", time: "20:00", packageId: "" },
      },
    ])

    const { POST } = await import("@/app/api/checkin/qr/dropin/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-24",
          time: "20:00",
          consecutiveDiscountApplied: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 999, // wrong price
        }),
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Price mismatch")
  })

  it("rejects when Class A attendance not found", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      dropInConsecutiveCents: 900,
      active: true,
    })
    mockAttendanceFindFirst.mockResolvedValue(null) // no attendance

    const { POST } = await import("@/app/api/checkin/qr/dropin/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-24",
          time: "20:00",
          consecutiveDiscountApplied: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 900,
        }),
      })
    )

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain("must attend the first class")
  })

  it("creates attendance + purchase on success", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      dropInConsecutiveCents: 900,
      active: true,
    })
    mockAttendanceFindFirst.mockResolvedValue({ id: "att_1" }) // attended Class A
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_1",
        status: "paid",
        courseSlug: "bachata",
        metadata: { date: "2026-03-24", time: "20:00", packageId: "" },
      },
    ])

    const { POST } = await import("@/app/api/checkin/qr/dropin/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-24",
          time: "20:00",
          consecutiveDiscountApplied: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 900,
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.attendance).toBeDefined()
    expect(data.attendance.status).toBe("checked_in_no_package")
    expect(data.attendance.courseSlug).toBe("bachata")
  })

  it("rejects when no active consecutive link exists", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockCourseLinkFindUnique.mockResolvedValue(null) // no link

    const { POST } = await import("@/app/api/checkin/qr/dropin/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-24",
          time: "20:00",
          consecutiveDiscountApplied: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 900,
        }),
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("No active consecutive link")
  })

  it("rejects when linkedFromCourseSlug is missing with consecutiveDiscountApplied", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })

    const { POST } = await import("@/app/api/checkin/qr/dropin/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-24",
          time: "20:00",
          consecutiveDiscountApplied: true,
          // missing linkedFromCourseSlug
        }),
      })
    )

    expect(res.status).toBe(400)
  })
})
