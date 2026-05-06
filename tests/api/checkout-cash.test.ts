import { beforeEach, describe, expect, it, vi } from "vitest"
import { STAFF_TERMINAL_LATENCY_TARGETS_MS } from "@/lib/checkin/kiosk-qr-payment"

const mockValidate = vi.fn()
const mockResolveCheckoutPreparation = vi.fn()
const mockEnforceNewStudent = vi.fn()
const mockEnrollStudentPin = vi.fn()
const mockUpsertUser = vi.fn()
const mockClearPreparedCheckout = vi.fn()
const mockPurchaseFindFirst = vi.fn()
const mockPurchaseCreate = vi.fn()

const mockPrisma = {
  purchase: {
    findFirst: mockPurchaseFindFirst,
    create: mockPurchaseCreate,
  },
  $transaction: vi.fn(async (callback: (tx: { purchase: { create: typeof mockPurchaseCreate } }) => unknown) =>
    callback({ purchase: { create: mockPurchaseCreate } })
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

describe("checkout cash route", () => {
  beforeEach(() => {
    mockValidate.mockReset()
    mockResolveCheckoutPreparation.mockReset()
    mockEnforceNewStudent.mockReset()
    mockEnrollStudentPin.mockReset()
    mockUpsertUser.mockReset()
    mockPrisma.purchase.findFirst.mockReset()
    mockPrisma.purchase.create.mockReset()
    mockPrisma.$transaction.mockClear()
    mockClearPreparedCheckout.mockReset()

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

  it("creates a cash purchase for valid request", async () => {
    const { POST } = await import("@/app/api/checkout/cash/route")
    const res = await POST(
      new Request("http://localhost/api/checkout/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
        body: JSON.stringify({}),
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
        body: JSON.stringify({}),
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      purchaseId: "purchase_primary",
      consecutivePurchaseId: "purchase_consecutive",
    })
    expect(mockPrisma.purchase.findFirst).toHaveBeenCalled()
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
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
          consecutiveLinkedFrom: "salsa-feminine-morning",
          consecutiveDiscount: true,
          parentPurchaseId: "purchase_primary",
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
})
