import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalSection = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockGetUserList = vi.fn()
const mockIsStudentPinLifecycleEnabled = vi.fn(() => true)
const mockIsProvisionalStudentPinActive = vi.fn((credential: { kind: string; status: string; expiresAt?: Date | null } | null | undefined) =>
  Boolean(
    credential &&
      credential.kind === "provisional" &&
      credential.status === "active" &&
      (!credential.expiresAt || credential.expiresAt > new Date("2026-04-04T12:00:00.000Z"))
  )
)

const mockPrisma = {
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  pointsLedger: {
    groupBy: vi.fn(),
  },
  purchase: {
    findMany: vi.fn(),
  },
  packagePurchase: {
    findMany: vi.fn(),
  },
  attendance: {
    findMany: vi.fn(),
  },
  studentPinCredential: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalSectionRequest: (...args: unknown[]) => mockAuthorizePortalSection(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff-students-search"),
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    users: {
      getUserList: mockGetUserList,
    },
  })),
}))

vi.mock("@/lib/class-schedule", () => ({
  getTodayNewYork: vi.fn(() => "2026-04-04"),
  buildSessionStartsAt: vi.fn((dateIso: string, time24: string) => new Date(`${dateIso}T${time24}:00.000Z`)),
}))

vi.mock("@/lib/security/student-pin", () => ({
  isStudentPinLifecycleEnabled: () => mockIsStudentPinLifecycleEnabled(),
  isProvisionalStudentPinActive: (credential: { kind: string; status: string; expiresAt?: Date | null } | null | undefined) =>
    mockIsProvisionalStudentPinActive(credential),
}))

const buildUser = ({
  id = "user_1",
  clerkId = "clerk_1",
  name = "Ana Garcia",
  email = "ana@example.com",
  phone = "+5491111111111",
  createdAt = new Date("2026-04-01T10:00:00.000Z"),
  purchaseName = "Ana Snapshot",
}: Partial<{
  id: string
  clerkId: string | null
  name: string | null
  email: string
  phone: string | null
  createdAt: Date
  purchaseName: string | null
}> = {}) => ({
  id,
  clerkId,
  name,
  email,
  phone,
  createdAt,
  purchases: purchaseName ? [{ name: purchaseName }] : [],
})

describe("staff students search route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockAuthorizePortalSection.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockGetUserList.mockResolvedValue({ data: [] })
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.pointsLedger.groupBy.mockResolvedValue([])
    mockPrisma.purchase.findMany.mockResolvedValue([])
    mockPrisma.packagePurchase.findMany.mockResolvedValue([])
    mockPrisma.attendance.findMany.mockResolvedValue([])
    mockPrisma.studentPinCredential.findMany.mockResolvedValue([])
    mockIsStudentPinLifecycleEnabled.mockReturnValue(true)
  })

  it("returns 400 when the request is missing both q and userId", async () => {
    const { GET } = await import("@/app/api/staff/students/search/route")
    const res = await GET(new Request("http://localhost/api/staff/students/search"))

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Missing search parameter" })
  })

  it("returns auth and rate limit errors before querying Prisma", async () => {
    const { GET } = await import("@/app/api/staff/students/search/route")

    mockAuthorizePortalSection.mockResolvedValueOnce({ ok: false, error: "Unauthorized", status: 401 })
    const unauthorizedRes = await GET(new Request("http://localhost/api/staff/students/search?q=ana"))
    expect(unauthorizedRes.status).toBe(401)
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()

    mockConsumeRateLimit.mockReturnValueOnce({ ok: false, retryAfterSec: 9 })
    const rateLimitedRes = await GET(new Request("http://localhost/api/staff/students/search?q=ana"))
    expect(rateLimitedRes.status).toBe(429)
    expect(rateLimitedRes.headers.get("Retry-After")).toBe("9")
  })

  it("returns the enriched fallback card contract from batched aggregates", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([buildUser()])
    mockPrisma.pointsLedger.groupBy.mockResolvedValueOnce([{ userId: "user_1", _sum: { points: 8 } }])
    mockPrisma.purchase.findMany
      .mockResolvedValueOnce([
        {
          id: "purchase_failed",
          userId: "user_1",
          amount: 4100,
          status: "failed",
          metadata: { paymentChannel: "cash", settlementStatus: "pending" },
          createdAt: new Date("2026-04-03T15:00:00.000Z"),
          courseTitle: "Salsa Intermediate",
          courseSlug: "salsa-intermediate",
          packageId: null,
          serviceId: "dropin_service_failed",
          stripePaymentIntentId: null,
          stripeCheckoutSessionId: null,
        },
        {
          id: "purchase_paid",
          userId: "user_1",
          amount: 2500,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-03-20T18:00:00.000Z"),
          courseTitle: "Salsa Beginners",
          courseSlug: "salsa-beginners",
          packageId: null,
          serviceId: "dropin_service_paid",
          stripePaymentIntentId: "pi_1",
          stripeCheckoutSessionId: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "today_purchase",
          userId: "user_1",
          status: "paid",
          metadata: { paymentChannel: "card", date: "2026-04-04", time: "18:00" },
          createdAt: new Date("2026-04-04T16:00:00.000Z"),
          courseSlug: "salsa-beginners",
        },
      ])
    mockPrisma.packagePurchase.findMany.mockResolvedValueOnce([
      {
        userId: "user_1",
        packageId: "pkg_old",
        packageLabel: "8 Classes",
        remainingCredits: 2,
        isUnlimited: false,
        expiresAt: new Date("2026-05-10T00:00:00.000Z"),
        lastUsedAt: new Date("2026-04-01T10:00:00.000Z"),
        purchasedAt: new Date("2026-03-01T10:00:00.000Z"),
        status: "active",
      },
      {
        userId: "user_1",
        packageId: "pkg_current",
        packageLabel: "12 Classes",
        remainingCredits: 5,
        isUnlimited: false,
        expiresAt: new Date("2026-06-01T00:00:00.000Z"),
        lastUsedAt: new Date("2026-04-04T09:00:00.000Z"),
        purchasedAt: new Date("2026-03-15T10:00:00.000Z"),
        status: "active",
      },
    ])
    mockPrisma.attendance.findMany
      .mockResolvedValueOnce([
        {
          id: "att_hist",
          userId: "user_1",
          status: "checked_out",
          checkedInAt: new Date("2026-04-02T18:00:00.000Z"),
          checkedOutAt: new Date("2026-04-02T19:00:00.000Z"),
          session: {
            courseSlug: "salsa-beginners",
            title: "Salsa Beginners",
            startsAt: new Date("2026-04-02T18:00:00.000Z"),
            location: "Palermo",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "att_today",
          userId: "user_1",
          status: "checked_in",
          checkedInAt: new Date("2026-04-04T18:03:00.000Z"),
          session: {
            courseSlug: "salsa-beginners",
            startsAt: new Date("2026-04-04T18:00:00.000Z"),
          },
        },
      ])
    mockPrisma.studentPinCredential.findMany.mockResolvedValueOnce([
      {
        userId: "user_1",
        kind: "provisional",
        status: "active",
        expiresAt: new Date("2026-04-04T23:59:00.000Z"),
      },
      {
        userId: "user_1",
        kind: "permanent",
        status: "active",
        expiresAt: null,
      },
    ])
    mockGetUserList.mockResolvedValueOnce({
      data: [
        {
          id: "clerk_1",
          firstName: "Ana Maria",
          lastName: "Garcia",
          primaryEmailAddress: { emailAddress: "ana.maria@example.com" },
          primaryPhoneNumber: { phoneNumber: "+5491199999999" },
          imageUrl: "https://img.example/ana.png",
          hasImage: true,
        },
      ],
    })

    const { GET } = await import("@/app/api/staff/students/search/route")
    const res = await GET(new Request("http://localhost/api/staff/students/search?q=ana"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.results).toHaveLength(1)
    expect(data.results[0]).toMatchObject({
      source: "profile",
      key: "user_1",
      displayName: "Ana Maria Garcia",
      email: "ana.maria@example.com",
      phone: "+5491199999999",
      avatarUrl: "https://img.example/ana.png",
      pointsBalance: 8,
      checkInStatus: "checked_in",
      paymentStatus: "failed",
      remainingCredits: 5,
      outstandingBalance: 4100,
      activePackage: {
        label: "12 Classes",
        remainingCredits: 5,
      },
      latestCheckInAt: "2026-04-02T18:00:00.000Z",
      latestClassAttended: {
        courseTitle: "Salsa Beginners",
        courseSlug: "salsa-beginners",
        location: "Palermo",
      },
      lastCourse: {
        courseTitle: "Salsa Intermediate",
        courseSlug: "salsa-intermediate",
      },
        lastPayment: {
          amountCents: 2500,
          purchaseCategory: "dropin",
          courseTitle: "Salsa Beginners",
          paymentChannel: "card",
        },
      pinStatus: "provisional",
      cashSettlement: {
        paymentId: "purchase_failed",
        settlementStatus: "pending",
        settlementNote: "",
      },
      provisionalPinExpiresAt: "2026-04-04T23:59:00.000Z",
    })
    expect(data.results[0].lastPayment.date).toBe("2026-03-20T18:00:00.000Z")
  })

  it("omits provisional pin expiry for permanent-pin users and keeps empty financial defaults explicit", async () => {
    const paymentlessUser = buildUser({
      id: "user_2",
      clerkId: null,
      name: "No Purchase",
      email: "nopurchase@example.com",
      phone: "+5491100000000",
      purchaseName: null,
    })
    mockPrisma.user.findMany.mockResolvedValueOnce([paymentlessUser]).mockResolvedValueOnce([paymentlessUser])
    mockPrisma.studentPinCredential.findMany.mockResolvedValue([
      {
        userId: "user_2",
        kind: "permanent",
        status: "active",
        expiresAt: null,
      },
    ])

    const { GET } = await import("@/app/api/staff/students/search/route")

    const emailRes = await GET(new Request("http://localhost/api/staff/students/search?q=nopurchase%40example.com"))
    const emailData = await emailRes.json()
    expect(emailRes.status).toBe(200)
    expect(emailData.results[0]).toMatchObject({
      displayName: "No Purchase",
      email: "nopurchase@example.com",
      checkInStatus: "none",
      latestClassAttended: null,
      latestCheckInAt: null,
      lastPayment: null,
      lastCourse: null,
      paymentStatus: null,
      remainingCredits: null,
      outstandingBalance: null,
      pinStatus: "enrolled",
      cashSettlement: null,
      avatarUrl: null,
    })
    expect(emailData.results[0]).not.toHaveProperty("provisionalPinExpiresAt")

    const phoneRes = await GET(new Request("http://localhost/api/staff/students/search?q=%2B5491100000000"))
    const phoneData = await phoneRes.json()
    expect(phoneRes.status).toBe(200)
    expect(phoneData.results[0]?.phone).toBe("+5491100000000")
  })

  it("keeps pending processable purchases selectable even when a newer purchase exists and ignores non package/drop-in payments for last payment", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([buildUser({ id: "user_3", clerkId: null, purchaseName: null })])
    mockPrisma.purchase.findMany
      .mockResolvedValueOnce([
        {
          id: "purchase_latest_other",
          userId: "user_3",
          amount: 9999,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-04-05T10:00:00.000Z"),
          courseTitle: "Admin adjustment",
          courseSlug: "admin-adjustment",
          packageId: null,
          serviceId: null,
          stripePaymentIntentId: "pi_other",
          stripeCheckoutSessionId: null,
        },
        {
          id: "purchase_latest_card",
          userId: "user_3",
          amount: 2800,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-04-04T10:00:00.000Z"),
          courseTitle: "Salsa Drop-in",
          courseSlug: "salsa-dropin",
          packageId: null,
          serviceId: "service_dropin_1",
          stripePaymentIntentId: "pi_card_latest",
          stripeCheckoutSessionId: null,
        },
        {
          id: "purchase_pending_cash",
          userId: "user_3",
          amount: 3500,
          status: "pending",
          metadata: { paymentChannel: "cash", settlementStatus: "pending", settlementNote: "front desk" },
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          courseTitle: "Bachata Beginners",
          courseSlug: "bachata-beginners",
          packageId: null,
          serviceId: "service_dropin_2",
          stripePaymentIntentId: null,
          stripeCheckoutSessionId: null,
        },
        {
          id: "purchase_package_paid",
          userId: "user_3",
          amount: 12000,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-04-02T10:00:00.000Z"),
          courseTitle: "10-Class Package",
          courseSlug: "multi-package",
          packageId: "pkg_10",
          serviceId: null,
          stripePaymentIntentId: "pi_package",
          stripeCheckoutSessionId: null,
        },
      ])
      .mockResolvedValueOnce([])

    const { GET } = await import("@/app/api/staff/students/search/route")
    const res = await GET(new Request("http://localhost/api/staff/students/search?q=user_3"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.results[0]).toMatchObject({
      outstandingBalance: 3500,
      cashSettlement: {
        paymentId: "purchase_pending_cash",
        settlementStatus: "pending",
        settlementNote: "front desk",
      },
      lastPayment: {
        amountCents: 2800,
        purchaseCategory: "dropin",
      },
      paymentStatus: "paid",
    })
  })

  it("ignores package credit consumption rows when resolving the last real completed payment", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([buildUser({ id: "user_4", clerkId: null, purchaseName: null })])
    mockPrisma.purchase.findMany
      .mockResolvedValueOnce([
        {
          id: "purchase_package_credit_latest",
          userId: "user_4",
          amount: 0,
          status: "paid",
          metadata: { paymentChannel: "package_credit", attendanceId: "attendance_1" },
          createdAt: new Date("2026-04-05T10:00:00.000Z"),
          courseTitle: "Salsa Beginners",
          courseSlug: "salsa-beginners",
          packageId: "pkg_12",
          serviceId: null,
          stripePaymentIntentId: null,
          stripeCheckoutSessionId: null,
        },
        {
          id: "purchase_package_paid_real",
          userId: "user_4",
          amount: 12000,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-04-03T10:00:00.000Z"),
          courseTitle: "12-Class Package",
          courseSlug: "package-12",
          packageId: "pkg_12",
          serviceId: null,
          stripePaymentIntentId: "pi_package_real",
          stripeCheckoutSessionId: null,
        },
      ])
      .mockResolvedValueOnce([])

    const { GET } = await import("@/app/api/staff/students/search/route")
    const res = await GET(new Request("http://localhost/api/staff/students/search?q=user_4"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.results[0].lastPayment).toMatchObject({
      amountCents: 12000,
      purchaseCategory: "package",
      paymentChannel: "card",
      courseTitle: "12-Class Package",
    })
    expect(data.results[0].lastPayment.date).toBe("2026-04-03T10:00:00.000Z")
  })

  it("uses metadata package linkage when the latest real completed payment is a package purchase", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([buildUser({ id: "user_metadata_pkg", clerkId: null, purchaseName: null })])
    mockPrisma.purchase.findMany
      .mockResolvedValueOnce([
        {
          id: "purchase_dropin_20",
          userId: "user_metadata_pkg",
          amount: 2000,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          courseTitle: "Open Drop-in",
          courseSlug: "open-dropin",
          packageId: null,
          serviceId: "service_dropin",
          stripePaymentIntentId: "pi_dropin_20",
          stripeCheckoutSessionId: null,
        },
        {
          id: "purchase_package_metadata",
          userId: "user_metadata_pkg",
          amount: 12000,
          status: "paid",
          metadata: { paymentChannel: "card", packageId: "pkg_metadata" },
          createdAt: new Date("2026-04-05T10:00:00.000Z"),
          courseTitle: "12-Class Package",
          courseSlug: "package-12",
          packageId: null,
          serviceId: null,
          stripePaymentIntentId: "pi_package_metadata",
          stripeCheckoutSessionId: null,
        },
      ])
      .mockResolvedValueOnce([])

    const { GET } = await import("@/app/api/staff/students/search/route")
    const res = await GET(new Request("http://localhost/api/staff/students/search?q=user_metadata_pkg"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.results[0].lastPayment).toMatchObject({
      amountCents: 12000,
      purchaseCategory: "package",
      paymentChannel: "card",
      courseTitle: "12-Class Package",
    })
    expect(data.results[0].lastPayment.date).toBe("2026-04-05T10:00:00.000Z")
  })

  it("uses linked package purchases when the latest paid package row has no packageId on Purchase", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([buildUser({ id: "user_linked_pkg", clerkId: null, purchaseName: null })])
    mockPrisma.purchase.findMany
      .mockResolvedValueOnce([
        {
          id: "purchase_dropin_20",
          userId: "user_linked_pkg",
          amount: 2000,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          courseTitle: "Open Drop-in",
          courseSlug: "open-dropin",
          packageId: null,
          serviceId: "service_dropin",
          packagePurchases: [],
          stripePaymentIntentId: "pi_dropin_20",
          stripeCheckoutSessionId: null,
        },
        {
          id: "purchase_package_linked",
          userId: "user_linked_pkg",
          amount: 12000,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-04-05T10:00:00.000Z"),
          courseTitle: "12-Class Package",
          courseSlug: "package-12",
          packageId: null,
          serviceId: null,
          packagePurchases: [{ packageId: "pkg_linked" }],
          stripePaymentIntentId: "pi_package_linked",
          stripeCheckoutSessionId: null,
        },
      ])
      .mockResolvedValueOnce([])

    const { GET } = await import("@/app/api/staff/students/search/route")
    const res = await GET(new Request("http://localhost/api/staff/students/search?q=user_linked_pkg"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.results[0].lastPayment).toMatchObject({
      amountCents: 12000,
      purchaseCategory: "package",
      paymentChannel: "card",
      courseTitle: "12-Class Package",
    })
    expect(data.results[0].lastPayment.date).toBe("2026-04-05T10:00:00.000Z")
  })

  it("prefers the newest completed payment even when Prisma returns mixed ordering", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([buildUser({ id: "user_latest", clerkId: null, purchaseName: null })])
    mockPrisma.purchase.findMany
      .mockResolvedValueOnce([
        {
          id: "purchase_dropin_old",
          userId: "user_latest",
          amount: 2000,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          courseTitle: "Open Drop-in",
          courseSlug: "dropin",
          packageId: null,
          serviceId: "service_dropin",
          stripePaymentIntentId: "pi_dropin_old",
          stripeCheckoutSessionId: null,
        },
        {
          id: "purchase_package_new",
          userId: "user_latest",
          amount: 15000,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-04-05T10:00:00.000Z"),
          courseTitle: "Spring Package",
          courseSlug: "spring-package",
          packageId: "pkg_spring",
          serviceId: null,
          stripePaymentIntentId: "pi_package_new",
          stripeCheckoutSessionId: null,
        },
      ])
      .mockResolvedValueOnce([])

    const { GET } = await import("@/app/api/staff/students/search/route")
    const res = await GET(new Request("http://localhost/api/staff/students/search?q=user_latest"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.results[0].lastPayment).toMatchObject({
      amountCents: 15000,
      purchaseCategory: "package",
      courseTitle: "Spring Package",
    })
  })

  it("keeps unsettled cash balances out of last payment when a real package purchase exists", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([buildUser({ id: "user_cash_outstanding", clerkId: null, purchaseName: null })])
    mockPrisma.purchase.findMany
      .mockResolvedValueOnce([
        {
          id: "purchase_cash_unsettled_20",
          userId: "user_cash_outstanding",
          amount: 2000,
          status: "paid",
          metadata: { paymentChannel: "cash", settlementStatus: "pending", settlementNote: "front desk" },
          createdAt: new Date("2026-04-06T10:00:00.000Z"),
          courseTitle: "Single Class",
          courseSlug: "single-class",
          packageId: null,
          serviceId: "service_dropin_cash",
          stripePaymentIntentId: null,
          stripeCheckoutSessionId: null,
        },
        {
          id: "purchase_package_real",
          userId: "user_cash_outstanding",
          amount: 12000,
          status: "paid",
          metadata: { paymentChannel: "card" },
          createdAt: new Date("2026-04-02T10:00:00.000Z"),
          courseTitle: "12-Class Package",
          courseSlug: "package-12",
          packageId: "pkg_12",
          serviceId: null,
          stripePaymentIntentId: "pi_package_real_last_payment",
          stripeCheckoutSessionId: null,
        },
      ])
      .mockResolvedValueOnce([])

    const { GET } = await import("@/app/api/staff/students/search/route")
    const res = await GET(new Request("http://localhost/api/staff/students/search?q=user_cash_outstanding"))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.results[0]).toMatchObject({
      outstandingBalance: 2000,
      cashSettlement: {
        paymentId: "purchase_cash_unsettled_20",
        settlementStatus: "pending",
        settlementNote: "front desk",
      },
      lastPayment: {
        amountCents: 12000,
        purchaseCategory: "package",
        paymentChannel: "card",
        courseTitle: "12-Class Package",
      },
    })
    expect(data.results[0].lastPayment.date).toBe("2026-04-02T10:00:00.000Z")
  })

  it("returns empty results for misses and direct lookup for userId", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([])
    mockPrisma.user.findUnique.mockResolvedValueOnce(buildUser({ id: "user_direct" }))

    const { GET } = await import("@/app/api/staff/students/search/route")

    const missRes = await GET(new Request("http://localhost/api/staff/students/search?q=missing"))
    await expect(missRes.json()).resolves.toEqual({ results: [] })

    const directRes = await GET(new Request("http://localhost/api/staff/students/search?userId=user_direct"))
    const directData = await directRes.json()
    expect(directRes.status).toBe(200)
    expect(directData.results[0]?.userId).toBe("user_direct")
  })
})
