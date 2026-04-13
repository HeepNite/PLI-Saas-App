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
  getTodayNewYork: () => mockGetTodayNewYork(),
  getTimeKeyInTimeZone: (date: Date) => date.toISOString().split("T")[1].substring(0, 5),
}))

vi.mock("@/lib/security/student-pin", () => ({
  isLockedCredential: vi.fn(() => false),
  isProvisionalStudentPinActive: vi.fn(() => false),
  isStudentPinLifecycleEnabled: vi.fn(() => true),
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
})
