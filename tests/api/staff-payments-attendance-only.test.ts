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
})
