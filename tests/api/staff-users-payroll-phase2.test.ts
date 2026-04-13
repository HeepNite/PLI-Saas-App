import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerRequest = vi.fn()
const mockAuthorizeStaffPortalRequest = vi.fn()
const mockAuthorizeStaffPortalBaseRequest = vi.fn()
const mockClerkClient = vi.fn()
const mockWritePayrollAudit = vi.fn()
const mockSyncStaffAccountFromClerkUser = vi.fn()
const mockCreateStaffRoleAudit = vi.fn()

const mockPrisma = {
  currency: { findUnique: vi.fn() },
  staffPaymentMethod: { findFirst: vi.fn(), findMany: vi.fn() },
  staffPaymentModel: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  staffAccount: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  staffPaymentChangeRequest: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerRequest: (...args: unknown[]) => mockAuthorizeOwnerRequest(...args),
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizeStaffPortalRequest(...args),
  authorizeStaffPortalBaseRequest: (...args: unknown[]) => mockAuthorizeStaffPortalBaseRequest(...args),
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

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff-profile-payment"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/security/staff-account-sync", () => ({
  createStaffRoleAudit: (...args: unknown[]) => mockCreateStaffRoleAudit(...args),
  extractStaffRoleSnapshot: vi.fn((user: { publicMetadata?: Record<string, unknown> }) => ({
    role: user.publicMetadata?.role ?? null,
    category: user.publicMetadata?.staffCategory ?? null,
  })),
  syncStaffAccountFromClerkUser: (...args: unknown[]) => mockSyncStaffAccountFromClerkUser(...args),
}))

describe("staff users payroll phase 2", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("PATCH /api/staff/users/[userId]/payroll-model — assignment edge cases", () => {
    beforeEach(() => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({
        ok: true,
        userId: "manager_1",
        role: "admin",
        category: "manager",
      })
      mockClerkClient.mockResolvedValue({
        users: {
          getUser: vi.fn().mockResolvedValue({ publicMetadata: { schoolId: "school_1" }, privateMetadata: {} }),
        },
      })
      mockWritePayrollAudit.mockResolvedValue(undefined)
      mockPrisma.staffAccount.findUnique.mockResolvedValue({
        id: "staff_1",
        clerkUserId: "staff_user_1",
        paymentModelId: "model_old",
        hourlyRate: 100,
        paydayWeekday: 2,
        creditCapCents: 5000,
      })
      mockPrisma.staffPaymentModel.findFirst.mockResolvedValue({ id: "model_1", schoolId: "school_1" })
      mockPrisma.staffAccount.update.mockResolvedValue({
        id: "staff_1",
        clerkUserId: "staff_user_1",
        paymentModelId: null,
        hourlyRate: 100,
        paydayWeekday: 2,
        creditCapCents: 5000,
      })
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
    })

    it("clears the payment model override when assigning null", async () => {
      const { PATCH } = await import("@/app/api/staff/users/[userId]/payroll-model/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/users/staff_user_1/payroll-model", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentModelId: null }),
        }),
        { params: Promise.resolve({ userId: "staff_user_1" }) }
      )

      expect(res.status).toBe(200)
      expect(mockPrisma.$transaction).toHaveBeenCalled()
      expect(mockPrisma.staffAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clerkUserId: "staff_user_1" },
          data: expect.objectContaining({ paymentModelId: null }),
        })
      )
      expect(mockWritePayrollAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "MODEL_ASSIGNED",
          previousValue: { previousModelId: "model_old" },
          nextValue: { nextModelId: null },
        }),
        mockPrisma
      )
    })

    it("returns 404 when assigning a non-existent model", async () => {
      mockPrisma.staffPaymentModel.findFirst.mockResolvedValueOnce(null)

      const { PATCH } = await import("@/app/api/staff/users/[userId]/payroll-model/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/users/staff_user_1/payroll-model", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentModelId: "nonexistent_model" }),
        }),
        { params: Promise.resolve({ userId: "staff_user_1" }) }
      )

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.error).toContain("not found")
    })
  })

  describe("PATCH /api/staff/users/[userId]/profile — payment validation", () => {
    const baseUser = {
      id: "staff_1",
      firstName: "Ana",
      lastName: "Desk",
      imageUrl: "",
      lastSignInAt: null,
      publicMetadata: { role: "staff", staffCategory: "front_desk", staffProfile: {} },
      privateMetadata: {},
    }

    const usersApi = {
      getUser: vi.fn().mockResolvedValue(baseUser),
      updateUser: vi.fn().mockResolvedValue(baseUser),
      updateUserMetadata: vi.fn().mockImplementation(async (_userId: string, payload: { publicMetadata?: unknown; privateMetadata?: unknown }) => ({
        ...baseUser,
        publicMetadata: payload.publicMetadata ?? baseUser.publicMetadata,
        privateMetadata: payload.privateMetadata ?? baseUser.privateMetadata,
      })),
    }

    const sessionsApi = {
      getSessionList: vi.fn().mockResolvedValue({ data: [] }),
    }

    beforeEach(() => {
      mockAuthorizeStaffPortalBaseRequest.mockResolvedValue({
        ok: true,
        status: 200,
        userId: "staff_1",
        role: "staff",
        category: "front_desk",
      })
      mockClerkClient.mockResolvedValue({ users: usersApi, sessions: sessionsApi })
      mockSyncStaffAccountFromClerkUser.mockResolvedValue(undefined)
      mockCreateStaffRoleAudit.mockResolvedValue(undefined)
      mockPrisma.staffAccount.findUnique.mockResolvedValue({ paymentPreference: null, paymentInfo: null })
      mockPrisma.staffAccount.update.mockResolvedValue({ paymentPreference: "direct_deposit", paymentInfo: null })
    })

    it("accepts valid direct_deposit fields", async () => {
      mockPrisma.staffAccount.update.mockResolvedValue({
        paymentPreference: "direct_deposit",
        paymentInfo: {
          routingNumber: "021000021",
          accountNumber: "000123456789",
          accountType: "checking",
          accountHolder: "Ana Desk",
        },
      })

      const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/users/staff_1/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentPreference: "direct_deposit",
            paymentInfo: {
              routingNumber: "021000021",
              accountNumber: "000123456789",
              accountType: "checking",
              accountHolder: "Ana Desk",
            },
          }),
        }),
        { params: Promise.resolve({ userId: "staff_1" }) }
      )

      expect(res.status).toBe(200)
      expect(mockPrisma.staffAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { clerkUserId: "staff_1" },
          data: expect.objectContaining({
            paymentPreference: "direct_deposit",
            paymentInfo: {
              routingNumber: "021000021",
              accountNumber: "000123456789",
              accountType: "checking",
              accountHolder: "Ana Desk",
            },
          }),
        })
      )
    })

    it("rejects direct_deposit with missing routingNumber", async () => {
      const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/users/staff_1/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentPreference: "direct_deposit",
            paymentInfo: {
              accountNumber: "000123456789",
              accountType: "checking",
              accountHolder: "Ana Desk",
            },
          }),
        }),
        { params: Promise.resolve({ userId: "staff_1" }) }
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toContain("routingNumber")
    })

    it("accepts valid zelle fields with zelleId", async () => {
      mockPrisma.staffAccount.update.mockResolvedValue({
        paymentPreference: "zelle",
        paymentInfo: { zelleId: "ana@example.com" },
      })

      const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/users/staff_1/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentPreference: "zelle",
            paymentInfo: { zelleId: "ana@example.com" },
          }),
        }),
        { params: Promise.resolve({ userId: "staff_1" }) }
      )

      expect(res.status).toBe(200)
      expect(mockPrisma.staffAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentPreference: "zelle",
            paymentInfo: { zelleId: "ana@example.com" },
          }),
        })
      )
    })

    it("rejects zelle when no zelleId or venmoUser is provided but other fields are present", async () => {
      const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/users/staff_1/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentPreference: "zelle",
            paymentInfo: { bankName: "Chase" },
          }),
        }),
        { params: Promise.resolve({ userId: "staff_1" }) }
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toContain("zelleId")
    })
  })

  describe("POST /api/staff/payroll/change-requests", () => {
    beforeEach(() => {
      mockAuthorizeStaffPortalBaseRequest.mockResolvedValue({
        ok: true,
        status: 200,
        userId: "staff_1",
        role: "staff",
        category: "front_desk",
      })
      mockPrisma.staffAccount.findUnique.mockResolvedValue({ id: "staff_1" })
      mockPrisma.staffPaymentChangeRequest.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.staffPaymentChangeRequest.create.mockResolvedValue({
        id: "req_1",
        staffAccountId: "staff_1",
        requestedMethod: "direct_deposit",
        requestedInfo: { routingNumber: "021000021", accountNumber: "000123456789", accountType: "checking", accountHolder: "Ana Desk" },
        reason: "Updated bank info",
        status: "pending",
        createdAt: new Date("2026-04-13T10:00:00.000Z"),
      })
    })

    it("allows staff to submit a change request", async () => {
      const { POST } = await import("@/app/api/staff/payroll/change-requests/route")

      const res = await POST(
        new Request("http://localhost/api/staff/payroll/change-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestedMethod: "direct_deposit",
            requestedInfo: { routingNumber: "021000021", accountNumber: "000123456789", accountType: "checking", accountHolder: "Ana Desk" },
            reason: "Updated bank info",
          }),
        })
      )

      expect(res.status).toBe(201)
      expect(mockPrisma.staffPaymentChangeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          staffAccountId: "staff_1",
          requestedMethod: "direct_deposit",
          status: "pending",
        }),
      })
    })

    it("cancels previous pending requests when a new one is submitted", async () => {
      mockPrisma.staffPaymentChangeRequest.updateMany.mockResolvedValueOnce({ count: 2 })

      const { POST } = await import("@/app/api/staff/payroll/change-requests/route")

      const res = await POST(
        new Request("http://localhost/api/staff/payroll/change-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestedMethod: "cash",
            requestedInfo: {},
            reason: "Switching to cash",
          }),
        })
      )

      expect(res.status).toBe(201)
      expect(mockPrisma.staffPaymentChangeRequest.updateMany).toHaveBeenCalledWith({
        where: {
          staffAccountId: "staff_1",
          status: "pending",
        },
        data: {
          status: "cancelled",
        },
      })
    })

    it("requires requestedMethod", async () => {
      const { POST } = await import("@/app/api/staff/payroll/change-requests/route")

      const res = await POST(
        new Request("http://localhost/api/staff/payroll/change-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      )

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.error).toContain("required")
    })

    it("returns 404 when staff account is not found", async () => {
      mockPrisma.staffAccount.findUnique.mockResolvedValueOnce(null)

      const { POST } = await import("@/app/api/staff/payroll/change-requests/route")

      const res = await POST(
        new Request("http://localhost/api/staff/payroll/change-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestedMethod: "cash" }),
        })
      )

      expect(res.status).toBe(404)
    })

    it("rejects unauthenticated requests", async () => {
      mockAuthorizeStaffPortalBaseRequest.mockResolvedValueOnce({
        ok: false,
        status: 401,
        error: "Unauthorized",
      })

      const { POST } = await import("@/app/api/staff/payroll/change-requests/route")

      const res = await POST(
        new Request("http://localhost/api/staff/payroll/change-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestedMethod: "cash" }),
        })
      )

      expect(res.status).toBe(401)
    })
  })

  describe("PATCH /api/staff/payroll/change-requests/[requestId]", () => {
    beforeEach(() => {
      mockAuthorizeStaffPortalRequest.mockResolvedValue({
        ok: true,
        userId: "admin_1",
        role: "admin",
        category: "manager",
      })
    })

    it("approves a change request and updates staff payment info in a transaction", async () => {
      mockPrisma.staffPaymentChangeRequest.findUnique.mockResolvedValueOnce({
        id: "req_1",
        staffAccountId: "staff_1",
        requestedMethod: "direct_deposit",
        requestedInfo: { routingNumber: "021000021", accountNumber: "000123456789", accountType: "checking", accountHolder: "Ana Desk" },
        reason: "Updated bank info",
        status: "pending",
        createdAt: new Date("2026-04-13T10:00:00.000Z"),
      })
      mockPrisma.staffAccount.update.mockResolvedValueOnce({
        paymentPreference: "direct_deposit",
        paymentInfo: { routingNumber: "021000021", accountNumber: "000123456789", accountType: "checking", accountHolder: "Ana Desk" },
      })
      mockPrisma.staffPaymentChangeRequest.update.mockResolvedValueOnce({
        id: "req_1",
        status: "approved",
        reviewedBy: "admin_1",
        reviewedAt: new Date(),
      })
      mockPrisma.$transaction.mockImplementationOnce(async (arg) => {
        if (typeof arg === "function") return arg(mockPrisma)
        return Promise.all(arg)
      })

      const { PATCH } = await import("@/app/api/staff/payroll/change-requests/[requestId]/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/payroll/change-requests/req_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        }),
        { params: Promise.resolve({ requestId: "req_1" }) }
      )

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
      expect(mockPrisma.staffAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "staff_1" },
          data: expect.objectContaining({
            paymentPreference: "direct_deposit",
          }),
        })
      )
      expect(mockPrisma.staffPaymentChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req_1" },
          data: expect.objectContaining({
            status: "approved",
            reviewedBy: "admin_1",
          }),
        })
      )
    })

    it("rejects a change request with a reason", async () => {
      mockPrisma.staffPaymentChangeRequest.findUnique.mockResolvedValueOnce({
        id: "req_2",
        staffAccountId: "staff_1",
        requestedMethod: "zelle",
        requestedInfo: { zelleId: "ana@example.com" },
        reason: null,
        status: "pending",
        createdAt: new Date("2026-04-13T10:00:00.000Z"),
      })
      mockPrisma.staffPaymentChangeRequest.update.mockResolvedValueOnce({
        id: "req_2",
        status: "rejected",
        rejectionReason: "Not approved",
        reviewedBy: "admin_1",
        reviewedAt: new Date(),
      })

      const { PATCH } = await import("@/app/api/staff/payroll/change-requests/[requestId]/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/payroll/change-requests/req_2", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "rejected", rejectionReason: "Not approved" }),
        }),
        { params: Promise.resolve({ requestId: "req_2" }) }
      )

      expect(res.status).toBe(200)
      expect(mockPrisma.staffAccount.update).not.toHaveBeenCalled()
      expect(mockPrisma.staffPaymentChangeRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req_2" },
          data: expect.objectContaining({
            status: "rejected",
            rejectionReason: "Not approved",
            reviewedBy: "admin_1",
          }),
        })
      )
    })

    it("returns 404 for a non-existent request", async () => {
      mockPrisma.staffPaymentChangeRequest.findUnique.mockResolvedValueOnce(null)

      const { PATCH } = await import("@/app/api/staff/payroll/change-requests/[requestId]/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/payroll/change-requests/nonexistent", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        }),
        { params: Promise.resolve({ requestId: "nonexistent" }) }
      )

      expect(res.status).toBe(404)
    })

    it("returns 409 when approving an already-finalized request", async () => {
      mockPrisma.staffPaymentChangeRequest.findUnique.mockResolvedValueOnce({
        id: "req_3",
        staffAccountId: "staff_1",
        requestedMethod: "cash",
        requestedInfo: {},
        reason: null,
        status: "approved",
        createdAt: new Date("2026-04-13T10:00:00.000Z"),
      })

      const { PATCH } = await import("@/app/api/staff/payroll/change-requests/[requestId]/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/payroll/change-requests/req_3", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        }),
        { params: Promise.resolve({ requestId: "req_3" }) }
      )

      expect(res.status).toBe(409)
    })

    it("rejects non-admin/approver requests with 403", async () => {
      mockAuthorizeStaffPortalRequest.mockResolvedValueOnce({
        ok: false,
        status: 403,
        error: "Insufficient role",
      })

      const { PATCH } = await import("@/app/api/staff/payroll/change-requests/[requestId]/route")

      const res = await PATCH(
        new Request("http://localhost/api/staff/payroll/change-requests/req_1", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" }),
        }),
        { params: Promise.resolve({ requestId: "req_1" }) }
      )

      expect(res.status).toBe(403)
    })
  })
})