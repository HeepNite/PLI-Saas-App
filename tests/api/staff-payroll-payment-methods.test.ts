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
    mockPrisma.staffPaymentMethod.findMany.mockResolvedValue([
      {
        id: "pm_1",
        schoolId: "school_1",
        name: "Cash",
        adapterType: "zelle",
        active: true,
        configJson: { zelleId: "real@value.com" },
      },
    ])
    mockPrisma.staffPaymentMethod.findFirst.mockResolvedValue(null)
    mockPrisma.staffPaymentMethod.findUnique.mockResolvedValue({
      id: "pm_1",
      schoolId: "school_1",
      active: true,
      adapterType: "cash",
      configJson: null,
    })
    mockPrisma.staffPaymentMethod.create.mockResolvedValue({
      id: "pm_2",
      name: "Bank",
      adapterType: "bank_transfer",
      currency: "ARS",
      configJson: { accountAlias: "pli" },
    })
    mockPrisma.staffPaymentMethod.update.mockResolvedValue({
      id: "pm_1",
      active: true,
      adapterType: "cash",
      configJson: null,
    })
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

  it("lists payment methods scoped to the owner's school with masked secrets", async () => {
    const { GET } = await import("@/app/api/staff/payroll/payment-methods/route")
    const res = await GET()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPaymentMethod.findMany).toHaveBeenCalledWith({
      where: { schoolId: "school_1" },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    })
    expect(data.items).toEqual([
      {
        id: "pm_1",
        schoolId: "school_1",
        name: "Cash",
        adapterType: "zelle",
        active: true,
        configJson: {
          zelleId: { configured: true, preview: "••••" },
          venmoUser: { configured: false, preview: null },
        },
      },
    ])
  })

  it("never leaks the plaintext secret in the GET list response body", async () => {
    const { GET } = await import("@/app/api/staff/payroll/payment-methods/route")
    const res = await GET()
    const raw = JSON.stringify(await res.json())

    expect(raw).not.toContain("real@value.com")
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

  it("creates a payment method for the owner's school and echoes a masked response", async () => {
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

    const data = await res.json()
    expect(data.configJson).toEqual({ accountAlias: "pli" })
  })

  it("echoes masked secrets on POST, never the raw plaintext value", async () => {
    mockPrisma.staffPaymentMethod.create.mockResolvedValueOnce({
      id: "pm_3",
      name: "Direct Deposit",
      adapterType: "direct_deposit",
      currency: "ARS",
      configJson: { accountNumber: "000123456789", bankName: "Chase" },
    })

    const { POST } = await import("@/app/api/staff/payroll/payment-methods/route")
    const res = await POST(new Request("http://localhost/api/staff/payroll/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Direct Deposit",
        adapterType: "direct_deposit",
        currency: "ARS",
        config: { accountNumber: "000123456789", bankName: "Chase" },
      }),
    }))

    expect(res.status).toBe(201)
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toContain("000123456789")
  })

  it("drops incoming config keys not declared in the resolved adapter schema on create", async () => {
    const { POST } = await import("@/app/api/staff/payroll/payment-methods/route")
    await POST(new Request("http://localhost/api/staff/payroll/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: " Bank Transfer ",
        adapterType: "bank_transfer",
        currency: "ARS",
        config: { accountAlias: "pli", stripeLikeSecret: "sk_live_LEAKED" },
      }),
    }))

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

  it("persists an empty configJson object, not an unset column, when POST omits the config key", async () => {
    const { POST } = await import("@/app/api/staff/payroll/payment-methods/route")
    await POST(new Request("http://localhost/api/staff/payroll/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "No Config",
        adapterType: "cash",
        currency: "ARS",
      }),
    }))

    expect(mockPrisma.staffPaymentMethod.create).toHaveBeenCalledWith({
      data: {
        schoolId: "school_1",
        name: "No Config",
        adapterType: "cash",
        currency: "ARS",
        configJson: {},
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

  it("echoes a masked configJson on PATCH even when the request only changes an unrelated field", async () => {
    mockPrisma.staffPaymentMethod.findUnique.mockResolvedValueOnce({
      id: "pm_1",
      schoolId: "school_1",
      active: true,
      adapterType: "mercadopago",
      configJson: { accessToken: "APP_USR-secret-token", publicKey: "APP_USR-public-key" },
    })
    mockPrisma.staffPaymentMethod.update.mockResolvedValueOnce({
      id: "pm_1",
      name: "Renamed",
      adapterType: "mercadopago",
      configJson: { accessToken: "APP_USR-secret-token", publicKey: "APP_USR-public-key" },
    })

    const { PATCH } = await import("@/app/api/staff/payroll/payment-methods/[methodId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-methods/pm_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      }),
      { params: Promise.resolve({ methodId: "pm_1" }) }
    )

    expect(res.status).toBe(200)
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toContain("APP_USR-secret-token")
  })

  it("does not touch configJson in the database when PATCH omits both config and adapterType (stored secret survives untouched)", async () => {
    mockPrisma.staffPaymentMethod.findUnique.mockResolvedValueOnce({
      id: "pm_1",
      schoolId: "school_1",
      active: true,
      adapterType: "mercadopago",
      configJson: { accessToken: "APP_USR-secret-token", publicKey: "APP_USR-public-key" },
    })
    mockPrisma.staffPaymentMethod.update.mockResolvedValueOnce({
      id: "pm_1",
      name: "Renamed",
      adapterType: "mercadopago",
      configJson: { accessToken: "APP_USR-secret-token", publicKey: "APP_USR-public-key" },
    })

    const { PATCH } = await import("@/app/api/staff/payroll/payment-methods/[methodId]/route")
    await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-methods/pm_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" }),
      }),
      { params: Promise.resolve({ methodId: "pm_1" }) }
    )

    expect(mockPrisma.staffPaymentMethod.update).toHaveBeenCalledWith({
      where: { id: "pm_1" },
      data: {
        name: "Renamed",
      },
    })
  })

  it("drops old-schema secret keys when PATCH changes adapterType without a config body", async () => {
    mockPrisma.staffPaymentMethod.findUnique.mockResolvedValueOnce({
      id: "pm_1",
      schoolId: "school_1",
      active: true,
      adapterType: "direct_deposit",
      configJson: { routingNumber: "021000021", accountNumber: "000123456789" },
    })
    mockPrisma.staffPaymentMethod.update.mockResolvedValueOnce({
      id: "pm_1",
      adapterType: "zelle",
      configJson: {},
    })

    const { PATCH } = await import("@/app/api/staff/payroll/payment-methods/[methodId]/route")
    await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-methods/pm_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adapterType: "zelle" }),
      }),
      { params: Promise.resolve({ methodId: "pm_1" }) }
    )

    expect(mockPrisma.staffPaymentMethod.update).toHaveBeenCalledWith({
      where: { id: "pm_1" },
      data: {
        adapterType: "zelle",
        configJson: {},
      },
    })
  })

  it("preserves a stored undeclared/legacy key when PATCH updates only a declared key without changing adapterType", async () => {
    mockPrisma.staffPaymentMethod.findUnique.mockResolvedValueOnce({
      id: "pm_1",
      schoolId: "school_1",
      active: true,
      adapterType: "bank_transfer",
      configJson: { accountAlias: "pli", legacyFreeFormKey: "old" },
    })
    mockPrisma.staffPaymentMethod.update.mockResolvedValueOnce({
      id: "pm_1",
      adapterType: "bank_transfer",
      configJson: { accountAlias: "new", legacyFreeFormKey: "old" },
    })

    const { PATCH } = await import("@/app/api/staff/payroll/payment-methods/[methodId]/route")
    await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-methods/pm_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { accountAlias: "new" } }),
      }),
      { params: Promise.resolve({ methodId: "pm_1" }) }
    )

    expect(mockPrisma.staffPaymentMethod.update).toHaveBeenCalledWith({
      where: { id: "pm_1" },
      data: {
        configJson: { accountAlias: "new", legacyFreeFormKey: "old" },
      },
    })
  })

  it("drops incoming config keys not declared in the resolved adapter schema on PATCH", async () => {
    mockPrisma.staffPaymentMethod.findUnique.mockResolvedValueOnce({
      id: "pm_1",
      schoolId: "school_1",
      active: true,
      adapterType: "zelle",
      configJson: { zelleId: "real@value.com" },
    })
    mockPrisma.staffPaymentMethod.update.mockResolvedValueOnce({
      id: "pm_1",
      adapterType: "zelle",
      configJson: { zelleId: "real@value.com" },
    })

    const { PATCH } = await import("@/app/api/staff/payroll/payment-methods/[methodId]/route")
    await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-methods/pm_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { stripeLikeSecret: "sk_live_LEAKED" } }),
      }),
      { params: Promise.resolve({ methodId: "pm_1" }) }
    )

    expect(mockPrisma.staffPaymentMethod.update).toHaveBeenCalledWith({
      where: { id: "pm_1" },
      data: {
        configJson: { zelleId: "real@value.com" },
      },
    })
  })
})
