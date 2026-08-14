import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffPortalRequest = vi.fn()
const mockResolveSchoolIdForClerkUser = vi.fn()
const mockCloseOpenClockEntriesForPayroll = vi.fn()
const mockDeriveHoursWorked = vi.fn()

const mockPrisma = {
  staffAccount: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  staffPaymentModel: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  staffUnavailabilityRequest: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  staffPayrollEntry: {
    create: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizeStaffPortalRequest(...args),
}))

vi.mock("@/lib/payroll/route-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payroll/route-helpers")>("@/lib/payroll/route-helpers")
  return {
    ...actual,
    resolveSchoolIdForClerkUser: (...args: unknown[]) => mockResolveSchoolIdForClerkUser(...args),
  }
})

vi.mock("@/lib/payroll/auto-closure", () => ({
  closeOpenClockEntriesForPayroll: (...args: unknown[]) => mockCloseOpenClockEntriesForPayroll(...args),
}))

vi.mock("@/lib/payroll/hours", () => ({
  deriveHoursWorked: (...args: unknown[]) => mockDeriveHoursWorked(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const postRunPayday = async (
  body: unknown = {
    periodStart: "2026-06-08T00:00:00.000Z",
    periodEnd: "2026-06-12T23:59:59.000Z",
  }
) => {
  const { POST } = await import("@/app/api/staff/payroll/run-payday/route")
  return POST(
    new Request("http://localhost/api/staff/payroll/run-payday", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )
}

const defaultPaymentModel = {
  id: "model_default",
  hourlyRate: 25,
  currency: "ARS",
  defaultPaymentMethodId: "method_cash",
  paydayWeekday: 5,
}

describe("staff payroll run-payday route", () => {
  beforeEach(() => {
    mockAuthorizeStaffPortalRequest.mockReset()
    mockResolveSchoolIdForClerkUser.mockReset()
    mockCloseOpenClockEntriesForPayroll.mockReset()
    mockDeriveHoursWorked.mockReset()
    mockPrisma.staffAccount.findMany.mockReset()
    mockPrisma.staffAccount.findUnique.mockReset()
    mockPrisma.staffPaymentModel.findUnique.mockReset()
    mockPrisma.staffPaymentModel.findFirst.mockReset()
    mockPrisma.staffUnavailabilityRequest.count.mockReset()
    mockPrisma.staffUnavailabilityRequest.findMany.mockReset()
    mockPrisma.staffPayrollEntry.create.mockReset()

    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "manager_1", role: "admin", category: "manager" })
    mockResolveSchoolIdForClerkUser.mockResolvedValue("school_1")
    mockPrisma.staffAccount.findMany.mockResolvedValue([{ id: "staff_1", paymentModelId: null }])
    mockPrisma.staffAccount.findUnique.mockResolvedValue({ paymentModelId: null })
    mockPrisma.staffPaymentModel.findUnique.mockResolvedValue(null)
    mockPrisma.staffPaymentModel.findFirst.mockResolvedValue(defaultPaymentModel)
    mockPrisma.staffUnavailabilityRequest.count.mockResolvedValue(0)
    // Suspension check moved to a batched findMany returning suspended staff ids.
    mockPrisma.staffUnavailabilityRequest.findMany.mockResolvedValue([])
    mockCloseOpenClockEntriesForPayroll.mockResolvedValue(undefined)
    mockDeriveHoursWorked.mockResolvedValue({ hoursWorked: 8 })
    mockPrisma.staffPayrollEntry.create.mockResolvedValue({ id: "entry_1" })
  })

  it("returns auth failure before parsing payroll inputs", async () => {
    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const res = await postRunPayday()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(mockPrisma.staffAccount.findMany).not.toHaveBeenCalled()
  })

  it("validates period dates before reading staff accounts", async () => {
    const res = await postRunPayday({
      periodStart: "2026-06-12T00:00:00.000Z",
      periodEnd: "2026-06-08T00:00:00.000Z",
    })

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "Period start must be before period end" })
    expect(mockPrisma.staffAccount.findMany).not.toHaveBeenCalled()
  })

  it("skips staff without an effective payment model", async () => {
    mockPrisma.staffPaymentModel.findFirst.mockResolvedValue(null)

    const res = await postRunPayday()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      created: 0,
      skipped: [],
      errors: [{ staffId: "staff_1", error: "No payment model found for staff member" }],
    })
    expect(mockPrisma.staffPayrollEntry.create).not.toHaveBeenCalled()
  })

  it("skips suspended staff for the payroll period", async () => {
    mockPrisma.staffUnavailabilityRequest.findMany.mockResolvedValue([{ staffAccountId: "staff_1" }])

    const res = await postRunPayday()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      created: 0,
      skipped: [{ staffId: "staff_1", reason: "Approved suspension overlaps with period" }],
      errors: [],
    })
    expect(mockPrisma.staffPayrollEntry.create).not.toHaveBeenCalled()
  })

  it("counts eligible entries in dry-run mode without creating payroll entries", async () => {
    const res = await postRunPayday({
      periodStart: "2026-06-08T00:00:00.000Z",
      periodEnd: "2026-06-12T23:59:59.000Z",
      dryRun: true,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ created: 1, skipped: [], errors: [] })
    expect(mockCloseOpenClockEntriesForPayroll).not.toHaveBeenCalled()
    expect(mockDeriveHoursWorked).not.toHaveBeenCalled()
    expect(mockPrisma.staffPayrollEntry.create).not.toHaveBeenCalled()
  })

  it("creates pending payroll entries for eligible staff once payday is reached", async () => {
    const res = await postRunPayday()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ created: 1, skipped: [], errors: [] })
    expect(mockCloseOpenClockEntriesForPayroll).toHaveBeenCalledWith(mockPrisma, {
      staffAccountId: "staff_1",
      periodStart: new Date("2026-06-08T00:00:00.000Z"),
      periodEnd: new Date("2026-06-12T23:59:59.000Z"),
      source: "payroll-run-payday",
    })
    expect(mockDeriveHoursWorked).toHaveBeenCalledWith(
      mockPrisma,
      "staff_1",
      new Date("2026-06-08T00:00:00.000Z"),
      new Date("2026-06-12T23:59:59.000Z")
    )
    expect(mockPrisma.staffPayrollEntry.create).toHaveBeenCalledWith({
      data: {
        staffAccountId: "staff_1",
        periodStart: new Date("2026-06-08T00:00:00.000Z"),
        periodEnd: new Date("2026-06-12T23:59:59.000Z"),
        hoursWorked: 8,
        hourlyRate: 25,
        grossAmount: 20_000,
        bonusAmount: 0,
        totalAmount: 20_000,
        currency: "ARS",
        status: "pending",
        paymentMethodId: "method_cash",
        paymentModelId: "model_default",
      },
    })
  })
})
