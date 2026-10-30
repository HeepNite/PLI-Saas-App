import { beforeEach, describe, expect, it, vi } from "vitest"
import { STAFF_TERMINAL_LATENCY_TARGETS_MS } from "@/lib/checkin/kiosk-qr-payment"
import { createKioskQrCashGrant } from "@/lib/checkin/kiosk-qr-cash-grant"

const mockValidate = vi.fn()
const mockResolveCheckoutPreparation = vi.fn()
const mockEnforceNewStudent = vi.fn()
const mockEnrollStudentPin = vi.fn()
const mockUpsertUser = vi.fn()
const mockClearPreparedCheckout = vi.fn()
const mockPurchaseFindFirst = vi.fn()
const mockPurchaseCreate = vi.fn()
const mockFindHeritagePinEntitlement = vi.fn()
const mockAuthorizeStaffTerminalSession = vi.fn()
const mockListCheckoutSessions = vi.fn()
const mockExpireCheckoutSession = vi.fn()

const stripeList = (sessions: unknown[], failAfter?: Error) => ({
  async *[Symbol.asyncIterator]() {
    for (const session of sessions) yield session
    if (failAfter) throw failAfter
  },
})

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_cash_route"

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = {
      sessions: {
        list: (...args: unknown[]) => mockListCheckoutSessions(...args),
        expire: (...args: unknown[]) => mockExpireCheckoutSession(...args),
      },
    }
    constructor() {}
  },
}))

const mockDayOfWeekFindUnique = vi.fn()
const mockDayOfWeekCreate = vi.fn()
const mockDayOfWeekUpdate = vi.fn()
const mockDayOfWeekUpsert = vi.fn()

const mockPrisma = {
  purchase: {
    findFirst: mockPurchaseFindFirst,
    create: mockPurchaseCreate,
  },
  dayOfWeekPurchaseCount: {
    findUnique: mockDayOfWeekFindUnique,
    create: mockDayOfWeekCreate,
    update: mockDayOfWeekUpdate,
    upsert: mockDayOfWeekUpsert,
  },
  $transaction: vi.fn(async (callback: (tx: { purchase: { create: typeof mockPurchaseCreate }, dayOfWeekPurchaseCount: { findUnique: typeof mockDayOfWeekFindUnique, create: typeof mockDayOfWeekCreate, update: typeof mockDayOfWeekUpdate, upsert: typeof mockDayOfWeekUpsert } }) => unknown) =>
    callback({ purchase: { create: mockPurchaseCreate }, dayOfWeekPurchaseCount: { findUnique: mockDayOfWeekFindUnique, create: mockDayOfWeekCreate, update: mockDayOfWeekUpdate, upsert: mockDayOfWeekUpsert } })
  ),
}

vi.mock("@/lib/checkout", () => ({
  resolveCheckoutPreparation: (...args: unknown[]) => mockResolveCheckoutPreparation(...args),
  enforceNewStudentRules: (...args: unknown[]) => mockEnforceNewStudent(...args),
  enrollStudentPinForCheckout: (...args: unknown[]) => mockEnrollStudentPin(...args),
  clearPreparedCheckoutAfterSuccess: (...args: unknown[]) => mockClearPreparedCheckout(...args),
}))

vi.mock("@/lib/checkout/validation", () => ({
  validateCheckoutPayload: (...args: unknown[]) => mockValidate(...args),
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/campaigns/heritage-pin-entitlement", () => ({
  findHeritagePinEntitlementForUser: (...args: unknown[]) => mockFindHeritagePinEntitlement(...args),
}))

describe("checkout cash route", () => {
  beforeEach(() => {
    mockValidate.mockReset()
    mockResolveCheckoutPreparation.mockReset()
    mockEnforceNewStudent.mockReset()
    mockEnrollStudentPin.mockReset()
    mockUpsertUser.mockReset()
    mockPrisma.purchase.findFirst.mockReset()
    mockPrisma.purchase.create.mockReset()
    mockFindHeritagePinEntitlement.mockReset()
    mockFindHeritagePinEntitlement.mockResolvedValue(null)
    mockAuthorizeStaffTerminalSession.mockReset()
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing_session" })
    mockPrisma.$transaction.mockClear()
    mockDayOfWeekFindUnique.mockReset()
    mockDayOfWeekCreate.mockReset()
    mockDayOfWeekUpdate.mockReset()
    mockDayOfWeekUpsert.mockReset()
    mockDayOfWeekFindUnique.mockResolvedValue(null)
    mockClearPreparedCheckout.mockReset()
    mockListCheckoutSessions.mockReset()
    mockListCheckoutSessions.mockImplementation(() => stripeList([]))
    mockExpireCheckoutSession.mockReset()

    mockValidate.mockResolvedValue({
      courseSlug: "salsa-feminine-morning",
      courseTitle: "Salsa feminine style (morning)",
      amountInt: 2000,
      currency: "usd",
      date: "2026-02-10",
      time: "11:00",
      packageId: "",
      serviceId: "dropin",
      addons: [],
      safeParticipants: 1,
      coupon: "",
      packageTotalCredits: null,
      packageIsUnlimited: false,
      packageCadence: "",
      packageMakeUps: 0,
      packageValidDays: 180,
      pkg: null,
    })
    mockResolveCheckoutPreparation.mockResolvedValue({
      source: "prepared",
      terminalAuth: {
        ok: true,
        sessionId: "terminal_session_1",
        terminal: {
          id: "terminal_1",
          slug: "terminal-1",
          name: "Terminal 1",
          location: null,
          defaultCourseSlug: null,
          active: true,
        },
      },
      verification: { hasVerifiedPhone: true },
      preparedAccount: {
        userId: "user_123",
        clerkUser: null,
        resolvedUserId: "user_123",
        identity: {
          resolvedEmail: "test@example.com",
          phoneRaw: "+1 9293876584",
          phoneNormalized: "9293876584",
        },
        account: {
          clerkUserId: "user_123",
          created: false,
          requiresSignIn: false,
          hasAvatar: false,
        },
      },
    })
    mockEnforceNewStudent.mockResolvedValue(null)
    mockEnrollStudentPin.mockResolvedValue({ ok: true, dbUserId: null })
    mockUpsertUser.mockResolvedValue({ id: "db_user_1" })
    mockPrisma.purchase.findFirst.mockResolvedValue(null)
    mockPrisma.purchase.create.mockResolvedValue({
      id: "purchase_1",
      status: "pending",
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
    })
  })

  it("creates a cash purchase for a trusted kiosk request", async () => {
    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal" }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({
      ok: true,
      purchaseId: "purchase_1",
      paymentMethod: "onsite",
      paymentStatus: "pending",
      account: {
        clerkUserId: "user_123",
        hasAvatar: false,
      },
    })
    expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.purchase.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        status: "pending",
        metadata: {
          settlementStatus: "pending",
          settledAt: null,
        },
      },
    })
  })

  it("rejects public cash before validation, account preparation, or checkout side effects", async () => {
    const { POST } = await import("@/app/api/checkout/cash/route")
    const response = await POST(new Request("http://localhost/api/checkout/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoContext: "external_web", bookingSource: "public_booking", checkoutKind: "special-salsa-class", specialClassId: "special_class_1" }),
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Cash payment is available only from a studio terminal." })
    expect(mockValidate).not.toHaveBeenCalled()
    expect(mockResolveCheckoutPreparation).not.toHaveBeenCalled()
    expect(mockUpsertUser).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("accepts pending cash from a context-matched kiosk QR grant without terminal cookies", async () => {
    const kioskQrCashGrant = createKioskQrCashGrant({
      terminalId: "terminal_1",
      courseSlug: "salsa-feminine-morning",
      date: "2026-02-10",
      time: "11:00",
    })
    mockResolveCheckoutPreparation.mockResolvedValueOnce({
      source: "fallback",
      terminalAuth: null,
      verification: { hasVerifiedPhone: true },
      preparedAccount: {
        userId: "user_123",
        clerkUser: null,
        resolvedUserId: "user_123",
        identity: { resolvedEmail: "test@example.com", phoneRaw: "+1 9293876584", phoneNormalized: "9293876584" },
        account: { clerkUserId: "user_123", created: false, requiresSignIn: false, hasAvatar: false },
      },
    })
    const { POST } = await import("@/app/api/checkout/cash/route")
    const response = await POST(new Request("http://localhost/api/checkout/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoContext: "qr_phone",
        courseSlug: "salsa-feminine-morning",
        date: "2026-02-10",
        time: "11:00",
        kioskQrCashGrant,
      }),
    }))

    expect(response.status).toBe(200)
    expect(mockAuthorizeStaffTerminalSession).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        status: "pending",
        metadata: { paymentChannel: "cash", settlementStatus: "pending", purchaseSource: "kiosk" },
      },
    })
  })

  it.each([
    { body: { photoContext: "qr_phone" }, label: "missing grant" },
    { body: { photoContext: "qr_phone", kioskQrCashGrant: "tampered" }, label: "tampered grant" },
    {
      body: {
        photoContext: "qr_phone",
        bookingSource: "public_booking",
        kioskQrCashGrant: createKioskQrCashGrant({
          terminalId: "terminal_1",
          courseSlug: "salsa-feminine-morning",
          date: "2026-02-10",
          time: "11:00",
        }),
      },
      label: "public booking with a valid kiosk grant",
    },
  ])("rejects QR-phone cash with $label before side effects", async ({ body }) => {
    const { POST } = await import("@/app/api/checkout/cash/route")
    const response = await POST(new Request("http://localhost/api/checkout/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug: "salsa-feminine-morning",
        date: "2026-02-10",
        time: "11:00",
        ...body,
      }),
    }))

    expect(response.status).toBe(403)
    expect(mockValidate).not.toHaveBeenCalled()
    expect(mockResolveCheckoutPreparation).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("fails closed for a null JSON request before validation or side effects", async () => {
    const { POST } = await import("@/app/api/checkout/cash/route")
    const response = await POST(new Request("http://localhost/api/checkout/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    }))

    expect(response.status).toBe(403)
    expect(mockValidate).not.toHaveBeenCalled()
    expect(mockResolveCheckoutPreparation).not.toHaveBeenCalled()
    expect(mockUpsertUser).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("rejects a valid kiosk grant used for a different class context", async () => {
    const kioskQrCashGrant = createKioskQrCashGrant({
      terminalId: "terminal_1",
      courseSlug: "different-class",
      date: "2026-02-10",
      time: "11:00",
    })
    const { POST } = await import("@/app/api/checkout/cash/route")
    const response = await POST(new Request("http://localhost/api/checkout/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoContext: "qr_phone",
        courseSlug: "salsa-feminine-morning",
        date: "2026-02-10",
        time: "11:00",
        kioskQrCashGrant,
      }),
    }))

    expect(response.status).toBe(403)
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("rejects special-class fields from a QR-phone cash request", async () => {
    const kioskQrCashGrant = createKioskQrCashGrant({
      terminalId: "terminal_1",
      courseSlug: "salsa-feminine-morning",
      date: "2026-02-10",
      time: "11:00",
    })
    const { POST } = await import("@/app/api/checkout/cash/route")
    const response = await POST(new Request("http://localhost/api/checkout/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoContext: "qr_phone",
        courseSlug: "salsa-feminine-morning",
        date: "2026-02-10",
        time: "11:00",
        kioskQrCashGrant,
        checkoutKind: "special-salsa-class",
        specialClassId: "special_1",
      }),
    }))

    expect(response.status).toBe(403)
    expect(mockValidate).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("rejects kiosk cash when no authorized terminal session was resolved", async () => {
    mockResolveCheckoutPreparation.mockResolvedValueOnce({
      source: "fallback",
      terminalAuth: null,
      verification: { hasVerifiedPhone: true },
      preparedAccount: {
        userId: "user_123",
        clerkUser: null,
        resolvedUserId: "user_123",
        identity: { resolvedEmail: "test@example.com", phoneRaw: "+1 9293876584", phoneNormalized: "9293876584" },
        account: { clerkUserId: "user_123", created: false, requiresSignIn: false, hasAvatar: false },
      },
    })
    const { POST } = await import("@/app/api/checkout/cash/route")
    const response = await POST(new Request("http://localhost/api/checkout/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoContext: "kiosk_terminal" }),
    }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("authorized studio terminal") })
    expect(mockUpsertUser).not.toHaveBeenCalled()
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("does not trust a caller-provided kiosk context without a valid terminal session", async () => {
    mockResolveCheckoutPreparation.mockResolvedValueOnce({
      source: "fallback",
      terminalAuth: null,
      verification: { hasVerifiedPhone: true },
      preparedAccount: {
        userId: "user_123",
        clerkUser: null,
        resolvedUserId: "user_123",
        identity: { resolvedEmail: "test@example.com", phoneRaw: "+1 9293876584", phoneNormalized: "9293876584" },
        account: { clerkUserId: "user_123", created: false, requiresSignIn: false, hasAvatar: false },
      },
    })
    const { POST } = await import("@/app/api/checkout/cash/route")
    const response = await POST(new Request("http://localhost/api/checkout/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoContext: "kiosk_terminal" }),
    }))

    expect(response.status).toBe(403)
    expect(mockAuthorizeStaffTerminalSession).toHaveBeenCalledTimes(1)
    expect(mockUpsertUser).not.toHaveBeenCalled()
  })

  it("keeps trusted-kiosk regular pricing independent from delivered Heritage pin state", async () => {
    mockValidate.mockResolvedValueOnce({
      courseSlug: "salsa-feminine-morning",
      courseTitle: "Salsa feminine style (morning)",
      amountInt: 2000,
      currency: "usd",
      date: "2026-10-04",
      time: "11:00",
      packageId: "",
      serviceId: "dropin",
      addons: [],
      safeParticipants: 1,
      coupon: "",
      packageTotalCredits: null,
      packageIsUnlimited: false,
      packageCadence: "",
      packageMakeUps: 0,
      packageValidDays: 180,
      pkg: null,
      consecutivePriceCents: null,
      consecutiveLinkedCourseSlug: null,
      consecutiveCourseTitle: null,
      consecutiveLinkedCourseTime: null,
      consecutiveAddOnOnly: false,
      linkedFromCourseSlug: null,
    })
    mockFindHeritagePinEntitlement.mockResolvedValueOnce({
      campaign: "latin-heritage-2026",
      sourcePurchaseId: "pin_purchase_1",
      countryCode: "CO",
      countryName: "Colombia",
      status: "delivered",
      earnedAt: "2026-10-01T12:00:00.000Z",
      deliveredAt: "2026-10-02T12:00:00.000Z",
      deliveredBy: "staff_1",
      source: "public_booking",
    })

    const { POST } = await import("@/app/api/checkout/cash/route")
    const response = await POST(new Request("http://localhost/api/checkout/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }),
    }))

    expect(response.status).toBe(200)
    const purchase = mockPrisma.purchase.create.mock.calls.at(-1)?.[0]?.data
    expect(purchase?.amount).toBe(2000)
    expect(purchase?.metadata).not.toHaveProperty("heritagePinPriceApplied")
    expect(purchase?.metadata).not.toHaveProperty("heritagePinEntitlementPurchaseId")
  })


  it("stamps the sale day on a package bought without a class", async () => {
    mockValidate.mockResolvedValue({
      courseSlug: "",
      courseTitle: "",
      amountInt: 15200,
      currency: "usd",
      date: "",
      time: "",
      packageId: "pkg_8class",
      serviceId: "",
      addons: [],
      safeParticipants: 1,
      coupon: "",
      packageTotalCredits: 8,
      packageIsUnlimited: false,
      packageCadence: "twice_per_week",
      packageMakeUps: 0,
      packageValidDays: 60,
      pkg: { label: "Twice per week" },
    })
    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1)
    const metadata = mockPrisma.purchase.create.mock.calls[0]?.[0]?.data?.metadata as Record<string, unknown>
    expect(metadata.packageId).toBe("pkg_8class")
    expect(metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("passes kiosk photo context to account preparation", async () => {
    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockResolveCheckoutPreparation).toHaveBeenCalledWith(
      expect.any(Request),
      expect.any(Object),
      expect.objectContaining({
        photoContext: "kiosk_terminal",
        allowExistingAccountLookup: true,
      })
    )
  })

  it("returns ACCOUNT_EXISTS when account preparation is blocked", async () => {
    mockResolveCheckoutPreparation.mockResolvedValue({
      status: 409,
      error: "Account already exists. Please sign in to continue.",
      code: "ACCOUNT_EXISTS",
    })

    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal" }),
      })
    )

    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.code).toBe("ACCOUNT_EXISTS")
    expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
  })

  it("clears prepared context after cash purchase success", async () => {
    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockClearPreparedCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        kioskSessionToken: "kiosk_session_1",
        terminalAuth: expect.objectContaining({ ok: true }),
      })
    )
  })

  it("falls back silently when prepared context is class-mismatched", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    mockResolveCheckoutPreparation.mockResolvedValueOnce({
      source: "fallback",
      fallbackReason: "class_slot_mismatch",
      terminalAuth: {
        ok: true,
        sessionId: "terminal_session_1",
        terminal: {
          id: "terminal_1",
          slug: "terminal-1",
          name: "Terminal 1",
          location: null,
          defaultCourseSlug: null,
          active: true,
        },
      },
      verification: { hasVerifiedPhone: true },
      preparedAccount: {
        userId: "user_123",
        clerkUser: null,
        resolvedUserId: "user_123",
        identity: {
          resolvedEmail: "test@example.com",
          phoneRaw: "+1 9293876584",
          phoneNormalized: "9293876584",
        },
        account: {
          clerkUserId: "user_123",
          created: false,
          requiresSignIn: false,
          hasAvatar: false,
        },
      },
    })

    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }),
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: true, purchaseId: "purchase_1" })
    expect(consoleInfo).toHaveBeenCalledWith(
      "[staff-terminal-checkout-latency] checkout-cash",
      expect.objectContaining({
        segment: "cash_next_step",
        source: "fallback",
        fallbackReason: "class_slot_mismatch",
      })
    )

    consoleInfo.mockRestore()
  })

  it("creates primary and consecutive cash purchases when consecutive checkout data is present", async () => {
    mockValidate.mockResolvedValueOnce({
      courseSlug: "salsa-feminine-morning",
      courseTitle: "Salsa feminine style (morning)",
      amountInt: 2900,
      currency: "usd",
      date: "2026-02-10",
      time: "11:00",
      packageId: "",
      serviceId: "dropin",
      addons: [],
      safeParticipants: 1,
      coupon: "",
      packageTotalCredits: null,
      packageIsUnlimited: false,
      packageCadence: "",
      packageMakeUps: 0,
      packageValidDays: 180,
      pkg: null,
      consecutivePriceCents: 900,
      consecutiveLinkedCourseSlug: "bachata",
      consecutiveCourseTitle: "Bachata Basics",
      consecutiveLinkedCourseTime: "23:00",
    })
    mockPrisma.purchase.create
      .mockResolvedValueOnce({
        id: "purchase_primary",
        status: "pending",
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "purchase_consecutive",
        status: "pending",
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
      })

    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal" }),
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      purchaseId: "purchase_primary",
      consecutivePurchaseId: "purchase_consecutive",
    })
    expect(mockPrisma.purchase.findFirst).toHaveBeenCalled()
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2)
    expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.purchase.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        courseSlug: "salsa-feminine-morning",
        amount: 2000,
        metadata: {
          hasConsecutiveLinkedPurchase: true,
          consecutiveLinkedSlug: "bachata",
        },
      },
    })
    expect(mockPrisma.purchase.create.mock.calls[1]?.[0]).toMatchObject({
      data: {
        courseSlug: "bachata",
        courseTitle: "Bachata Basics",
        amount: 900,
        participants: 1,
        metadata: {
          date: "2026-02-10",
          time: "23:00",
        },
      },
    })
    expect(mockPrisma.purchase.create.mock.calls[1]?.[0]).toMatchObject({
      data: {
        metadata: {
          consecutiveLinkedFrom: "salsa-feminine-morning",
          consecutiveDiscount: true,
          parentPurchaseId: "purchase_primary",
        },
      },
    })
  })

  it("uses authoritative kiosk current-course date for parent and consecutive purchases", async () => {
    mockValidate.mockResolvedValueOnce({
      courseSlug: "salsa-timba-ny",
      courseTitle: "Salsa timba in New York",
      amountInt: 2900,
      currency: "usd",
      date: "2026-05-13",
      time: "22:00",
      packageId: "",
      serviceId: "dropin",
      addons: [],
      safeParticipants: 1,
      coupon: "",
      packageTotalCredits: null,
      packageIsUnlimited: false,
      packageCadence: "",
      packageMakeUps: 0,
      packageValidDays: 180,
      pkg: null,
      consecutivePriceCents: 900,
      consecutiveLinkedCourseSlug: "bachata-basics",
      consecutiveCourseTitle: "Bachata Basics",
      consecutiveLinkedCourseTime: "23:00",
      kioskCurrentCourseDate: "2026-05-06",
      kioskCurrentCourseTime: "22:00",
    })
    mockPrisma.purchase.create
      .mockResolvedValueOnce({
        id: "purchase_primary",
        status: "pending",
        createdAt: new Date("2026-05-06T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "purchase_consecutive",
        status: "pending",
        createdAt: new Date("2026-05-06T00:00:00.000Z"),
      })

    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoContext: "kiosk_terminal",
          flowContext: "kiosk_terminal",
          kioskCurrentCourseDate: "2026-05-06",
          kioskCurrentCourseTime: "22:00",
        }),
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      purchaseId: "purchase_primary",
      consecutivePurchaseId: "purchase_consecutive",
    })

    expect(mockPrisma.purchase.create.mock.calls[0]?.[0]).toMatchObject({
      data: {
        metadata: {
          date: "2026-05-06",
          time: "22:00",
        },
      },
    })
    expect(mockPrisma.purchase.create.mock.calls[1]?.[0]).toMatchObject({
      data: {
        metadata: {
          date: "2026-05-06",
          time: "23:00",
        },
      },
    })
  })

  it("logs cash next-step latency within target", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    const dateNow = vi.spyOn(Date, "now")
      .mockReturnValueOnce(5_000)
      .mockReturnValueOnce(5_700)

    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal", kioskSessionToken: "kiosk_session_1" }),
      })
    )

    expect(res.status).toBe(200)
    expect(consoleInfo).toHaveBeenCalledWith(
      "[staff-terminal-checkout-latency] checkout-cash",
      expect.objectContaining({
        segment: "cash_next_step",
        durationMs: 700,
      })
    )
    expect(700).toBeLessThanOrEqual(STAFF_TERMINAL_LATENCY_TARGETS_MS.cashNextStep)

    consoleInfo.mockRestore()
    dateNow.mockRestore()
  })

  describe("kiosk QR cash after a cancelled Stripe checkout", () => {
    const grant = () => createKioskQrCashGrant({
      terminalId: "terminal_1",
      courseSlug: "salsa-feminine-morning",
      date: "2026-02-10",
      time: "11:00",
    })
    const stripeSession = (id: string, overrides: Record<string, unknown> = {}, metadata: Record<string, string> = {}) => ({
      id,
      status: "open",
      payment_status: "unpaid",
      customer_email: "test@example.com",
      customer_details: null,
      metadata: {
        courseSlug: "salsa-feminine-morning",
        date: "2026-02-10",
        time: "11:00",
        email: "test@example.com",
        userId: "user_123",
        flowContext: "qr_phone",
        ...metadata,
      },
      ...overrides,
    })
    const postQrCash = async (extra: Record<string, unknown> = {}) => {
      mockResolveCheckoutPreparation.mockResolvedValueOnce({
        source: "fallback",
        terminalAuth: null,
        verification: { hasVerifiedPhone: true },
        preparedAccount: {
          userId: "user_123",
          clerkUser: null,
          resolvedUserId: "user_123",
          identity: { resolvedEmail: "test@example.com", phoneRaw: "+1 9293876584", phoneNormalized: "9293876584" },
          account: { clerkUserId: "user_123", created: false, requiresSignIn: false, hasAvatar: false },
        },
      })
      const { POST } = await import("@/app/api/checkout/cash/route")
      return POST(new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoContext: "qr_phone",
          courseSlug: "salsa-feminine-morning",
          date: "2026-02-10",
          time: "11:00",
          kioskQrCashGrant: grant(),
          ...extra,
        }),
      }))
    }

    beforeEach(() => {
      mockExpireCheckoutSession.mockImplementation(async (id: string) => ({ id, status: "expired" }))
    })

    it("looks up the last 24h of checkout sessions and records cash when none match", async () => {
      const response = await postQrCash()

      expect(response.status).toBe(200)
      const params = mockListCheckoutSessions.mock.calls[0]?.[0] as { created: { gte: number }; limit: number }
      expect(params.limit).toBe(100)
      expect(Math.floor(Date.now() / 1000) - params.created.gte).toBeGreaterThanOrEqual(24 * 60 * 60 - 5)
      expect(mockExpireCheckoutSession).not.toHaveBeenCalled()
      expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1)
    })

    it("expires every open session for this booking before recording cash", async () => {
      mockListCheckoutSessions.mockImplementation(() => stripeList([
        stripeSession("cs_test_open_1"),
        stripeSession("cs_test_old", { status: "expired" }),
        stripeSession("cs_test_open_2", { customer_email: null }, { email: "" }),
      ]))
      const response = await postQrCash()

      expect(response.status).toBe(200)
      expect(mockExpireCheckoutSession.mock.calls.map(([id]) => id)).toEqual(["cs_test_open_1", "cs_test_open_2"])
      expect(mockExpireCheckoutSession.mock.invocationCallOrder.at(-1)).toBeLessThan(
        mockPrisma.purchase.create.mock.invocationCallOrder[0],
      )
      expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1)
    })

    it("matches a session by Stripe customer_details email when metadata identity differs", async () => {
      mockListCheckoutSessions.mockImplementation(() => stripeList([
        stripeSession("cs_test_paid", { status: "complete", payment_status: "paid", customer_email: null, customer_details: { email: "TEST@example.com" } }, { email: "", userId: "guest" }),
      ]))
      const response = await postQrCash()

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toMatchObject({ code: "ALREADY_PAID_BY_CARD" })
    })

    it.each([
      ["complete", { status: "complete", payment_status: "paid" }],
      ["paid but still marked open", { status: "open", payment_status: "paid" }],
      ["complete without paid flag", { status: "complete", payment_status: "unpaid" }],
    ])("refuses cash when a card checkout for this booking is %s", async (_label, overrides) => {
      mockListCheckoutSessions.mockImplementation(() => stripeList([
        stripeSession("cs_test_open"),
        stripeSession("cs_test_paid", overrides),
      ]))
      const response = await postQrCash()

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toMatchObject({ code: "ALREADY_PAID_BY_CARD" })
      expect(mockExpireCheckoutSession).not.toHaveBeenCalled()
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
    })

    it.each([
      ["another class", { courseSlug: "different-class" }],
      ["another time", { time: "19:00" }],
      ["another date", { date: "2026-02-11" }],
      ["another student", { email: "other@example.com", userId: "user_other" }],
      ["a non-QR flow", { flowContext: "kiosk_terminal" }],
    ])("ignores a paid session that belongs to %s", async (_label, metadata) => {
      mockListCheckoutSessions.mockImplementation(() => stripeList([
        stripeSession("cs_test_other", { status: "complete", payment_status: "paid", customer_email: "other@example.com" }, metadata),
      ]))
      const response = await postQrCash()

      expect(response.status).toBe(200)
      expect(mockExpireCheckoutSession).not.toHaveBeenCalled()
      expect(mockPrisma.purchase.create).toHaveBeenCalledTimes(1)
    })

    it.each([
      ["list throws", () => mockListCheckoutSessions.mockImplementation(() => { throw new Error("stripe down") })],
      ["pagination fails", () => mockListCheckoutSessions.mockImplementation(() => stripeList([], new Error("stripe down")))],
      ["expire fails", () => {
        mockListCheckoutSessions.mockImplementation(() => stripeList([stripeSession("cs_test_open")]))
        mockExpireCheckoutSession.mockRejectedValue(new Error("session already completed"))
      }],
      ["expire does not expire", () => {
        mockListCheckoutSessions.mockImplementation(() => stripeList([stripeSession("cs_test_open")]))
        mockExpireCheckoutSession.mockResolvedValue({ id: "cs_test_open", status: "complete" })
      }],
    ])("fails closed when Stripe %s", async (_label, arrange) => {
      arrange()
      const response = await postQrCash()

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toMatchObject({ code: "CARD_CHECKOUT_UNVERIFIED" })
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
    })

    it("does not query Stripe for trusted kiosk terminal cash", async () => {
      const { POST } = await import("@/app/api/checkout/cash/route")
      const response = await POST(new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoContext: "kiosk_terminal" }),
      }))

      expect(response.status).toBe(200)
      expect(mockListCheckoutSessions).not.toHaveBeenCalled()
    })

    it("still refuses public booking cash before any Stripe lookup", async () => {
      const { POST } = await import("@/app/api/checkout/cash/route")
      const response = await POST(new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoContext: "qr_phone",
          bookingSource: "public_booking",
          courseSlug: "salsa-feminine-morning",
          date: "2026-02-10",
          time: "11:00",
          kioskQrCashGrant: grant(),
        }),
      }))

      expect(response.status).toBe(403)
      expect(mockListCheckoutSessions).not.toHaveBeenCalled()
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled()
    })
  })
})
