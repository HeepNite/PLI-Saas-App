import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffPortalRequest = vi.fn()
const mockAuthorizeStaffPortalBaseRequest = vi.fn()
const mockDispatch = vi.fn()

const mockPrisma = {
  staffPayrollEntry: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  staffPayrollAudit: {
    create: vi.fn(),
  },
  staffPaymentMethod: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizeStaffPortalRequest(...args),
  authorizeStaffPortalBaseRequest: (...args: unknown[]) => mockAuthorizeStaffPortalBaseRequest(...args),
}))

vi.mock("@/lib/payroll/adapters/registry", () => ({
  VALID_ADAPTER_TYPES: ["cash", "bank_transfer", "credits"],
  getAdapter: vi.fn(() => ({ dispatch: mockDispatch })),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const pendingEntry = {
  id: "entry_1",
  status: "pending",
  totalAmount: 10_000,
  staffAccountId: "staff_1",
}

const partialEntry = {
  id: "entry_1",
  status: "partial_proposed",
  staffAccountId: "staff_1",
  staffAccount: { clerkUserId: "staff_user_1" },
  proposedAmount: 4_000,
  proposedBy: "manager_1",
  totalAmount: 10_000,
  paymentMethodId: "method_1",
  currency: "ARS",
  periodStart: new Date("2026-06-01T00:00:00.000Z"),
  periodEnd: new Date("2026-06-30T00:00:00.000Z"),
  hoursWorked: 10,
  hourlyRate: 1_000,
  grossAmount: 10_000,
  bonusAmount: 0,
  paymentModelId: "model_1",
  idempotencyKey: "payroll-entry_1",
}

const proposedEntry = {
  ...pendingEntry,
  status: "partial_proposed",
  proposedAmount: 4_000,
  proposedBy: "manager_1",
  notes: "Cash flow split",
}

const paidPartialEntry = {
  ...partialEntry,
  status: "paid",
  paidAmount: 4_000,
  paidBy: "staff_user_1",
}

const rejectedPartialEntry = {
  ...partialEntry,
  status: "pending",
  proposedAmount: null,
  proposedBy: null,
  rejectionNote: "Prefer full payment",
}

const postPropose = async (body: unknown = { proposedAmount: 4_000, note: "Cash flow split" }) => {
  const { POST } = await import("@/app/api/staff/payroll/entries/[entryId]/propose-partial/route")
  return POST(
    new Request("http://localhost/api/staff/payroll/entries/entry_1/propose-partial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ entryId: "entry_1" }) }
  )
}

const postAccept = async () => {
  const { POST } = await import("@/app/api/staff/payroll/entries/[entryId]/accept-partial/route")
  return POST(new Request("http://localhost/api/staff/payroll/entries/entry_1/accept-partial", { method: "POST" }), {
    params: Promise.resolve({ entryId: "entry_1" }),
  })
}

const postReject = async (body: unknown = { reason: "Prefer full payment" }) => {
  const { POST } = await import("@/app/api/staff/payroll/entries/[entryId]/reject-partial/route")
  return POST(
    new Request("http://localhost/api/staff/payroll/entries/entry_1/reject-partial", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ entryId: "entry_1" }) }
  )
}

describe("staff payroll entry partial payment routes", () => {
  beforeEach(() => {
    mockAuthorizeStaffPortalRequest.mockReset()
    mockAuthorizeStaffPortalBaseRequest.mockReset()
    mockDispatch.mockReset()
    mockPrisma.staffPayrollEntry.findUnique.mockReset()
    mockPrisma.staffPayrollEntry.update.mockReset()
    mockPrisma.staffPayrollAudit.create.mockReset()
    mockPrisma.staffPaymentMethod.findUnique.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "manager_1", role: "admin", category: "manager" })
    mockAuthorizeStaffPortalBaseRequest.mockResolvedValue({ ok: true, userId: "staff_user_1" })
    mockDispatch.mockResolvedValue({ ok: true })
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(pendingEntry)
    mockPrisma.staffPayrollEntry.update.mockImplementation(({ data }) => {
      if (data.status === "partial_proposed") return Promise.resolve(proposedEntry)
      if (data.status === "processing") return Promise.resolve({ ...partialEntry, status: "processing" })
      if (data.status === "paid") return Promise.resolve(paidPartialEntry)
      if (data.status === "pending") return Promise.resolve(rejectedPartialEntry)
      return Promise.resolve({ ...partialEntry, ...data })
    })
    mockPrisma.staffPayrollAudit.create.mockResolvedValue({ id: "audit_1" })
    mockPrisma.staffPaymentMethod.findUnique.mockResolvedValue({ adapterType: "cash" })
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  })

  it("rejects partial proposals without a positive amount", async () => {
    const res = await postPropose({ proposedAmount: 0 })

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: "proposedAmount must be greater than 0",
      details: { field: "proposedAmount" },
    })
    expect(mockPrisma.staffPayrollEntry.findUnique).not.toHaveBeenCalled()
  })

  it("rejects partial proposals greater than or equal to the total amount", async () => {
    const res = await postPropose({ proposedAmount: 10_000 })

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: "proposedAmount must be less than totalAmount",
      details: { field: "proposedAmount" },
    })
  })

  it("stores a valid partial proposal and audit entry", async () => {
    const res = await postPropose()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: "entry_1", status: "partial_proposed", proposedAmount: 4_000 })
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({
      where: { id: "entry_1" },
      data: {
        status: "partial_proposed",
        proposedAmount: 4_000,
        proposedBy: "manager_1",
        notes: "Cash flow split",
      },
    })
    expect(mockPrisma.staffPayrollAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryId: "entry_1",
        staffAccountId: "staff_1",
        type: "PARTIAL_PROPOSED",
        actorClerkUserId: "manager_1",
      }),
    })
  })

  it("only lets the entry owner accept a partial proposal", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({
      ...partialEntry,
      staffAccount: { clerkUserId: "other_staff" },
    })

    const res = await postAccept()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Only the staff member who owns this entry can accept the partial payment" })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("rolls the entry back to pending when partial dispatch fails", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(partialEntry)
    mockDispatch.mockResolvedValue({ ok: false, error: "Gateway rejected payment" })

    const res = await postAccept()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Gateway rejected payment" })
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({
      where: { id: "entry_1" },
      data: { status: "processing" },
    })
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({
      where: { id: "entry_1" },
      data: { status: "pending" },
    })
  })

  it("dispatches and marks the entry paid when the owner accepts a partial proposal", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(partialEntry)

    const res = await postAccept()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: "entry_1", status: "paid", paidAmount: 4_000 })
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ id: "entry_1", proposedAmount: 4_000 }), 4_000, "staff_user_1")
    expect(mockPrisma.staffPayrollAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryId: "entry_1",
        staffAccountId: "staff_1",
        type: "PARTIAL_ACCEPTED",
        actorClerkUserId: "staff_user_1",
      }),
    })
  })

  it("only lets the entry owner reject a partial proposal", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({
      ...partialEntry,
      staffAccount: { clerkUserId: "other_staff" },
    })

    const res = await postReject()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Only the staff member who owns this entry can reject the partial payment" })
    expect(mockPrisma.staffPayrollEntry.update).not.toHaveBeenCalled()
  })

  it("restores pending state and writes audit when the owner rejects a partial proposal", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(partialEntry)

    const res = await postReject()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: "entry_1", status: "pending", proposedAmount: null })
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({
      where: { id: "entry_1" },
      data: {
        status: "pending",
        proposedAmount: null,
        proposedBy: null,
        rejectionNote: "Prefer full payment",
      },
    })
    expect(mockPrisma.staffPayrollAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryId: "entry_1",
        staffAccountId: "staff_1",
        type: "PARTIAL_REJECTED",
        actorClerkUserId: "staff_user_1",
        reason: "Prefer full payment",
      }),
    })
  })
})
