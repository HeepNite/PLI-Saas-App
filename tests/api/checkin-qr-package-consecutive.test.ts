import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockResolveTerminalKioskSession = vi.fn()
const mockGetCatalogCourseBySlug = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockParseQrCheckInContext = vi.fn()
const mockIsQrCheckInWindowAllowed = vi.fn()
const mockIsConsecutiveAddOnPurchaseAllowed = vi.fn()
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
    findFirst: vi.fn(),
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
  findConsecutiveLinkBetween: (...args: unknown[]) => mockCourseLinkFindUnique(...args),
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
    mockIsConsecutiveAddOnPurchaseAllowed.mockReset()
    mockReservePackageCreditForAttendanceTx.mockReset()
    mockAwardPointsFromRule.mockReset()
    mockGetAttendanceMilestoneClasses.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockCourseLinkFindUnique.mockReset()
    mockAttendanceFindFirst.mockReset()
    mockPrisma.packagePurchase.findMany.mockReset()
    mockPrisma.classSession.upsert.mockReset()
    mockPrisma.attendance.findUnique.mockReset()
    mockPrisma.attendance.findFirst.mockReset()
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
      endsAt: new Date("2026-04-01T01:00:00.000Z"),
      opensAt: new Date("2026-03-31T22:00:00.000Z"),
      closesAt: new Date("2026-04-01T03:00:00.000Z"),
    })
    mockIsQrCheckInWindowAllowed.mockReturnValue(true)
    mockIsConsecutiveAddOnPurchaseAllowed.mockReturnValue(true)
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

  it("creates separate charge for cash flow (NOT package credit deduction)", async () => {
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
          consecutiveCashPayment: true,
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
    expect(mockPrisma.purchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 500,
        status: "pending",
        metadata: expect.objectContaining({
          paymentChannel: "cash",
          settlementStatus: "pending",
          consecutivePriceCents: 500,
        }),
      }),
    })
  })

  it("records configured price for cash flow when client omits consecutivePriceCents", async () => {
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
          consecutiveCashPayment: true,
          linkedFromCourseSlug: "salsa",
          // consecutivePriceCents intentionally omitted: server must use CourseLink price.
        }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.purchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 500,
        status: "pending",
        metadata: expect.objectContaining({
          paymentChannel: "cash",
          settlementStatus: "pending",
          consecutivePriceCents: 500,
        }),
      }),
    })
  })

  it("allows cash add-on after class A consumed the package's last credit", async () => {
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
    mockPrisma.packagePurchase.findMany.mockResolvedValue([
      {
        id: "pkg_purchase_1",
        packageId: "pkg_10",
        packageLabel: "10 Classes",
        courseSlug: "salsa",
        isUnlimited: false,
        remainingCredits: 0,
        expiresAt: new Date("2026-04-30T00:00:00.000Z"),
        status: "active",
      },
    ])

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
          consecutiveCashPayment: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockReservePackageCreditForAttendanceTx).not.toHaveBeenCalled()
  })

  it("rejects monetary consecutive add-on without cash/card evidence (guard against silent auto-paid)", async () => {
    // Regression: Jhon Doe purchase cmpbkyowj001ow3gpqxwdpexa was created
    // as `paid` with paymentChannel:consecutive_addon and no Stripe IDs
    // because the route accepted consecutiveAddOn:true with a positive
    // price and no consecutiveCashPayment. The card flow goes through
    // /api/checkout/session, never this endpoint — so a monetary add-on
    // here without cash evidence must be rejected.
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      packageHolderConsecutiveCents: 1000,
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
          // consecutiveCashPayment intentionally OMITTED
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 1000,
        }),
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("requires payment selection")
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("allows zero-price consecutive add-on without cash flag (free add-on)", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      packageHolderConsecutiveCents: 0,
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
          consecutivePriceCents: 0,
        }),
      })
    )

    expect(res.status).toBe(200)
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
          consecutiveCashPayment: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain("must attend the first class")
  })

  it("rejects stale linked attendance ids that do not match the class date", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockCourseLinkFindUnique.mockResolvedValue({
      id: "link_1",
      courseSlugA: "salsa",
      courseSlugB: "bachata",
      packageHolderConsecutiveCents: 500,
      active: true,
    })
    mockPrisma.attendance.findFirst.mockResolvedValue(null)
    mockAttendanceFindFirst.mockResolvedValue(null)

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
          consecutiveCashPayment: true,
          linkedFromCourseSlug: "salsa",
          linkedFromAttendanceId: "attendance_old_day",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(403)
    expect(mockPrisma.attendance.findFirst).toHaveBeenCalledWith({
      where: {
        id: "attendance_old_day",
        userId: "db_user_1",
        status: { in: ["checked_in", "checked_in_no_package"] },
        session: { courseSlug: "salsa", startsAt: new Date("2026-04-01T00:00:00.000Z") },
      },
      select: { id: true },
    })
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
          consecutiveCashPayment: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain("No active package")
  })

  it("succeeds when now is well before opensAt (previously would 409 under the full window)", async () => {
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
    // now (2026-03-31T15:00:00Z, set in beforeEach) is well before opensAt
    // (2026-03-31T22:00:00Z) — the regular window would reject this.
    mockIsConsecutiveAddOnPurchaseAllowed.mockReturnValue(true)
    mockIsQrCheckInWindowAllowed.mockReturnValue(false)

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
          consecutiveCashPayment: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.consecutive.isConsecutiveAddOn).toBe(true)
    expect(mockIsConsecutiveAddOnPurchaseAllowed).toHaveBeenCalled()
  })

  it("rejects with 409 when now > context.endsAt (class already ended) — no attendance/purchase created", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    mockUpsertUserByIdentifiers.mockResolvedValue({ id: "db_user_1" })
    mockIsConsecutiveAddOnPurchaseAllowed.mockReturnValue(false)

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
          consecutiveCashPayment: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain("already ended")
    expect(mockCourseLinkFindUnique).not.toHaveBeenCalled()
    expect(mockPrisma.attendance.create).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("allows purchase at the exact boundary now === context.endsAt", async () => {
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
    mockIsConsecutiveAddOnPurchaseAllowed.mockReturnValue(true)

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
          consecutiveCashPayment: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 500,
        }),
      })
    )

    expect(res.status).toBe(200)
  })

  it("still enforces price mismatch guard even when now is far outside the regular window", async () => {
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
    mockIsConsecutiveAddOnPurchaseAllowed.mockReturnValue(true)
    mockIsQrCheckInWindowAllowed.mockReturnValue(false)

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
          consecutiveCashPayment: true,
          linkedFromCourseSlug: "salsa",
          consecutivePriceCents: 999, // wrong price
        }),
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Price mismatch")
  })
})
