import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerRequest = vi.fn()
const mockAuthorizeStaffPortalRequest = vi.fn()
const mockClerkClient = vi.fn()
const mockWritePayrollAudit = vi.fn()

const mockPrisma = {
  currency: {
    findUnique: vi.fn(),
  },
  staffPaymentMethod: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  staffPaymentModel: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  staffAccount: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
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

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff payroll payment models routes", () => {
  beforeEach(() => {
    mockAuthorizeOwnerRequest.mockReset()
    mockAuthorizeStaffPortalRequest.mockReset()
    mockClerkClient.mockReset()
    mockWritePayrollAudit.mockReset()
    mockPrisma.currency.findUnique.mockReset()
    mockPrisma.staffPaymentMethod.findFirst.mockReset()
    mockPrisma.staffPaymentMethod.findMany.mockReset()
    mockPrisma.staffPaymentModel.findMany.mockReset()
    mockPrisma.staffPaymentModel.findFirst.mockReset()
    mockPrisma.staffPaymentModel.findUnique.mockReset()
    mockPrisma.staffPaymentModel.updateMany.mockReset()
    mockPrisma.staffPaymentModel.create.mockReset()
    mockPrisma.staffPaymentModel.update.mockReset()
    mockPrisma.staffAccount.findUnique.mockReset()
    mockPrisma.staffAccount.update.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuthorizeOwnerRequest.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: "manager" })
    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "manager_1", role: "admin", category: "manager" })
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({ publicMetadata: { schoolId: "school_1" }, privateMetadata: {} }),
      },
    })
    mockPrisma.currency.findUnique.mockResolvedValue({ code: "ARS" })
    mockPrisma.staffPaymentMethod.findFirst.mockResolvedValue({ id: "pm_1" })
    mockPrisma.staffPaymentMethod.findMany.mockResolvedValue([
      {
        id: "pm_1",
        schoolId: "school_1",
        name: "Bank Transfer",
        adapterType: "bank_transfer",
        currency: "ARS",
        active: true,
        configJson: { accountAlias: "pli" },
      },
    ])
    mockPrisma.staffPaymentModel.findMany.mockResolvedValue([{ id: "model_1", name: "Default ARS", isDefault: true }])
    mockPrisma.staffPaymentModel.findFirst.mockResolvedValue({ id: "model_1" })
    mockPrisma.staffPaymentModel.findUnique.mockResolvedValue({ id: "model_1", schoolId: "school_1" })
    mockPrisma.staffPaymentModel.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.staffPaymentModel.create.mockResolvedValue({ id: "model_2", name: "Teachers ARS", isDefault: true })
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

  it("creates a default model and clears previous defaults in the same transaction", async () => {
    const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
    const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Teachers ARS",
        hourlyRate: 2500,
        paydayWeekday: 5,
        creditCapCents: 10000,
        currency: "ARS",
        defaultPaymentMethodId: "pm_1",
        isDefault: true,
      }),
    }))

    expect(res.status).toBe(201)
    expect(mockPrisma.staffPaymentModel.updateMany).toHaveBeenCalledWith({
      where: { schoolId: "school_1", isDefault: true },
      data: { isDefault: false },
    })
    expect(mockPrisma.staffPaymentModel.create).toHaveBeenCalledWith({
      data: {
        schoolId: "school_1",
        name: "Teachers ARS",
        hourlyRate: 2500,
        currency: "ARS",
        paydayWeekday: 5,
        creditCapCents: 10000,
        defaultPaymentMethodId: "pm_1",
        isDefault: true,
        active: true,
      },
      include: {
        defaultPaymentMethod: true,
      },
    })
  })

  it("allows managers to list payment models for the assignment dropdown with a masked default method", async () => {
    mockPrisma.staffPaymentModel.findMany.mockResolvedValueOnce([
      {
        id: "model_1",
        name: "Default ARS",
        hourlyRate: 2500,
        currency: "ARS",
        paydayWeekday: 5,
        creditCapCents: 10000,
        defaultPaymentMethodId: "pm_1",
        defaultPaymentMethod: {
          id: "pm_1",
          name: "Bank Transfer",
          adapterType: "direct_deposit",
          currency: "ARS",
          active: true,
          configJson: { accountNumber: "000123456789", bankName: "Chase" },
        },
        isDefault: true,
        active: true,
      },
    ])

    const { GET } = await import("@/app/api/staff/payroll/payment-models/route")

    const res = await GET()

    expect(res.status).toBe(200)
    expect(mockAuthorizeStaffPortalRequest).toHaveBeenCalledTimes(1)
    expect(mockPrisma.staffPaymentModel.findMany).toHaveBeenCalledWith({
      where: { schoolId: "school_1" },
      include: {
        defaultPaymentMethod: true,
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    })
    expect(await res.json()).toEqual({
      items: [
        {
          id: "model_1",
          name: "Default ARS",
          hourlyRate: 2500,
          currency: "ARS",
          paydayWeekday: 5,
          creditCapCents: 10000,
          defaultPaymentMethodId: "pm_1",
          defaultPaymentMethod: {
            id: "pm_1",
            name: "Bank Transfer",
            adapterType: "direct_deposit",
            currency: "ARS",
            active: true,
            configJson: {
              accountNumber: { configured: true, preview: "…6789" },
              bankName: "Chase",
              routingNumber: { configured: false, preview: null },
            },
          },
          isDefault: true,
          active: true,
        },
      ],
    })
  })

  it("never leaks the plaintext default-method secret when the relation arrives via Prisma include", async () => {
    mockPrisma.staffPaymentModel.findMany.mockResolvedValueOnce([
      {
        id: "model_1",
        name: "Default ARS",
        defaultPaymentMethodId: "pm_1",
        defaultPaymentMethod: {
          id: "pm_1",
          name: "Bank Transfer",
          adapterType: "direct_deposit",
          currency: "ARS",
          active: true,
          configJson: { accountNumber: "000123456789", bankName: "Chase" },
        },
        isDefault: true,
        active: true,
      },
    ])

    const { GET } = await import("@/app/api/staff/payroll/payment-models/route")
    const res = await GET()
    const raw = JSON.stringify(await res.json())

    expect(raw).not.toContain("000123456789")
  })

  it("hydrates defaultPaymentMethod in list responses when the relation comes back null", async () => {
    mockPrisma.staffPaymentModel.findMany.mockResolvedValueOnce([
      {
        id: "model_1",
        name: "Teachers ARS",
        defaultPaymentMethodId: "pm_1",
        defaultPaymentMethod: null,
        isDefault: true,
      },
    ])

    const { GET } = await import("@/app/api/staff/payroll/payment-models/route")
    const res = await GET()

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPaymentMethod.findMany).toHaveBeenCalledWith({
      where: {
        schoolId: "school_1",
        id: { in: ["pm_1"] },
      },
    })
    expect(await res.json()).toEqual({
      items: [
        expect.objectContaining({
          id: "model_1",
          defaultPaymentMethodId: "pm_1",
          defaultPaymentMethod: expect.objectContaining({
            id: "pm_1",
            name: "Bank Transfer",
            configJson: { accountAlias: "pli" },
          }),
        }),
      ],
    })
  })

  it("masks the default method's secrets when hydrated via the fallback-fetch branch", async () => {
    mockPrisma.staffPaymentModel.findMany.mockResolvedValueOnce([
      {
        id: "model_1",
        name: "Teachers ARS",
        defaultPaymentMethodId: "pm_1",
        defaultPaymentMethod: null,
        isDefault: true,
      },
    ])
    mockPrisma.staffPaymentMethod.findMany.mockResolvedValueOnce([
      {
        id: "pm_1",
        schoolId: "school_1",
        name: "Zelle",
        adapterType: "zelle",
        active: true,
        configJson: { zelleId: "real@value.com" },
      },
    ])

    const { GET } = await import("@/app/api/staff/payroll/payment-models/route")
    const res = await GET()
    const data = await res.json()
    const raw = JSON.stringify(data)

    expect(raw).not.toContain("real@value.com")
    expect(data.items[0].defaultPaymentMethod.configJson).toEqual({
      zelleId: { configured: true, preview: "••••" },
      venmoUser: { configured: false, preview: null },
    })
  })

  it("rejects inactive or cross-school default payment methods on create", async () => {
    mockPrisma.staffPaymentMethod.findFirst.mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
    const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Teachers ARS",
        hourlyRate: 2500,
        paydayWeekday: 5,
        creditCapCents: 10000,
        currency: "ARS",
        defaultPaymentMethodId: "pm_missing",
      }),
    }))

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: "Default payment method not found or inactive",
      details: { field: "defaultPaymentMethodId" },
    })
  })

  it("updates a model to become the new default", async () => {
    const { PATCH } = await import("@/app/api/staff/payroll/payment-models/[modelId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-models/model_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      }),
      { params: Promise.resolve({ modelId: "model_1" }) }
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPaymentModel.updateMany).toHaveBeenCalledWith({
      where: { schoolId: "school_1", isDefault: true, NOT: { id: "model_1" } },
      data: { isDefault: false },
    })
    expect(mockPrisma.staffPaymentModel.update).toHaveBeenCalledWith({
      where: { id: "model_1" },
      data: { isDefault: true },
      include: { defaultPaymentMethod: true },
    })
  })

  it("hydrates defaultPaymentMethod in patch responses when the relation comes back null", async () => {
    mockPrisma.staffPaymentModel.update.mockResolvedValueOnce({
      id: "model_1",
      name: "Teachers ARS",
      defaultPaymentMethodId: "pm_1",
      defaultPaymentMethod: null,
      isDefault: true,
    })

    const { PATCH } = await import("@/app/api/staff/payroll/payment-models/[modelId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-models/model_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPaymentMethodId: "pm_1" }),
      }),
      { params: Promise.resolve({ modelId: "model_1" }) }
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPaymentMethod.findMany).toHaveBeenCalledWith({
      where: {
        schoolId: "school_1",
        id: { in: ["pm_1"] },
      },
    })
    expect(await res.json()).toEqual(expect.objectContaining({
      id: "model_1",
      defaultPaymentMethodId: "pm_1",
      defaultPaymentMethod: expect.objectContaining({
        id: "pm_1",
        name: "Bank Transfer",
        configJson: { accountAlias: "pli" },
      }),
    }))
  })

  it("masks the default method's secrets on PATCH when the relation arrives via Prisma include (regression guard)", async () => {
    mockPrisma.staffPaymentModel.update.mockResolvedValueOnce({
      id: "model_1",
      name: "Teachers ARS",
      defaultPaymentMethodId: "pm_1",
      defaultPaymentMethod: {
        id: "pm_1",
        name: "Zelle",
        adapterType: "zelle",
        active: true,
        configJson: { zelleId: "real@value.com" },
      },
      isDefault: true,
    })

    const { PATCH } = await import("@/app/api/staff/payroll/payment-models/[modelId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-models/model_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Teachers ARS" }),
      }),
      { params: Promise.resolve({ modelId: "model_1" }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    const raw = JSON.stringify(data)

    expect(raw).not.toContain("real@value.com")
    expect(data.defaultPaymentMethod.configJson).toEqual({
      zelleId: { configured: true, preview: "••••" },
      venmoUser: { configured: false, preview: null },
    })
  })

  it("assigns a payroll model to a staff account and writes an audit entry", async () => {
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
    expect(mockAuthorizeStaffPortalRequest).toHaveBeenCalledTimes(1)
    expect(mockPrisma.staffAccount.update).toHaveBeenCalledWith({
      where: { clerkUserId: "staff_user_1" },
      data: { paymentModelId: "model_1" },
      select: {
        id: true,
        clerkUserId: true,
        paymentModelId: true,
        hourlyRate: true,
        paydayWeekday: true,
        creditCapCents: true,
      },
    })
    expect(mockWritePayrollAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        staffAccountId: "staff_1",
        actorClerkUserId: "manager_1",
        type: "MODEL_ASSIGNED",
        previousValue: { previousModelId: "model_old" },
        nextValue: { nextModelId: "model_1" },
        metadata: { previousModelId: "model_old", nextModelId: "model_1" },
      }),
      mockPrisma
    )
  })

  it("allows owners to assign a payroll model to a staff account", async () => {
    mockAuthorizeStaffPortalRequest.mockResolvedValueOnce({
      ok: true,
      userId: "owner_1",
      role: "owner",
      category: "manager",
    })

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
    expect(mockWritePayrollAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorClerkUserId: "owner_1",
        type: "MODEL_ASSIGNED",
        nextValue: { nextModelId: "model_1" },
      }),
      mockPrisma
    )
  })

  it("creates a per_percentage model with percentageRate and hourlyRate=0", async () => {
    mockPrisma.staffPaymentModel.create.mockResolvedValueOnce({
      id: "model_pct",
      name: "Revenue Share",
      type: "per_percentage",
      hourlyRate: 0,
      percentageRate: 0.4,
      isDefault: false,
    })

    const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
    const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Revenue Share",
        type: "per_percentage",
        hourlyRate: 0,
        percentageRate: 0.4,
        paydayWeekday: 5,
        creditCapCents: 0,
        currency: "ARS",
      }),
    }))

    expect(res.status).toBe(201)
    expect(mockPrisma.staffPaymentModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "school_1",
        name: "Revenue Share",
        type: "per_percentage",
        hourlyRate: 0,
        percentageRate: 0.4,
        active: true,
      }),
      include: { defaultPaymentMethod: true },
    })
  })

  it("defaults hourlyRate to 0 for per_percentage when omitted", async () => {
    mockPrisma.staffPaymentModel.create.mockResolvedValueOnce({
      id: "model_pct_auto",
      name: "Revenue Share Auto",
      type: "per_percentage",
      hourlyRate: 0,
      percentageRate: 0.5,
      isDefault: false,
    })

    const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
    const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Revenue Share Auto",
        type: "per_percentage",
        percentageRate: 0.5,
        paydayWeekday: 5,
        creditCapCents: 0,
        currency: "ARS",
      }),
    }))

    expect(res.status).toBe(201)
    expect(mockPrisma.staffPaymentModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Revenue Share Auto",
        type: "per_percentage",
        hourlyRate: 0,
        percentageRate: 0.5,
      }),
      include: { defaultPaymentMethod: true },
    })
  })

  it("creates a hybrid model with both hourlyRate and percentageRate", async () => {
    mockPrisma.staffPaymentModel.create.mockResolvedValueOnce({
      id: "model_hyb",
      name: "Hybrid Teacher",
      type: "hybrid",
      hourlyRate: 500,
      percentageRate: 0.2,
      isDefault: false,
    })

    const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
    const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Hybrid Teacher",
        type: "hybrid",
        hourlyRate: 500,
        percentageRate: 0.2,
        paydayWeekday: 3,
        creditCapCents: 1000,
        currency: "ARS",
      }),
    }))

    expect(res.status).toBe(201)
    expect(mockPrisma.staffPaymentModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Hybrid Teacher",
        type: "hybrid",
        hourlyRate: 500,
        percentageRate: 0.2,
      }),
      include: { defaultPaymentMethod: true },
    })
  })

  it("rejects per_percentage model without percentageRate", async () => {
    const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
    const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bad Model",
        type: "per_percentage",
        hourlyRate: 0,
        paydayWeekday: 5,
        creditCapCents: 0,
        currency: "ARS",
      }),
    }))

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: "Percentage rate must be between 0 and 1 (e.g. 0.40 for 40%)",
      details: { field: "percentageRate" },
    })
  })

  it("rejects invalid model type", async () => {
    const { POST } = await import("@/app/api/staff/payroll/payment-models/route")
    const res = await POST(new Request("http://localhost/api/staff/payroll/payment-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bad Type",
        type: "flat_fee",
        hourlyRate: 100,
        paydayWeekday: 5,
        creditCapCents: 0,
        currency: "ARS",
      }),
    }))

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: "Type must be per_hour, per_percentage, or hybrid",
      details: { field: "type" },
    })
  })

  it("patches a model to add percentageRate via PATCH", async () => {
    mockPrisma.staffPaymentModel.update.mockResolvedValueOnce({
      id: "model_1",
      type: "hybrid",
      percentageRate: 0.35,
    })

    const { PATCH } = await import("@/app/api/staff/payroll/payment-models/[modelId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/staff/payroll/payment-models/model_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hybrid", percentageRate: 0.35 }),
      }),
      { params: Promise.resolve({ modelId: "model_1" }) }
    )

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPaymentModel.update).toHaveBeenCalledWith({
      where: { id: "model_1" },
      data: { type: "hybrid", percentageRate: 0.35 },
      include: { defaultPaymentMethod: true },
    })
  })
})
