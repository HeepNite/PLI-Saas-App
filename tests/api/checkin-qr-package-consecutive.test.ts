import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockResolveTerminalKioskSession = vi.fn()
const mockGetCatalogCourseBySlug = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockParseQrCheckInContext = vi.fn()
const mockIsQrCheckInWindowAllowed = vi.fn()
const mockReservePackageCreditForAttendanceTx = vi.fn()
const mockAwardPointsFromRule = vi.fn()
const mockGetAttendanceMilestoneClasses = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockCourseLinkFindUnique = vi.fn()
const mockAttendanceFindFirst = vi.fn()

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
  courseLink: {
    findUnique: (...args: unknown[]) => mockCourseLinkFindUnique(...args),
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
  isQrCheckInWindowAllowed: (...args: unknown[]) => mockIsQrCheckInWindowAllowed(...args),
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

vi.mock("@/lib/security/kiosk-customer-auth", () => ({
  resolveKioskCustomerClerkAuth: vi.fn().mockResolvedValue({
    userId: "user_123",
    clerkUser: null,
    blocked: false,
    blockedRole: null,
  }),
}))

vi.mock("@/lib/course-links", () => ({
  findConsecutiveLink: (...args: unknown[]) => mockCourseLinkFindUnique(...args),
}))

vi.mock("@/lib/checkin/consecutive-class", () => ({
  hasAttendedCourseToday: (...args: unknown[]) => mockAttendanceFindFirst(...args),
}))

describe("package consecutive add-on", () => {
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
    mockIsQrCheckInWindowAllowed.mockReset()
    mockReservePackageCreditForAttendanceTx.mockReset()
    mockAwardPointsFromRule.mockReset()
    mockGetAttendanceMilestoneClasses.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockCourseLinkFindUnique.mockReset()
    mockAttendanceFindFirst.mockReset()
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
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "user_123",
          firstName: "Jane",
          lastName: "Student",
          primaryEmailAddress: { emailAddress: "student@example.com" },
          primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
        }),
      },
    })
    mockParseQrCheckInContext.mockReturnValue({
      courseSlug: "bachata",
      date: "2026-03-31",
      time: "20:00",
      durationMinutes: 60,
      startsAt: new Date("2026-04-01T00:00:00.000Z"),
      opensAt: new Date("2026-03-31T22:00:00.000Z"),
      closesAt: new Date("2026-04-01T03:00:00.000Z"),
    })
    mockIsQrCheckInWindowAllowed.mockReturnValue(true)
    mockGetCatalogCourseBySlug.mockResolvedValue({ title: "Bachata Basics" })
    mockPrisma.packagePurchase.findMany.mockResolvedValue([
      {
        id: "pkg_purchase_1",
        packageId: "pkg_10",
        packageLabel: "10 Classes",
        courseSlug: "salsa",
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
      status: "checked_in_no_package",
      checkedInAt: new Date("2026-03-31T15:00:00.000Z"),
    })
    mockPrisma.purchase.findFirst.mockResolvedValue(null)
    mockPrisma.purchase.create.mockResolvedValue({ id: "purchase_1" })
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
  })

  it("creates separate charge (NOT package credit deduction)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      packageHolderConsecutiveCents: 500,
      active: true,
    })
    mockAttendanceFindFirst.mockResolvedValue({ id: "att_1" }) // attended Class A

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-31",
          time: "20:00",
          consecutiveAddOn: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.consecutive).toBeDefined()
    expect(data.consecutive.isConsecutiveAddOn).toBe(true)
    expect(data.consecutive.priceCents).toBe(500)
    // Package should be null — no credit deduction
    expect(data.package).toBeNull()
    // Should NOT call reservePackageCreditForAttendanceTx
    expect(mockReservePackageCreditForAttendanceTx).not.toHaveBeenCalled()
  })

  it("validates CourseLink price", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      packageHolderConsecutiveCents: 500,
      active: true,
    })
    mockAttendanceFindFirst.mockResolvedValue({ id: "att_1" })

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-31",
          time: "20:00",
          consecutiveAddOn: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 999, // wrong price
        }),
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Price mismatch")
  })

  it("rejects when no Class A attendance", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      packageHolderConsecutiveCents: 500,
      active: true,
    })
    mockAttendanceFindFirst.mockResolvedValue(null) // no attendance

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-31",
          time: "20:00",
          consecutiveAddOn: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain("must attend the first class")
  })

  it("rejects when linkedFromCourseSlug is missing", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-31",
          time: "20:00",
          consecutiveAddOn: true,
          // missing linkedFromCourseSlug
        }),
      })
    )

    expect(res.status).toBe(400)
  })

  it("rejects when no active consecutive link exists", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockCourseLinkFindUnique.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-31",
          time: "20:00",
          consecutiveAddOn: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("No active consecutive link")
  })

  it("rejects when student has no active package", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      packageHolderConsecutiveCents: 500,
      active: true,
    })
    mockAttendanceFindFirst.mockResolvedValue({ id: "att_1" })
    mockPrisma.packagePurchase.findMany.mockResolvedValue([]) // no packages

    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-31",
          time: "20:00",
          consecutiveAddOn: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain("No active package")
  })
})
