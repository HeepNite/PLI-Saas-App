import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerRequest = vi.fn()
const mockClerkClient = vi.fn()
const mockClerkGetUser = vi.fn()

const mockPrisma = {
  staffAccount: {
    findUnique: vi.fn(),
  },
  currency: {
    findUnique: vi.fn(),
  },
  staffPaymentMethod: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  staffPaymentModel: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerRequest: (...args: unknown[]) => mockAuthorizeOwnerRequest(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff payroll payment methods routes", () => {
  beforeEach(() => {
    mockAuthorizeOwnerRequest.mockReset()
    mockClerkClient.mockReset()
    mockClerkGetUser.mockReset()
    mockPrisma.staffAccount.findUnique.mockReset()
    mockPrisma.currency.findUnique.mockReset()
    mockPrisma.staffPaymentMethod.findMany.mockReset()
    mockPrisma.staffPaymentMethod.findFirst.mockReset()
    mockPrisma.staffPaymentMethod.findUnique.mockReset()
    mockPrisma.staffPaymentMethod.create.mockReset()
    mockPrisma.staffPaymentMethod.update.mockReset()
    mockPrisma.staffPaymentModel.findMany.mockReset()

    mockAuthorizeOwnerRequest.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: "manager" })
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: mockClerkGetUser.mockResolvedValue({ publicMetadata: { schoolId: "school_1" }, privateMetadata: {} }),
      },
    })
    mockPrisma.staffAccount.findUnique.mockResolvedValue({ metadata: { schoolId: "school_1" }, paymentModel: null })
    mockPrisma.currency.findUnique.mockResolvedValue({ code: "ARS" })
    mockPrisma.staffPaymentMethod.findMany.mockResolvedValue([{ id: "pm_1", schoolId: "school_1", name: "Cash", active: true }])
    mockPrisma.staffPaymentMethod.findFirst.mockResolvedValue(null)
    mockPrisma.staffPaymentMethod.findUnique.mockResolvedValue({ id: "pm_1", schoolId: "school_1", active: true })
    mockPrisma.staffPaymentMethod.create.mockResolvedValue({ id: "pm_2", name: "Bank", adapterType: "bank_transfer", currency: "ARS" })
    mockPrisma.staffPaymentMethod.update.mockResolvedValue({ id: "pm_1", active: true })
    mockPrisma.staffPaymentModel.findMany.mockResolvedValue([])
  })

  it("rejects GET requests from non-owners", async () => {
    mockAuthorizeOwnerRequest.mockResolvedValueOnce({ ok: false, status: 403, error: "Owner role required" })

    const { GET } = await import("@/app/api/staff/payroll/payment-methods/route")
    const res = await GET()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Owner role required" })
  })

  it("forwards Retry-After on transient owner auth failures", async () => {
    mockAuthorizeOwnerRequest.mockResolvedValueOnce({
      ok: false,
      status: 503,
      error: "Service temporarily busy. Please try again shortly.",
      retryAfterSec: 15,
    })

    const { GET } = await import("@/app/api/staff/payroll/payment-methods/route")
    const res = await GET()

    expect(res.status).toBe(503)
    expect(res.headers.get("Retry-After")).toBe("15")
    expect(await res.json()).toEqual({ error: "Service temporarily busy. Please try again shortly." })
  })

  it("lists payment methods scoped to the owner's school", async () => {
    const { GET } = await import("@/app/api/staff/payroll/payment-methods/route")
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPaymentMethod.findMany).toHaveBeenCalledWith({
      where: { schoolId: "school_1" },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    })
    expect(data.items).toEqual([{ id: "pm_1", schoolId: "school_1", name: "Cash", active: true }])
  })

  it("resolves school context from the local staff mirror without calling Clerk", async () => {
    const { GET } = await import("@/app/api/staff/payroll/payment-methods/route")
    const res = await GET()

    expect(res.status).toBe(200)
    expect(mockPrisma.staffAccount.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: "owner_1" },
      select: { metadata: true, paymentModel: { select: { schoolId: true } } },
    })
    expect(mockClerkClient).not.toHaveBeenCalled()
    expect(mockClerkGetUser).not.toHaveBeenCalled()
  })

  it("falls back to Clerk school metadata when the local mirror has not stored school context yet", async () => {
    mockAuthorizeOwnerRequest.mockResolvedValueOnce({ ok: true, userId: "owner_without_mirror_school", role: "owner", category: "manager" })
    mockPrisma.staffAccount.findUnique.mockResolvedValueOnce({ metadata: {}, paymentModel: null })
    mockClerkGetUser.mockResolvedValueOnce({ publicMetadata: { schoolId: "school_from_clerk" }, privateMetadata: {} })

    const { GET } = await import("@/app/api/staff/payroll/payment-methods/route")
    const res = await GET()

    expect(res.status).toBe(200)
    expect(mockClerkClient).toHaveBeenCalledTimes(1)
    expect(mockClerkGetUser).toHaveBeenCalledWith("owner_without_mirror_school")
    expect(mockPrisma.staffPaymentMethod.findMany).toHaveBeenCalledWith({
      where: { schoolId: "school_from_clerk" },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    })
  })

  it("rejects duplicate payment method names on create", async () => {
    mockPrisma.staffPaymentMethod.findFirst.mockResolvedValueOnce({ id: "existing" })

    const { POST } = await import("@/app/api/staff/payroll/payment-methods/route")
    const res = await POST(new Request("http://localhost/api/staff/payroll/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: " Cash ", adapterType: "cash", currency: "ARS" }),
    }))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "Payment method name already exists" })
    expect(mockPrisma.staffPaymentMethod.create).not.toHaveBeenCalled()
  })

  it("creates a payment method for the owner's school", async () => {
    const { POST } = await import("@/app/api/staff/payroll/payment-methods/route")
    const res = await POST(new Request("http://localhost/api/staff/payroll/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: " Bank Transfer ",
        adapterType: "bank_transfer",
        currency: "ARS",
        config: { accountAlias: "pli" },
      }),
    }))

    expect(res.status).toBe(201)
    expect(mockPrisma.staffPaymentMethod.create).toHaveBeenCalledWith({
      data: {
        schoolId: "school_1",
        name: "Bank Transfer",
        adapterType: "bank_transfer",
        currency: "ARS",
        configJson: { accountAlias: "pli" },
        active: true,
      },
    })
  })

  it("blocks deactivation when an active payment model depends on the method", async () => {
    mockPrisma.staffPaymentModel.findMany.mockResolvedValueOnce([{ name: "Teachers ARS" }])

    const { PATCH } = await import("@/app/api/staff/payroll/payment-methods/[methodId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-methods/pm_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ methodId: "pm_1" }) }
    )

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: "Cannot deactivate: method is used by active model(s)",
      details: { models: ["Teachers ARS"] },
    })
    expect(mockPrisma.staffPaymentMethod.update).not.toHaveBeenCalled()
  })

  it("forwards Retry-After on transient owner auth failures when updating a method", async () => {
    mockAuthorizeOwnerRequest.mockResolvedValueOnce({
      ok: false,
      status: 503,
      error: "Service temporarily busy. Please try again shortly.",
      retryAfterSec: 15,
    })

    const { PATCH } = await import("@/app/api/staff/payroll/payment-methods/[methodId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-methods/pm_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      }),
      { params: Promise.resolve({ methodId: "pm_1" }) }
    )

    expect(res.status).toBe(503)
    expect(res.headers.get("Retry-After")).toBe("15")
    expect(await res.json()).toEqual({ error: "Service temporarily busy. Please try again shortly." })
  })
})
