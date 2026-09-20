import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalSection = vi.fn()
const mockGetTodayNewYork = vi.fn()
const mockBuildSessionStartsAt = vi.fn()

const mockPrisma = {
  purchase: {
    findMany: vi.fn(),
  },
  pointsLedger: {
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  packagePurchase: {
    findMany: vi.fn(),
  },
  packageUsageLedger: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  courseCatalog: {
    findMany: vi.fn(),
  },
  attendance: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  studentPinCredential: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalSectionRequest: (...args: unknown[]) => mockAuthorizePortalSection(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff-payments-test"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/class-schedule", () => ({
  buildSessionStartsAt: (...args: unknown[]) => mockBuildSessionStartsAt(...args),
  getDateKeyInTimeZone: (date: Date) => date.toISOString().slice(0, 10),
  getTodayNewYork: () => mockGetTodayNewYork(),
  getTimeKeyInTimeZone: (date: Date) => date.toISOString().split("T")[1].substring(0, 5),
  // Match the current EDT fixtures.
  getStartOfDayNY: (dateStr: string) => new Date(`${dateStr}T04:00:00.000Z`),
}))

vi.mock("@/lib/security/student-pin", () => ({
  isLockedCredential: vi.fn(() => false),
  isProvisionalStudentPinActive: vi.fn(() => false),
  isStudentPinLifecycleEnabled: vi.fn(() => true),
  isStudentPinSchemaUnavailableError: (error: unknown) => {
    const code =
      typeof error === "object" && error && "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null
    const name =
      typeof error === "object" && error && "name" in error && typeof (error as { name?: unknown }).name === "string"
        ? (error as { name: string }).name
        : null
    return name === "PrismaClientKnownRequestError" && ["P2021", "P2022"].includes(code ?? "")
  },
  loadStudentPinCredentials: async (userIds: string[]) => {
    if (!userIds.length) return { available: false, credentials: [] }
    const credentials = await mockPrisma.studentPinCredential.findMany()
    return { available: true, credentials }
  },
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    users: {
      getUserList: vi.fn(async () => ({ data: [] })),
    },
  })),
}))

describe("staff payments route - attendance only", () => {
  const buildPurchase = ({
    id,
    userId,
    metadata = {},
    createdAt = "2026-03-20T15:00:00.000Z",
  }: {
    id: string
    userId: string
    metadata?: Record<string, unknown>
    createdAt?: string
  }) => ({
    id,
    userId,
    courseSlug: "salsa-beginners",
    courseTitle: "Salsa Beginners",
    name: `Student ${id}`,
    email: `${id}@example.com`,
    phone: "+1 555 0100",
    packageId: null,
    serviceId: null,
    amount: 2500,
    currency: "usd",
    status: "paid",
    metadata,
    stripePaymentIntentId: `pi_${id}`,
    stripeCheckoutSessionId: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  })

  const buildStandaloneAttendance = ({
    id, userId, courseSlug, startsAt, checkedInAt, metadata = {},
  }: {
    id: string; userId: string; courseSlug: string; startsAt: Date; checkedInAt: Date; metadata?: Record<string, unknown>
  }) => ({
    id, userId, status: "checked_in", checkedInAt, checkedOutAt: null,
    session: { courseSlug, startsAt, title: courseSlug },
    user: { id: userId, name: userId, email: `${userId}@example.com`, phone: "+1 555 0000", clerkId: `clerk_${userId}` },
    metadata, packageUsage: null,
  })

  // Simulates the fix's batched, all-time purchase lookup (an "OR"-shaped where);
  // every other purchase.findMany call in these tests returns [].
  const mockPurchasesOutsideWindow = (purchases: Array<Record<string, unknown>>) =>
    mockPrisma.purchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) =>
      where && "OR" in where ? purchases : []
    )

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthorizePortalSection.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockGetTodayNewYork.mockReturnValue("2026-03-20")
    mockBuildSessionStartsAt.mockImplementation((date: string, time: string) => new Date(`${date}T${time}:00.000Z`))
    
    mockPrisma.purchase.findMany.mockResolvedValue([])
    mockPrisma.pointsLedger.groupBy.mockResolvedValue([])
    mockPrisma.pointsLedger.findMany.mockResolvedValue([])
    mockPrisma.packagePurchase.findMany.mockResolvedValue([])
    mockPrisma.packageUsageLedger.findMany.mockResolvedValue([])
    mockPrisma.packageUsageLedger.groupBy.mockResolvedValue([])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    mockPrisma.attendance.findMany.mockResolvedValue([])
    mockPrisma.attendance.groupBy.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.studentPinCredential.findMany.mockResolvedValue([])
  })

  it("includes students with attendance today but NO purchase record", async () => {
    const today = new Date("2026-03-20T18:00:00.000Z")
    
    // Mock attendance record
    const mockAttendance = {
      id: "attendance_1",
      userId: "user_attendance_only",
      status: "checked_in",
      checkedInAt: today,
      checkedOutAt: null,
      session: {
        courseSlug: "salsa-beginners",
        startsAt: today,
        title: "Salsa Beginners",
      },
      user: {
        id: "user_attendance_only",
        name: "Attendance Student",
        email: "att@example.com",
        phone: "+1 555 9999",
        clerkId: "clerk_1",
      },
      metadata: {},
      packageUsage: {
        packagePurchaseId: "pkg_purchase_1",
        packagePurchase: {
          packageId: "package_salsa_10",
        },
      },
    }

    mockPrisma.attendance.findMany.mockResolvedValue([mockAttendance])
    mockPrisma.packagePurchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "userId" in where) return []
      return [{ id: "pkg_purchase_1", purchaseId: "funding_purchase_1" }]
    })
    mockPrisma.purchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "id" in where) {
        return [{
          id: "funding_purchase_1",
          amount: 9000,
          currency: "usd",
          createdAt: new Date("2026-03-01T18:00:00.000Z"),
          courseTitle: "10-Class Package",
        }]
      }
      return []
    })
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user_attendance_only", clerkId: "clerk_1", name: "Attendance Student" }
    ])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([
      { slug: "salsa-beginners", location: "Room 1" }
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    // This is expected to FAIL before the fix
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      userId: "user_attendance_only",
      courseSlug: "salsa-beginners",
      packageId: "package_salsa_10",
      purchaseCategory: "package",
      checkInStatus: "checked_in",
      attendanceId: "attendance_1",
      fundingPayment: {
        id: "funding_purchase_1",
        amount: 9000,
      },
    })
    // A package credit was consumed for this attendance (packageUsage present), so the
    // synthesized row must be paid by credit, never a pending debt row.
    expect(data.items[0]).toMatchObject({
      paymentChannel: "package_credit",
      settlementStatus: "paid",
      classPaid: true,
    })
    expect(data.summary.pendingSettlement).toBe(0)
  })

  it("keeps a standalone attendance without a package credit as a pending debt row", async () => {
    const today = new Date("2026-03-20T18:00:00.000Z")

    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_no_credit",
        userId: "user_no_credit",
        status: "checked_in",
        checkedInAt: today,
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: today,
          title: "Salsa Beginners",
        },
        user: {
          id: "user_no_credit",
          name: "No Credit Student",
          email: "nocredit@example.com",
          phone: "+1 555 4444",
          clerkId: "clerk_no_credit",
        },
        metadata: {},
        packageUsage: null,
      },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user_no_credit", clerkId: "clerk_no_credit", name: "No Credit Student" }
    ])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([
      { slug: "salsa-beginners", location: "Room 1" }
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      userId: "user_no_credit",
      attendanceId: "attendance_no_credit",
      settlementStatus: "pending",
      classPaid: false,
    })
    expect(data.items[0].paymentChannel).not.toBe("package_credit")
  })

  it("surfaces the real linked purchase for a class-day attendance whose purchase is outside the query window", async () => {
    const today = new Date("2026-03-20T18:00:00.000Z")

    const mockAttendance = {
      id: "attendance_special",
      userId: "user_special",
      status: "scheduled",
      checkedInAt: today,
      checkedOutAt: null,
      session: {
        courseSlug: "special-salsa-calena",
        startsAt: today,
        title: "Special Salsa Caleña Class",
      },
      user: {
        id: "user_special",
        name: "Special Student",
        email: "special@example.com",
        phone: "+1 555 7777",
        clerkId: "clerk_special",
      },
      metadata: { purchaseId: "special_purchase_1", specialClassId: "sc_1" },
      packageUsage: null,
    }

    mockPrisma.attendance.findMany.mockResolvedValue([mockAttendance])
    mockPrisma.purchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "id" in where) {
        return [{
          id: "special_purchase_1",
          userId: "user_special",
          courseSlug: "special-salsa-calena",
          courseTitle: "Special Salsa Caleña Class",
          name: "Special Student",
          email: "special@example.com",
          phone: "+1 555 7777",
          packageId: null,
          serviceId: "special-class",
          amount: 2000,
          currency: "usd",
          status: "paid",
          metadata: { specialClassSlug: "special-salsa-calena", lockedAmountCents: "2000" },
          stripePaymentIntentId: "pi_special",
          stripeCheckoutSessionId: "cs_special",
          createdAt: new Date("2026-03-10T15:00:00.000Z"),
          updatedAt: new Date("2026-03-10T15:00:00.000Z"),
        }]
      }
      return []
    })
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user_special", clerkId: "clerk_special", name: "Special Student" }
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: "special_purchase_1",
      userId: "user_special",
      courseSlug: "special-salsa-calena",
      amount: 2000,
      classPaid: true,
      checkInStatus: "scheduled",
      attendanceId: "attendance_special",
    })
  })

  it("deduplicates attendance-only rows when a today purchase is already linked", async () => {
    const today = new Date("2026-03-20T18:00:00.000Z")

    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "purchase_today",
        userId: "user_linked",
        metadata: { date: "2026-03-20" },
      }),
    ])
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_linked",
        userId: "user_linked",
        status: "checked_in",
        checkedInAt: today,
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: today,
          title: "Salsa Beginners",
        },
        user: {
          id: "user_linked",
          name: "Linked Student",
          email: "linked@example.com",
          phone: "+1 555 1111",
          clerkId: "clerk_linked",
        },
        metadata: {
          purchaseId: "purchase_today",
        },
        packageUsage: null,
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: "purchase_today",
      userId: "user_linked",
      attendanceId: "attendance_linked",
      checkInStatus: "checked_in",
    })
  })

  it("keeps a selected-session package funding purchase as one historical class row", async () => {
    const selectedClassStart = new Date("2026-03-10T23:00:00.000Z")
    mockPrisma.purchase.findMany.mockResolvedValue([{
      ...buildPurchase({
        id: "package_funding",
        userId: "user_package",
        metadata: { attendanceId: "attendance_package", date: "2026-03-10", time: "19:00", packagePlanId: "plan_salsa" },
        createdAt: "2026-03-10T23:00:00.000Z",
      }),
      courseSlug: "bachata-intermediate",
      courseTitle: "Bachata Intermediate",
      packageId: "salsa-10",
    }])
    mockPrisma.attendance.findMany.mockResolvedValue([{
      id: "attendance_package",
      userId: "user_package",
      status: "checked_in",
      checkedInAt: selectedClassStart,
      checkedOutAt: null,
      session: { courseSlug: "bachata-intermediate", startsAt: selectedClassStart, title: "Bachata Intermediate" },
      user: { id: "user_package", name: "Package Student", email: "package@example.com", phone: "+1 555 0300", clerkId: "clerk_package" },
      metadata: { source: "staff_created_student_cash_package" },
      packageUsage: null,
    }])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-10&to=2026-03-10"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: "package_funding",
      attendanceId: "attendance_package",
      courseSlug: "bachata-intermediate",
      courseTitle: "Bachata Intermediate",
      classDate: "2026-03-10",
      classTime: "19:00",
    })
  })

  it("returns a historical attendance on the selected class date using checkedInAt", async () => {
    const historicalStart = new Date("2026-03-10T23:00:00.000Z")
    mockPrisma.attendance.findMany.mockResolvedValue([{
      id: "attendance_historical",
      userId: "user_historical",
      status: "checked_in",
      checkedInAt: historicalStart,
      checkedOutAt: null,
      session: { courseSlug: "salsa-beginners", startsAt: historicalStart, title: "Salsa Beginners" },
      user: { id: "user_historical", name: "Historical Student", email: "history@example.com", phone: "+15555550100", clerkId: "clerk_history" },
      metadata: { source: "staff_created_student" },
      packageUsage: null,
    }])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-10&to=2026-03-10"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toEqual(expect.arrayContaining([expect.objectContaining({ attendanceId: "attendance_historical", checkInStatus: "checked_in" })]))
  })

  it("excludes orphan staff fast-action attendance when the purchase was deleted", async () => {
    const today = new Date("2026-03-20T18:00:00.000Z")

    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_fast_action",
        userId: "user_fast_action",
        status: "checked_in_no_package",
        checkedInAt: today,
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: today,
          title: "Salsa Beginners",
        },
        user: {
          id: "user_fast_action",
          name: "Fast Action Student",
          email: "fast@example.com",
          phone: "+1 555 2222",
          clerkId: "clerk_fast",
        },
        metadata: {
          source: "staff_fast_action",
          date: "2026-03-20",
          time: "18:00",
        },
        packageUsage: null,
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(0)
  })

  it("does not synthesize a debt row when the class was already paid outside the query window", async () => {
    // Paid in cash on 2026-07-27; the staff cash-settlement action that recorded the
    // attendance happened on 2026-08-03. An August history query must not see the July
    // purchase in its own date-scoped result, so the fix must look it up separately.
    mockPrisma.attendance.findMany.mockResolvedValue([buildStandaloneAttendance({
      id: "attendance_cash_settled", userId: "user_cash", courseSlug: "salsa-night-beginner",
      startsAt: new Date("2026-07-27T21:10:00.000Z"), checkedInAt: new Date("2026-08-03T18:00:00.000Z"),
    })])
    mockPurchasesOutsideWindow([{
      id: "purchase_july_cash", userId: "user_cash", courseSlug: "salsa-night-beginner", status: "paid",
      metadata: { date: "2026-07-27", time: "21:10", settlementStatus: "paid", paymentChannel: "cash" },
    }])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments?mode=history&from=2026-08-01&to=2026-08-31"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(0)

    const orCall = mockPrisma.purchase.findMany.mock.calls.find(([args]) => args?.where && "OR" in args.where)
    expect(orCall?.[0].where.OR[0]).toMatchObject({ status: { in: ["succeeded", "paid", "completed"] } })
    expect(orCall?.[0].where.OR[0].createdAt).toEqual({ gte: expect.any(Date), lte: expect.any(Date) })
  })

  it("skips the outside-window coverage lookup entirely when every attendance is already covered by an in-window purchase", async () => {
    const classStart = new Date("2026-03-10T18:00:00.000Z")
    mockPrisma.purchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) =>
      where && "OR" in where
        ? []
        : [buildPurchase({ id: "purchase_covering", userId: "user_covered", metadata: { date: "2026-03-10" }, createdAt: "2026-03-10T18:00:00.000Z" })]
    )
    mockPrisma.attendance.findMany.mockResolvedValue([buildStandaloneAttendance({
      id: "attendance_covered", userId: "user_covered", courseSlug: "salsa-beginners", startsAt: classStart, checkedInAt: classStart,
    })])

    const { GET } = await import("@/app/api/staff/payments/route")
    await GET(new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-10&to=2026-03-10"))

    const orCalls = mockPrisma.purchase.findMany.mock.calls.filter(([args]) => args?.where && "OR" in args.where)
    expect(orCalls).toHaveLength(0)
  })

  it("counts an attendance's linked purchase as covered even when that purchase's own date is outside the query window", async () => {
    // "Mark all paid" settled this purchase today; its metadata.date is the class's own
    // June date, so a July query (matching the attendance's checkedInAt/session) never
    // sees it in its own date-scoped purchase fetch.
    mockPrisma.attendance.findMany.mockResolvedValue([buildStandaloneAttendance({
      id: "attendance_linked_outside_window", userId: "user_marked_paid", courseSlug: "bachata-intermediate",
      startsAt: new Date("2026-07-10T21:10:00.000Z"), checkedInAt: new Date("2026-07-15T18:00:00.000Z"),
      metadata: { purchaseId: "purchase_june_paid" },
    })])
    mockPurchasesOutsideWindow([{
      id: "purchase_june_paid", userId: "user_marked_paid", courseSlug: "bachata-intermediate", status: "paid",
      metadata: { date: "2026-06-22", time: "21:10", settlementStatus: "paid" },
    }])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments?mode=history&from=2026-07-01&to=2026-07-31"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(0)
  })

  it("uses the class session date for a synthetic row, not the later checked-in date", async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([buildStandaloneAttendance({
      id: "attendance_late_recorded", userId: "user_late", courseSlug: "salsa-night-beginner",
      startsAt: new Date("2026-08-05T21:10:00.000Z"), checkedInAt: new Date("2026-08-08T18:00:00.000Z"),
    })])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments?mode=history&from=2026-08-01&to=2026-08-31"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      attendanceId: "attendance_late_recorded",
      classDate: "2026-08-05",
      classTime: "21:10",
    })
  })
})
