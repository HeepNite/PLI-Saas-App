import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerRequest = vi.fn()
const mockAuthorizeStaffPortalRequest = vi.fn()
const mockClerkClient = vi.fn()
const mockClerkGetUser = vi.fn()
const mockWritePayrollAudit = vi.fn()

const mockPrisma = {
  currency: { findUnique: vi.fn() },
  staffPaymentMethod: { findFirst: vi.fn(), findMany: vi.fn() },
  staffPaymentModel: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  staffAccount: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerRequest: (...args: unknown[]) => mockAuthorizeOwnerRequest(...args),
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizeStaffPortalRequest(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/payroll/audit", () => ({
  writePayrollAudit: (...args: unknown[]) => mockWritePayrollAudit(...args),
}))

vi.mock("@/lib/payroll/types", () => ({
  AUDIT_ENTRY_TYPES: { MODEL_ASSIGNED: "MODEL_ASSIGNED" },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("payment models auth gates", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockClerkClient.mockResolvedValue({
      users: {
        getUser: mockClerkGetUser.mockResolvedValue({ publicMetadata: { schoolId: "school_1" }, privateMetadata: {} }),
      },
    })
    mockPrisma.currency.findUnique.mockResolvedValue({ code: "ARS" })
    mockPrisma.staffPaymentMethod.findFirst.mockResolvedValue({ id: "pm_1" })
    mockPrisma.staffPaymentMethod.findMany.mockResolvedValue([
      { id: "pm_1", schoolId: "school_1", name: "Bank Transfer", adapterType: "bank_transfer", currency: "ARS", active: true, configJson: { accountAlias: "pli" } },
    ])
    mockPrisma.staffPaymentModel.findMany.mockResolvedValue([{ id: "model_1", name: "Default ARS", isDefault: true }])
    mockPrisma.staffPaymentModel.findFirst.mockResolvedValue({ id: "model_1" })
    mockPrisma.staffPaymentModel.create.mockResolvedValue({ id: "model_2", name: "Teachers ARS", isDefault: true })
    mockPrisma.staffPaymentModel.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.staffPaymentModel.update.mockResolvedValue({ id: "model_1", name: "Teachers ARS", isDefault: true })
    mockPrisma.staffAccount.findUnique.mockResolvedValue({
      id: "staff_1",
      clerkUserId: "staff_user_1",
      metadata: { schoolId: "school_1" },
      paymentModel: null,
      paymentModelId: "model_old",
      hourlyRate: 100,
      paydayWeekday: 2,
      creditCapCents: 5000,
    })
    mockPrisma.staffAccount.update.mockResolvedValue({
      id: "staff_1",
      clerkUserId: "staff_user_1",
      paymentModelId: "model_1",
      hourlyRate: 100,
      paydayWeekday: 2,
      creditCapCents: 5000,
    })
    mockWritePayrollAudit.mockResolvedValue(undefined)
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
  })

  describe("GET /api/staff/payroll/payment-models", () => {
    it("owner can view payment models", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: "manager" })

      const { GET } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await GET()

      expect(res.status).toBe(200)
    })

    it("resolves school context from the local staff mirror without calling Clerk", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: "manager" })

      const { GET } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await GET()

      expect(res.status).toBe(200)
      expect(mockPrisma.staffAccount.findUnique).toHaveBeenCalledWith({
        where: { clerkUserId: "owner_1" },
        select: { metadata: true, paymentModel: { select: { schoolId: true } } },
      })
      expect(mockClerkClient).not.toHaveBeenCalled()
      expect(mockClerkGetUser).not.toHaveBeenCalled()
    })

    it("admin+manager can view payment models", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "admin_1", role: "admin", category: "manager" })

      const { GET } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await GET()

      expect(res.status).toBe(200)
    })

    it("regular staff cannot view payment models", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

      const { GET } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await GET()

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: "Insufficient role" })
    })

    it("unauthenticated request is rejected", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

      const { GET } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await GET()

      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: "Unauthorized" })
    })

    it("forwards Retry-After on transient auth failures", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({
        ok: false,
        status: 503,
        error: "Service temporarily busy. Please try again shortly.",
        retryAfterSec: 15,
      })

      const { GET } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await GET()

      expect(res.status).toBe(503)
      expect(res.headers.get("Retry-After")).toBe("15")
      expect(await res.json()).toEqual({ error: "Service temporarily busy. Please try again shortly." })
    })
  })

  describe("POST /api/staff/payroll/payment-models", () => {
    const validBody = {
      name: "Teachers ARS",
      hourlyRate: 2500,
      paydayWeekday: 5,
      creditCapCents: 10000,
      currency: "ARS",
      defaultPaymentMethodId: "pm_1",
      isDefault: true,
    }

    it("owner can create payment models", async () => {
      mockAuthorizeOwnerRequest.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: "manager" })

      const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }))

      expect(res.status).toBe(201)
    })

    it("admin+manager cannot create payment models", async () => {
      mockAuthorizeOwnerRequest.mockResolvedValue({ ok: false, status: 403, error: "Owner role required" })

      const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }))

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: "Owner role required" })
    })

    it("regular staff cannot create payment models", async () => {
      mockAuthorizeOwnerRequest.mockResolvedValue({ ok: false, status: 403, error: "Owner role required" })

      const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }))

      expect(res.status).toBe(403)
    })

    it("unauthenticated request is rejected", async () => {
      mockAuthorizeOwnerRequest.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

      const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }))

      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: "Unauthorized" })
    })

    it("forwards Retry-After on transient auth failures", async () => {
      mockAuthorizeOwnerRequest.mockResolvedValue({
        ok: false,
        status: 503,
        error: "Service temporarily busy. Please try again shortly.",
        retryAfterSec: 15,
      })

      const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
      const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      }))

      expect(res.status).toBe(503)
      expect(res.headers.get("Retry-After")).toBe("15")
      expect(await res.json()).toEqual({ error: "Service temporarily busy. Please try again shortly." })
    })
  })

  describe("PATCH /api/staff/users/[userId]/payroll-model", () => {
    it("owner can assign a payment model", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: "manager" })

      const { PATCH } = await import("@/app/api/staff/users/[userId]/payroll-model/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/users/staff_user_1/payroll-model", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentModelId: "model_1" }),
        }),
        { params: Promise.resolve({ userId: "staff_user_1" }) }
      )

      expect(res.status).toBe(200)
    })

    it("admin+manager can assign a payment model", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "admin_1", role: "admin", category: "manager" })

      const { PATCH } = await import("@/app/api/staff/users/[userId]/payroll-model/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/users/staff_user_1/payroll-model", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentModelId: "model_1" }),
        }),
        { params: Promise.resolve({ userId: "staff_user_1" }) }
      )

      expect(res.status).toBe(200)
    })

    it("regular staff cannot assign a payment model", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

      const { PATCH } = await import("@/app/api/staff/users/[userId]/payroll-model/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/users/staff_user_1/payroll-model", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentModelId: "model_1" }),
        }),
        { params: Promise.resolve({ userId: "staff_user_1" }) }
      )

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: "Insufficient role" })
    })

    it("unauthenticated request is rejected", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

      const { PATCH } = await import("@/app/api/staff/users/[userId]/payroll-model/route")
      const res = await PATCH(
        new Request("http://localhost/api/staff/users/staff_user_1/payroll-model", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentModelId: "model_1" }),
        }),
        { params: Promise.resolve({ userId: "staff_user_1" }) }
      )

      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: "Unauthorized" })
    })
  })
})
