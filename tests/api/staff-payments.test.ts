import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalSection = vi.fn()

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
  courseCatalog: {
    findMany: vi.fn(),
  },
  attendance: {
    findMany: vi.fn(),
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
  buildSessionStartsAt: vi.fn(() => null),
}))

vi.mock("@/lib/security/student-pin", () => ({
  isLockedCredential: vi.fn(() => false),
  isStudentPinLifecycleEnabled: vi.fn(() => true),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    users: {
      getUserList: vi.fn(async () => ({ data: [] })),
    },
  })),
}))

describe("staff payments route", () => {
  beforeEach(() => {
    mockAuthorizePortalSection.mockReset()
    mockPrisma.purchase.findMany.mockReset()
    mockPrisma.pointsLedger.groupBy.mockReset()
    mockPrisma.pointsLedger.findMany.mockReset()
    mockPrisma.packagePurchase.findMany.mockReset()
    mockPrisma.courseCatalog.findMany.mockReset()
    mockPrisma.attendance.findMany.mockReset()
    mockPrisma.user.findMany.mockReset()
    mockPrisma.studentPinCredential.findMany.mockReset()

    mockAuthorizePortalSection.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockPrisma.purchase.findMany.mockResolvedValue([
      {
        id: "purchase_1",
        userId: "user_1",
        courseSlug: "salsa-beginners",
        courseTitle: "Salsa Beginners",
        name: "Jane Student",
        email: "jane@example.com",
        phone: "+1 555 0100",
        packageId: null,
        serviceId: null,
        amount: 2500,
        currency: "usd",
        status: "paid",
        metadata: {},
        stripePaymentIntentId: "pi_123",
        stripeCheckoutSessionId: null,
        createdAt: new Date("2026-03-20T15:00:00.000Z"),
        updatedAt: new Date("2026-03-20T15:00:00.000Z"),
      },
    ])
    mockPrisma.pointsLedger.groupBy.mockResolvedValue([])
    mockPrisma.pointsLedger.findMany.mockResolvedValue([])
    mockPrisma.packagePurchase.findMany.mockResolvedValue([])
    mockPrisma.courseCatalog.findMany.mockResolvedValue([])
    mockPrisma.attendance.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])
  })

  it("keeps the students payload available when student PIN tables are not deployed", async () => {
    mockPrisma.studentPinCredential.findMany.mockRejectedValue({
      name: "PrismaClientKnownRequestError",
      code: "P2021",
    })

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.summary).toMatchObject({ totalItems: 1 })
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: "purchase_1",
      userId: "user_1",
      studentPin: {
        enabled: false,
        enrolled: false,
        locked: false,
        needsEnrollment: false,
      },
    })
  })
})
