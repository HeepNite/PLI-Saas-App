import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalSection = vi.fn()
const mockGetTodayNewYork = vi.fn()
const mockBuildSessionStartsAt = vi.fn()
const mockClerkGetUserList = vi.fn(async () => ({ data: [] }))

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
  getStartOfDayNY: (date: string) => new Date(`${date}T04:00:00.000Z`),
  getTimeKeyInTimeZone: (date: Date) => date.toISOString().slice(11, 16),
}))

vi.mock("@/lib/security/student-pin", () => ({
  isLockedCredential: vi.fn(() => false),
  isProvisionalStudentPinActive: vi.fn((credential: { status: string; expiresAt: Date | null } | null) =>
    Boolean(
      credential &&
        credential.status !== "expired" &&
        credential.status !== "obsolete" &&
        credential.status !== "superseded" &&
        credential.status !== "consumed" &&
        (!credential.expiresAt || credential.expiresAt > new Date())
    )
  ),
  isStudentPinLifecycleEnabled: vi.fn(() => true),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    users: {
      getUserList: (...args: unknown[]) => mockClerkGetUserList(...args),
    },
  })),
}))

describe("staff payments route", () => {
  const buildPurchase = ({
    id,
    userId,
    amount,
    status = "paid",
    metadata = {},
    createdAt = "2026-03-20T15:00:00.000Z",
    courseSlug = "salsa-beginners",
    courseTitle = "Salsa Beginners",
  }: {
    id: string
    userId: string
    amount: number
    status?: string
    metadata?: Record<string, unknown>
    createdAt?: string
    courseSlug?: string
    courseTitle?: string
  }) => ({
    id,
    userId,
    courseSlug,
    courseTitle,
    name: `Student ${id}`,
    email: `${id}@example.com`,
    phone: "+1 555 0100",
    packageId: null,
    serviceId: null,
    amount,
    currency: "usd",
    status,
    metadata,
    stripePaymentIntentId: status === "pending" ? null : `pi_${id}`,
    stripeCheckoutSessionId: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  })

  beforeEach(() => {
    mockAuthorizePortalSection.mockReset()
    mockGetTodayNewYork.mockReset()
    mockBuildSessionStartsAt.mockReset()
    mockClerkGetUserList.mockReset()
    mockPrisma.purchase.findMany.mockReset()
    mockPrisma.pointsLedger.groupBy.mockReset()
    mockPrisma.pointsLedger.findMany.mockReset()
    mockPrisma.packagePurchase.findMany.mockReset()
    mockPrisma.packageUsageLedger.findMany.mockReset()
    mockPrisma.packageUsageLedger.groupBy.mockReset()
    mockPrisma.courseCatalog.findMany.mockReset()
    mockPrisma.attendance.findMany.mockReset()
    mockPrisma.attendance.groupBy.mockReset()
    mockPrisma.user.findMany.mockReset()
    mockPrisma.studentPinCredential.findMany.mockReset()

    mockAuthorizePortalSection.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockGetTodayNewYork.mockReturnValue("2026-03-20")
    mockBuildSessionStartsAt.mockImplementation((date: string, time: string) => new Date(`${date}T${time}:00.000Z`))
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "purchase_1",
        userId: "user_1",
        amount: 2500,
        metadata: { date: "2026-03-20" },
      }),
    ])
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

  it("does not flag consumed provisional PINs as active on the staff board", async () => {
    mockPrisma.studentPinCredential.findMany.mockResolvedValue([
      {
        userId: "user_1",
        kind: "provisional",
        status: "consumed",
        failedAttempts: 0,
        lockedAt: null,
        expiresAt: new Date("2026-03-27T23:59:59.999Z"),
      },
      {
        userId: "user_1",
        kind: "permanent",
        status: "active",
        failedAttempts: 0,
        lockedAt: null,
        expiresAt: null,
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items[0]?.studentPin).toMatchObject({
      enabled: true,
      enrolled: true,
      provisionalActive: false,
      needsEnrollment: false,
    })
  })

  it("includes purchases whose metadata.date matches today's New York date", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({ id: "today_1", userId: "user_1", amount: 2500, metadata: { date: "2026-03-20" } }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]?.id).toBe("today_1")
    expect(data.summary).toMatchObject({ totalItems: 1, totalCollected: 2500, paidStripe: 1 })
  })

  it("excludes purchases whose metadata.date is yesterday", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({ id: "yesterday_1", userId: "user_1", amount: 2500, metadata: { date: "2026-03-19" }, createdAt: "2026-03-19T15:00:00.000Z" }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(0)
    expect(data.summary).toMatchObject({ totalItems: 0, totalCollected: 0, paidStripe: 0, pendingStripe: 0 })
  })

  it("excludes legacy purchases without metadata.date", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({ id: "legacy_1", userId: "user_1", amount: 2500, metadata: {}, createdAt: "2026-03-19T15:00:00.000Z" }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(0)
    expect(data.summary).toMatchObject({ totalItems: 0, totalCollected: 0 })
  })

  it("returns only today's purchases from a mixed set and computes summary from filtered rows", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({ id: "today_paid", userId: "user_1", amount: 2500, status: "paid", metadata: { date: "2026-03-20", paymentChannel: "card" } }),
      buildPurchase({ id: "today_cash", userId: "user_2", amount: 1800, status: "pending", metadata: { date: "2026-03-20", paymentChannel: "cash", settlementStatus: "pending" } }),
      buildPurchase({ id: "yesterday_paid", userId: "user_3", amount: 9900, status: "paid", metadata: { date: "2026-03-19", paymentChannel: "card" }, createdAt: "2026-03-19T15:00:00.000Z" }),
      buildPurchase({ id: "legacy_paid", userId: "user_4", amount: 4700, status: "paid", metadata: { paymentChannel: "cash", settlementStatus: "paid" }, createdAt: "2026-03-18T10:00:00.000Z" }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items.map((item: { id: string }) => item.id)).toEqual(["today_paid", "today_cash"])
    expect(data.summary).toMatchObject({
      totalItems: 2,
      totalCollected: 2500,
      pendingSettlement: 1,
      paidSettlement: 0,
      paidStripe: 1,
      pendingStripe: 1,
    })
  })

  it("keeps the current New York day visible at 11:59 PM local time", async () => {
    mockGetTodayNewYork.mockReturnValue("2026-03-20")
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({ id: "late_night_today", userId: "user_1", amount: 2500, metadata: { date: "2026-03-20" } }),
      buildPurchase({ id: "next_day", userId: "user_2", amount: 2500, metadata: { date: "2026-03-21" }, createdAt: "2026-03-21T05:00:00.000Z" }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(data.items.map((item: { id: string }) => item.id)).toEqual(["late_night_today"])
  })

  it("drops yesterday's purchases immediately after New York midnight rollover", async () => {
    mockGetTodayNewYork.mockReturnValue("2026-03-21")
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({ id: "yesterday_before_rollover", userId: "user_1", amount: 2500, metadata: { date: "2026-03-20" } }),
      buildPurchase({ id: "today_after_rollover", userId: "user_2", amount: 3200, metadata: { date: "2026-03-21" } }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(data.items.map((item: { id: string }) => item.id)).toEqual(["today_after_rollover"])
    expect(data.summary).toMatchObject({ totalItems: 1, totalCollected: 3200 })
  })

  it("passes name, email, phone and course search to the payments query", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments?q=elvira"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toEqual([])
    expect(mockPrisma.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { email: { contains: "elvira", mode: "insensitive" } },
                { name: { contains: "elvira", mode: "insensitive" } },
                { phone: { contains: "elvira", mode: "insensitive" } },
                { courseTitle: { contains: "elvira", mode: "insensitive" } },
                { courseSlug: { contains: "elvira", mode: "insensitive" } },
              ],
            },
            expect.objectContaining({
              createdAt: expect.objectContaining({
                gte: expect.any(Date),
                lte: expect.any(Date),
              }),
            }),
          ],
        },
      })
    )
  })

  it("uses the New York date key during DST-sensitive day selection", async () => {
    mockGetTodayNewYork.mockReturnValue("2026-03-08")
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({ id: "spring_forward_today", userId: "user_1", amount: 2500, metadata: { date: "2026-03-08" } }),
      buildPurchase({ id: "spring_forward_prev_day", userId: "user_2", amount: 2500, metadata: { date: "2026-03-07" } }),
      buildPurchase({ id: "fall_back_other_day", userId: "user_3", amount: 2500, metadata: { date: "2026-11-01" } }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(data.items.map((item: { id: string }) => item.id)).toEqual(["spring_forward_today"])
  })

  it("computes summary metrics using only the filtered rows", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({ id: "today_card_paid", userId: "user_1", amount: 1200, status: "paid", metadata: { date: "2026-03-20", paymentChannel: "card" } }),
      buildPurchase({ id: "today_cash_paid", userId: "user_2", amount: 800, status: "paid", metadata: { date: "2026-03-20", paymentChannel: "cash", settlementStatus: "paid" } }),
      buildPurchase({ id: "today_cash_pending", userId: "user_3", amount: 600, status: "pending", metadata: { date: "2026-03-20", paymentChannel: "cash", settlementStatus: "pending" } }),
      buildPurchase({ id: "yesterday_large_paid", userId: "user_4", amount: 20000, status: "paid", metadata: { date: "2026-03-19", paymentChannel: "card" }, createdAt: "2026-03-19T15:00:00.000Z" }),
      buildPurchase({ id: "legacy_large_paid", userId: "user_5", amount: 15000, status: "paid", metadata: { paymentChannel: "cash", settlementStatus: "paid" }, createdAt: "2026-03-18T10:00:00.000Z" }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(data.items.map((item: { id: string }) => item.id)).toEqual([
      "today_card_paid",
      "today_cash_paid",
      "today_cash_pending",
    ])
    expect(data.summary).toEqual({
      totalItems: 3,
      totalCollected: 2000,
      pendingSettlement: 1,
      paidSettlement: 1,
      pendingStripe: 1,
      paidStripe: 2,
    })
  })

  it("hydrates package consumptions with their funding payment in daily mode", async () => {
    mockPrisma.purchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "id" in where) {
        return [
          {
            id: "funding_purchase_1",
            amount: 9000,
            currency: "usd",
            createdAt: new Date("2026-03-01T18:00:00.000Z"),
            courseTitle: "10-Class Package",
          },
        ]
      }

      return [
        buildPurchase({
          id: "package_credit_today",
          userId: "user_1",
          amount: 0,
          metadata: { date: "2026-03-20", time: "18:00", paymentChannel: "package_credit", packageId: "pkg_1" },
        }),
      ]
    })
    mockPrisma.packagePurchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "userId" in where) return []
      return [{ id: "package_purchase_1", purchaseId: "funding_purchase_1" }]
    })
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_1",
        userId: "user_1",
        status: "checked_in",
        checkedInAt: new Date("2026-03-20T18:01:00.000Z"),
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: new Date("2026-03-20T18:00:00.000Z"),
        },
        packageUsage: {
          packagePurchaseId: "package_purchase_1",
        },
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: "package_credit_today",
      amount: 0,
      fundingPayment: {
        id: "funding_purchase_1",
        amount: 9000,
        currency: "usd",
        courseTitle: "10-Class Package",
      },
    })
  })

  it("hydrates package consumptions from attendance-linked package purchases when metadata lacks packagePurchaseId", async () => {
    mockPrisma.purchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "id" in where) {
        return [
          {
            id: "funding_purchase_attendance",
            amount: 9500,
            currency: "usd",
            createdAt: new Date("2026-03-01T18:00:00.000Z"),
            courseTitle: "12-Class Package",
          },
        ]
      }

      return [
        buildPurchase({
          id: "package_credit_attendance_link",
          userId: "user_1",
          amount: 0,
          metadata: { date: "2026-03-20", time: "18:00", paymentChannel: "package_credit", packageId: "pkg_12" },
        }),
      ]
    })
    mockPrisma.packagePurchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "userId" in where) return []
      if (where && "OR" in where) return []
      if (where && "id" in where) {
        return [{ id: "package_purchase_attendance", purchaseId: "funding_purchase_attendance" }]
      }
      return []
    })
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_attendance_link",
        userId: "user_1",
        status: "checked_in",
        checkedInAt: new Date("2026-03-20T18:01:00.000Z"),
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: new Date("2026-03-20T18:00:00.000Z"),
        },
        packageUsage: {
          packagePurchaseId: "package_purchase_attendance",
        },
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: "package_credit_attendance_link",
      amount: 0,
      attendanceId: "attendance_attendance_link",
      fundingPayment: {
        id: "funding_purchase_attendance",
        amount: 9500,
        currency: "usd",
        courseTitle: "12-Class Package",
      },
    })
  })

  it("keeps attendance-linked funding payments even when the visible daily row is still categorized as other", async () => {
    mockPrisma.purchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "id" in where) {
        return [
          {
            id: "funding_purchase_other",
            amount: 9100,
            currency: "usd",
            createdAt: new Date("2026-03-01T18:00:00.000Z"),
            courseTitle: "10-Class Package",
          },
        ]
      }

      return [
        buildPurchase({
          id: "daily_checkin_package_backed",
          userId: "user_1",
          amount: 0,
          status: "pending",
          metadata: { date: "2026-03-20", time: "18:00", paymentChannel: "card" },
        }),
      ]
    })
    mockPrisma.packagePurchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "userId" in where) return []
      if (where && "OR" in where) return []
      if (where && "id" in where) {
        return [{ id: "package_purchase_other", purchaseId: "funding_purchase_other" }]
      }
      return []
    })
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_other_link",
        userId: "user_1",
        status: "checked_in",
        checkedInAt: new Date("2026-03-20T18:01:00.000Z"),
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: new Date("2026-03-20T18:00:00.000Z"),
        },
        packageUsage: {
          packagePurchaseId: "package_purchase_other",
        },
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: "daily_checkin_package_backed",
      paymentChannel: "card",
      purchaseCategory: "other",
      paymentStatus: "pending",
      fundingPayment: {
        id: "funding_purchase_other",
        amount: 9100,
        currency: "usd",
        courseTitle: "10-Class Package",
      },
    })
  })

  it("hydrates package consumptions directly from metadata packagePurchaseId when no attendance link is available", async () => {
    mockPrisma.purchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "id" in where) {
        return [
          {
            id: "funding_purchase_metadata",
            amount: 9000,
            currency: "usd",
            createdAt: new Date("2026-03-01T18:00:00.000Z"),
            courseTitle: "10-Class Package",
          },
        ]
      }

      return [
        buildPurchase({
          id: "package_credit_metadata_link",
          userId: "user_1",
          amount: 0,
          metadata: {
            date: "2026-03-20",
            time: "18:00",
            paymentChannel: "package_credit",
            packageId: "pkg_1",
            packagePurchaseId: "package_purchase_metadata",
          },
        }),
      ]
    })
    mockPrisma.packagePurchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "OR" in where) {
        return [{ id: "package_purchase_metadata", purchaseId: "funding_purchase_metadata" }]
      }
      return []
    })
    mockPrisma.attendance.findMany.mockResolvedValue([])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: "package_credit_metadata_link",
      amount: 0,
      fundingPayment: {
        id: "funding_purchase_metadata",
        amount: 9000,
        currency: "usd",
        courseTitle: "10-Class Package",
      },
    })
  })

  it("rejects history mode without a valid YYYY-MM-DD date", async () => {
    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments?mode=history&date=03-20-2026"))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "History mode requires valid YYYY-MM-DD from/to dates." })
    expect(mockPrisma.purchase.findMany).not.toHaveBeenCalled()
  })

  it("rejects history mode when only one range boundary is provided", async () => {
    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-18"))
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "History mode requires both from and to dates." })
    expect(mockPrisma.purchase.findMany).not.toHaveBeenCalled()
  })

  it("rejects history mode when from is after to", async () => {
    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(
      new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-19&to=2026-03-18")
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "History mode requires from to be on or before to." })
    expect(mockPrisma.purchase.findMany).not.toHaveBeenCalled()
  })

  it("returns range history results across all classes for the selected period", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "history_salsa",
        userId: "user_1",
        amount: 2500,
        courseSlug: "salsa-beginners",
        courseTitle: "Salsa Beginners",
        metadata: { date: "2026-03-18", time: "18:00", paymentChannel: "card" },
      }),
      buildPurchase({
        id: "history_bachata",
        userId: "user_2",
        amount: 1800,
        courseSlug: "bachata-int",
        courseTitle: "Bachata Intermediate",
        metadata: { date: "2026-03-18", time: "20:00", paymentChannel: "cash", settlementStatus: "paid" },
        status: "paid",
      }),
      buildPurchase({
        id: "other_date",
        userId: "user_3",
        amount: 9900,
        courseSlug: "zouk-open",
        courseTitle: "Zouk Open",
        metadata: { date: "2026-03-17", time: "19:00", paymentChannel: "card" },
      }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(
      new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-18&to=2026-03-19")
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items.map((item: { id: string }) => item.id)).toEqual(["history_salsa", "history_bachata"])
    expect(data.summary).toEqual({
      totalItems: 2,
      totalCollected: 4300,
      pendingSettlement: 0,
      paidSettlement: 1,
      pendingStripe: 0,
      paidStripe: 2,
    })
    expect(data.classOptions).toEqual([
      { slug: "salsa-beginners", title: "Salsa Beginners" },
      { slug: "bachata-int", title: "Bachata Intermediate" },
    ])
    expect(data.meta).toEqual({
      mode: "history",
      from: "2026-03-18",
      to: "2026-03-19",
      truncated: false,
    })
    expect(mockPrisma.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        take: 2001,
        where: {
          AND: [
            { metadata: { path: ["date"], gte: "2026-03-18" } },
            { metadata: { path: ["date"], lte: "2026-03-19" } },
          ],
        },
      })
    )
  })

  it("treats the deprecated date param as a same-day alias", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "history_same_day",
        userId: "user_1",
        amount: 2500,
        courseSlug: "salsa-beginners",
        courseTitle: "Salsa Beginners",
        metadata: { date: "2026-03-18", time: "18:00", paymentChannel: "card" },
      }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments?mode=history&date=2026-03-18"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items.map((item: { id: string }) => item.id)).toEqual(["history_same_day"])
    expect(data.meta).toEqual({
      mode: "history",
      from: "2026-03-18",
      to: "2026-03-18",
      truncated: false,
    })
    expect(mockPrisma.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2001,
        where: {
          AND: [
            { metadata: { path: ["date"], gte: "2026-03-18" } },
            { metadata: { path: ["date"], lte: "2026-03-18" } },
          ],
        },
      })
    )
  })

  it("narrows history results by range and class while preserving the full class option union", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "history_salsa",
        userId: "user_1",
        amount: 2500,
        courseSlug: "salsa-beginners",
        courseTitle: "Salsa Beginners",
        metadata: { date: "2026-03-18", time: "18:00", paymentChannel: "card" },
      }),
      buildPurchase({
        id: "history_bachata",
        userId: "user_2",
        amount: 1800,
        courseSlug: "bachata-int",
        courseTitle: "Bachata Intermediate",
        metadata: { date: "2026-03-18", time: "20:00", paymentChannel: "card" },
      }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(
      new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-18&to=2026-03-19&class=bachata-int")
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items.map((item: { id: string }) => item.id)).toEqual(["history_bachata"])
    expect(data.summary).toEqual({
      totalItems: 1,
      totalCollected: 1800,
      pendingSettlement: 0,
      paidSettlement: 0,
      pendingStripe: 0,
      paidStripe: 1,
    })
    expect(data.classOptions).toEqual([
      { slug: "salsa-beginners", title: "Salsa Beginners" },
      { slug: "bachata-int", title: "Bachata Intermediate" },
    ])
    expect(data.meta).toEqual({
      mode: "history",
      from: "2026-03-18",
      to: "2026-03-19",
      truncated: false,
    })
  })

  it("excludes legacy history purchases without metadata.date/time from results and classOptions", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "history_valid",
        userId: "user_1",
        amount: 2500,
        courseSlug: "salsa-beginners",
        courseTitle: "Salsa Beginners",
        metadata: { date: "2026-03-18", time: "18:00", paymentChannel: "card" },
      }),
      buildPurchase({
        id: "legacy_missing_time",
        userId: "user_2",
        amount: 1800,
        courseSlug: "bachata-int",
        courseTitle: "Bachata Intermediate",
        metadata: { date: "2026-03-18", paymentChannel: "card" },
      }),
      buildPurchase({
        id: "legacy_missing_date",
        userId: "user_3",
        amount: 1200,
        courseSlug: "zouk-open",
        courseTitle: "Zouk Open",
        metadata: { time: "19:00", paymentChannel: "card" },
      }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(
      new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-18&to=2026-03-18")
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items.map((item: { id: string }) => item.id)).toEqual(["history_valid"])
    expect(data.classOptions).toEqual([{ slug: "salsa-beginners", title: "Salsa Beginners" }])
    expect(data.summary).toEqual({
      totalItems: 1,
      totalCollected: 2500,
      pendingSettlement: 0,
      paidSettlement: 0,
      pendingStripe: 0,
      paidStripe: 1,
    })
  })

  it("keeps history summary scoped to the filtered date and settlement rows", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "history_card_paid",
        userId: "user_1",
        amount: 1200,
        status: "paid",
        courseSlug: "salsa-beginners",
        metadata: { date: "2026-03-18", time: "18:00", paymentChannel: "card" },
      }),
      buildPurchase({
        id: "history_cash_paid",
        userId: "user_2",
        amount: 800,
        status: "paid",
        courseSlug: "bachata-int",
        courseTitle: "Bachata Intermediate",
        metadata: { date: "2026-03-18", time: "20:00", paymentChannel: "cash", settlementStatus: "paid" },
      }),
      buildPurchase({
        id: "history_cash_pending",
        userId: "user_3",
        amount: 600,
        status: "pending",
        courseSlug: "bachata-int",
        courseTitle: "Bachata Intermediate",
        metadata: { date: "2026-03-18", time: "21:00", paymentChannel: "cash", settlementStatus: "pending" },
      }),
      buildPurchase({
        id: "other_day_large_paid",
        userId: "user_4",
        amount: 20000,
        status: "paid",
        courseSlug: "zouk-open",
        metadata: { date: "2026-03-17", time: "19:00", paymentChannel: "card" },
      }),
      buildPurchase({
        id: "legacy_large_paid",
        userId: "user_5",
        amount: 15000,
        status: "paid",
        courseSlug: "legacy-open",
        metadata: { date: "2026-03-18", paymentChannel: "cash", settlementStatus: "paid" },
      }),
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(
      new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-18&to=2026-03-18&settlement=paid")
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items.map((item: { id: string }) => item.id)).toEqual(["history_cash_paid"])
    expect(data.summary).toEqual({
      totalItems: 1,
      totalCollected: 800,
      pendingSettlement: 0,
      paidSettlement: 1,
      pendingStripe: 0,
      paidStripe: 1,
    })
    expect(data.classOptions).toEqual([
      { slug: "salsa-beginners", title: "Salsa Beginners" },
      { slug: "bachata-int", title: "Bachata Intermediate" },
    ])
  })

  it("returns packageClassNumber when the history package usage can be resolved server-side", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "history_package",
        userId: "user_1",
        amount: 2500,
        courseSlug: "salsa-beginners",
        courseTitle: "Salsa Beginners",
        metadata: { date: "2026-03-18", time: "18:00", paymentChannel: "card", packageId: "pkg_1" },
      }),
    ])
    mockPrisma.packagePurchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "OR" in where) {
        return [{ id: "package_purchase_1", purchaseId: "history_package" }]
      }
      return []
    })
    mockPrisma.packageUsageLedger.findMany.mockResolvedValue([
      {
        id: "usage_1",
        packagePurchaseId: "package_purchase_1",
        attendanceId: "attendance_prev",
        createdAt: new Date("2026-03-11T18:00:00.000Z"),
      },
      {
        id: "usage_2",
        packagePurchaseId: "package_purchase_1",
        attendanceId: "attendance_1",
        createdAt: new Date("2026-03-18T18:05:00.000Z"),
      },
    ])
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_1",
        userId: "user_1",
        status: "checked_in",
        checkedInAt: new Date("2026-03-18T18:01:00.000Z"),
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: new Date("2026-03-18T18:00:00.000Z"),
        },
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(
      new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-18&to=2026-03-18")
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: "history_package",
      packageClassNumber: 2,
    })
  })

  it("hydrates real completed classes and active package consumption totals for daily cards", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "daily_package_checkin",
        userId: "user_1",
        amount: 0,
        metadata: { date: "2026-03-20", time: "18:00", paymentChannel: "card", packageId: "pkg_8" },
      }),
    ])
    mockPrisma.packagePurchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "userId" in where) {
        return [{
          id: "package_purchase_active",
          userId: "user_1",
          packageId: "pkg_8",
          packageLabel: "8 classes",
          totalCredits: 8,
          remainingCredits: 2,
          isUnlimited: false,
          expiresAt: null,
          lastUsedAt: new Date("2026-03-20T18:01:00.000Z"),
          purchasedAt: new Date("2026-03-01T18:00:00.000Z"),
          status: "active",
        }]
      }
      return []
    })
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_1",
        userId: "user_1",
        status: "checked_in",
        checkedInAt: new Date("2026-03-20T18:01:00.000Z"),
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: new Date("2026-03-20T18:00:00.000Z"),
        },
        packageUsage: {
          packagePurchaseId: "package_purchase_active",
        },
      },
    ])
    mockPrisma.attendance.groupBy.mockResolvedValue([
      {
        userId: "user_1",
        _count: { _all: 6 },
      },
    ])
    mockPrisma.packageUsageLedger.groupBy.mockResolvedValue([
      {
        packagePurchaseId: "package_purchase_active",
        _count: { _all: 6 },
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items[0]).toMatchObject({
      id: "daily_package_checkin",
      completedClassesTotal: 6,
      packageClassesUsedTotal: 6,
      activePackage: {
        remainingCredits: 2,
      },
    })
  })

  it("derives finite package usage from total credits minus remaining credits and keeps completed classes aligned", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "elvira_daily_package",
        userId: "user_elvira",
        amount: 0,
        metadata: { date: "2026-03-20", time: "18:00", paymentChannel: "card", packageId: "pkg_8" },
      }),
      buildPurchase({
        id: "elvira_old_due",
        userId: "user_elvira",
        amount: 2000,
        status: "pending",
        metadata: { date: "2026-03-18", time: "18:00", paymentChannel: "card" },
      }),
    ])
    mockPrisma.packagePurchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "userId" in where) {
        return [{
          id: "package_purchase_elvira",
          userId: "user_elvira",
          packageId: "pkg_8",
          packageLabel: "8 classes",
          totalCredits: 8,
          remainingCredits: 2,
          isUnlimited: false,
          expiresAt: null,
          lastUsedAt: new Date("2026-03-20T18:01:00.000Z"),
          purchasedAt: new Date("2026-03-01T18:00:00.000Z"),
          status: "active",
        }]
      }
      return []
    })
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_elvira_1",
        userId: "user_elvira",
        status: "checked_in",
        checkedInAt: new Date("2026-03-20T18:01:00.000Z"),
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: new Date("2026-03-20T18:00:00.000Z"),
        },
        packageUsage: {
          packagePurchaseId: "package_purchase_elvira",
        },
      },
    ])
    mockPrisma.attendance.groupBy.mockResolvedValue([
      {
        userId: "user_elvira",
        _count: { _all: 2 },
      },
    ])
    mockPrisma.packageUsageLedger.groupBy.mockResolvedValue([
      {
        packagePurchaseId: "package_purchase_elvira",
        _count: { _all: 2 },
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items[0]).toMatchObject({
      id: "elvira_daily_package",
      completedClassesTotal: 6,
      packageClassesUsedTotal: 6,
      outstandingBalance: 2000,
      activePackage: {
        totalCredits: 8,
        remainingCredits: 2,
      },
    })
  })

  it("counts only attended unlimited package usages so initial bookings do not inflate daily usage", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "mariano_daily_unlimited",
        userId: "user_mariano",
        amount: 0,
        metadata: { date: "2026-03-20", time: "19:00", paymentChannel: "card", packageId: "pkg_unlimited" },
      }),
    ])
    mockPrisma.packagePurchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "userId" in where) {
        return [{
          id: "package_purchase_mariano",
          userId: "user_mariano",
          packageId: "pkg_unlimited",
          packageLabel: "Unlimited",
          totalCredits: null,
          remainingCredits: null,
          isUnlimited: true,
          expiresAt: null,
          lastUsedAt: new Date("2026-03-20T19:01:00.000Z"),
          purchasedAt: new Date("2026-03-10T18:00:00.000Z"),
          status: "active",
        }]
      }
      return []
    })
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_mariano_1",
        userId: "user_mariano",
        status: "checked_in",
        checkedInAt: new Date("2026-03-20T19:01:00.000Z"),
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: new Date("2026-03-20T19:00:00.000Z"),
        },
        packageUsage: {
          packagePurchaseId: "package_purchase_mariano",
        },
      },
    ])
    mockPrisma.attendance.groupBy.mockResolvedValue([
      {
        userId: "user_mariano",
        _count: { _all: 1 },
      },
    ])
    mockPrisma.packageUsageLedger.groupBy.mockResolvedValue([
      {
        packagePurchaseId: "package_purchase_mariano",
        _count: { _all: 1 },
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items[0]).toMatchObject({
      id: "mariano_daily_unlimited",
      completedClassesTotal: 1,
      packageClassesUsedTotal: 1,
      activePackage: {
        isUnlimited: true,
      },
    })
    expect(mockPrisma.packageUsageLedger.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        attendance: {
          is: {
            status: { in: ["checked_in", "checked_in_no_package", "checked_out"] },
          },
        },
      }),
    }))
  })

  it("returns null packageClassNumber when the package usage chain cannot be resolved", async () => {
    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "history_package_unresolved",
        userId: "user_1",
        amount: 2500,
        courseSlug: "salsa-beginners",
        courseTitle: "Salsa Beginners",
        metadata: { date: "2026-03-18", time: "18:00", paymentChannel: "card", packageId: "pkg_1" },
      }),
    ])
    mockPrisma.packagePurchase.findMany.mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
      if (where && "OR" in where) {
        return [{ id: "package_purchase_1", purchaseId: "history_package_unresolved" }]
      }
      return []
    })
    mockPrisma.packageUsageLedger.findMany.mockResolvedValue([
      {
        id: "usage_1",
        packagePurchaseId: "package_purchase_1",
        attendanceId: "attendance_other",
        createdAt: new Date("2026-03-18T18:05:00.000Z"),
      },
    ])
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "attendance_1",
        userId: "user_1",
        status: "checked_in",
        checkedInAt: new Date("2026-03-18T18:01:00.000Z"),
        checkedOutAt: null,
        session: {
          courseSlug: "salsa-beginners",
          startsAt: new Date("2026-03-18T18:00:00.000Z"),
        },
      },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(
      new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-18&to=2026-03-18")
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: "history_package_unresolved",
      packageClassNumber: null,
    })
  })

  it("caps history results at 2000 rows and surfaces truncation explicitly", async () => {
    const rangePurchases = Array.from({ length: 2001 }, (_, index) =>
      buildPurchase({
        id: `history_${index + 1}`,
        userId: `user_${index + 1}`,
        amount: 1000,
        metadata: { date: "2026-03-18", time: "18:00", paymentChannel: "card" },
      })
    )
    mockPrisma.purchase.findMany.mockResolvedValue(rangePurchases)

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(
      new Request("http://localhost/api/staff/payments?mode=history&from=2026-03-18&to=2026-03-18")
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(2000)
    expect(data.items[0]?.id).toBe("history_1")
    expect(data.items.at(-1)?.id).toBe("history_2000")
    expect(data.summary).toMatchObject({
      totalItems: 2000,
      totalCollected: 2_000_000,
      pendingStripe: 0,
      paidStripe: 2000,
    })
    expect(data.meta).toEqual({
      mode: "history",
      from: "2026-03-18",
      to: "2026-03-18",
      truncated: true,
    })
  })

  it("resolves canonical customerName from Clerk when available, falling back to DB name then purchase name", async () => {
    mockClerkGetUserList.mockResolvedValue({
      data: [
        {
          id: "clerk_user_1",
          firstName: "Palladium",
          lastName: "Latin Art",
          imageUrl: "https://example.com/avatar1.jpg",
          hasImage: true,
        },
      ],
    })

    mockPrisma.purchase.findMany.mockResolvedValue([
      buildPurchase({
        id: "purchase_clerk",
        userId: "user_1",
        amount: 2500,
        metadata: { date: "2026-03-20" },
      }),
      buildPurchase({
        id: "purchase_no_clerk",
        userId: "user_2",
        amount: 1800,
        metadata: { date: "2026-03-20" },
      }),
      buildPurchase({
        id: "purchase_no_user",
        userId: "user_3",
        amount: 900,
        metadata: { date: "2026-03-20" },
      }),
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "user_1", clerkId: "clerk_user_1", name: "DB Name One" },
      { id: "user_2", clerkId: null, name: "DB Name Two" },
      { id: "user_3", clerkId: null, name: null },
    ])

    const { GET } = await import("@/app/api/staff/payments/route")
    const res = await GET(new Request("http://localhost/api/staff/payments"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.items).toHaveLength(3)

    // user_1: has Clerk data → should show "Palladium Latin Art" (not purchase name "Student purchase_clerk")
    expect(data.items.find((i: { id: string }) => i.id === "purchase_clerk")?.customerName).toBe("Palladium Latin Art")

    // user_2: no Clerk, has DB name → should show "DB Name Two"
    expect(data.items.find((i: { id: string }) => i.id === "purchase_no_clerk")?.customerName).toBe("DB Name Two")

    // user_3: no Clerk, no DB name → should fall back to purchase name
    expect(data.items.find((i: { id: string }) => i.id === "purchase_no_user")?.customerName).toBe("Student purchase_no_user")
  })
})
