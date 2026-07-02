import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Shared mock functions ────────────────────────────────────────────────────
const mockAuthorizeStaffPortalRequest = vi.fn()
const mockAuthorizeStaffPortalBaseRequest = vi.fn()
const mockResolveSchoolIdForClerkUser = vi.fn()
const mockDispatch = vi.fn()

const mockPrisma = {
  staffPayrollEntry: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
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

// ─── Module mocks ─────────────────────────────────────────────────────────────
vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizeStaffPortalRequest(...args),
  authorizeStaffPortalBaseRequest: (...args: unknown[]) => mockAuthorizeStaffPortalBaseRequest(...args),
}))

vi.mock("@/lib/payroll/route-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payroll/route-helpers")>("@/lib/payroll/route-helpers")
  return {
    ...actual,
    resolveSchoolIdForClerkUser: (...args: unknown[]) => mockResolveSchoolIdForClerkUser(...args),
  }
})

vi.mock("@/lib/payroll/adapters/registry", () => ({
  VALID_ADAPTER_TYPES: ["cash", "bank_transfer", "credits"],
  getAdapter: vi.fn(() => ({ dispatch: mockDispatch })),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

// ─── Shared fixtures ──────────────────────────────────────────────────────────
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

const paidEntry = {
  id: "entry_1",
  status: "paid",
  staffAccountId: "staff_1",
  totalAmount: 10_000,
  currency: "ARS",
  paymentMethodId: "method_1",
  paymentModel: { schoolId: "school_1" },
}

// ─── Request helpers ──────────────────────────────────────────────────────────
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

const postAccept = async (entryId = "entry_1") => {
  const { POST } = await import("@/app/api/staff/payroll/entries/[entryId]/accept-partial/route")
  return POST(
    new Request(`http://localhost/api/staff/payroll/entries/${entryId}/accept-partial`, { method: "POST" }),
    { params: Promise.resolve({ entryId }) }
  )
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

const postPay = async (body: unknown = {}, entryId = "entry_1") => {
  const { POST } = await import("@/app/api/staff/payroll/entries/[entryId]/pay/route")
  return POST(
    new Request(`http://localhost/api/staff/payroll/entries/${entryId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ entryId }) }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// propose-partial
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /entries/[entryId]/propose-partial", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeStaffPortalRequest.mockReset()
    mockPrisma.staffPayrollEntry.findUnique.mockReset()
    mockPrisma.staffPayrollEntry.update.mockReset()
    mockPrisma.staffPayrollAudit.create.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "manager_1", role: "admin", category: "manager" })
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(pendingEntry)
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
    mockPrisma.staffPayrollEntry.update.mockResolvedValue({ ...pendingEntry, status: "partial_proposed", proposedAmount: 4_000, proposedBy: "manager_1", notes: "Cash flow split" })
    mockPrisma.staffPayrollAudit.create.mockResolvedValue({ id: "audit_1" })
  })

  it("returns 401 when auth fails before touching the database", async () => {
    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const res = await postPropose()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(mockPrisma.staffPayrollEntry.findUnique).not.toHaveBeenCalled()
  })

  it("rejects a missing proposedAmount with 422", async () => {
    const res = await postPropose({ note: "No amount" })

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: "proposedAmount is required" })
    expect(mockPrisma.staffPayrollEntry.findUnique).not.toHaveBeenCalled()
  })

  it("rejects proposedAmount of zero with 422", async () => {
    const res = await postPropose({ proposedAmount: 0 })

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "proposedAmount must be greater than 0", details: { field: "proposedAmount" } })
    expect(mockPrisma.staffPayrollEntry.findUnique).not.toHaveBeenCalled()
  })

  it("rejects proposedAmount equal to totalAmount with 422", async () => {
    const res = await postPropose({ proposedAmount: 10_000 })

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "proposedAmount must be less than totalAmount", details: { field: "proposedAmount" } })
  })

  it("returns 404 when the entry does not exist", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(null)

    const res = await postPropose()

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Entry not found" })
  })

  it("returns 409 when a partial proposal is already present", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...pendingEntry, status: "partial_proposed" })

    const res = await postPropose()

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "Entry already has a partial payment proposed" })
  })

  it("returns 422 when the entry status is not pending", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...pendingEntry, status: "paid" })

    const res = await postPropose()

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "Entry must have status 'pending' to propose partial payment" })
  })

  it("stores the partial proposal and audit entry on success", async () => {
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

  it("stores the proposal without a note when none is provided", async () => {
    mockPrisma.staffPayrollEntry.update.mockResolvedValue({ ...pendingEntry, status: "partial_proposed", proposedAmount: 3_000, proposedBy: "manager_1", notes: null })

    const res = await postPropose({ proposedAmount: 3_000 })

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({
      where: { id: "entry_1" },
      data: expect.objectContaining({ proposedAmount: 3_000, notes: null }),
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// accept-partial
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /entries/[entryId]/accept-partial", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeStaffPortalBaseRequest.mockReset()
    mockDispatch.mockReset()
    mockPrisma.staffPayrollEntry.findUnique.mockReset()
    mockPrisma.staffPayrollEntry.update.mockReset()
    mockPrisma.staffPayrollAudit.create.mockReset()
    mockPrisma.staffPaymentMethod.findUnique.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuthorizeStaffPortalBaseRequest.mockResolvedValue({ ok: true, userId: "staff_user_1" })
    mockDispatch.mockResolvedValue({ ok: true })
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(partialEntry)
    mockPrisma.staffPaymentMethod.findUnique.mockResolvedValue({ adapterType: "cash" })
    mockPrisma.staffPayrollEntry.update.mockImplementation(({ data }: { data: { status: string } }) => {
      if (data.status === "processing") return Promise.resolve({ ...partialEntry, status: "processing" })
      if (data.status === "paid") return Promise.resolve({ ...partialEntry, status: "paid", paidAmount: 4_000 })
      if (data.status === "pending") return Promise.resolve({ ...partialEntry, status: "pending" })
      return Promise.resolve({ ...partialEntry, ...data })
    })
    mockPrisma.staffPayrollAudit.create.mockResolvedValue({ id: "audit_1" })
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  })

  it("returns 401 when base auth fails before reading the entry", async () => {
    mockAuthorizeStaffPortalBaseRequest.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const res = await postAccept()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(mockPrisma.staffPayrollEntry.findUnique).not.toHaveBeenCalled()
  })

  it("returns 404 when the entry does not exist", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(null)

    const res = await postAccept()

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Entry not found" })
  })

  it("returns 422 when the entry is not in partial_proposed status", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...partialEntry, status: "pending" })

    const res = await postAccept()

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "Entry is not in partial_proposed status" })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("returns 403 when a different staff member tries to accept", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({
      ...partialEntry,
      staffAccount: { clerkUserId: "other_staff" },
    })

    const res = await postAccept()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Only the staff member who owns this entry can accept the partial payment" })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("returns 400 when the entry has no proposed amount", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({
      ...partialEntry,
      proposedAmount: null,
    })

    const res = await postAccept()

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "No proposed amount found" })
  })

  it("rolls back to pending and returns 500 when the payment dispatch fails", async () => {
    mockDispatch.mockResolvedValue({ ok: false, error: "Gateway rejected payment" })

    const res = await postAccept()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Gateway rejected payment" })
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({ where: { id: "entry_1" }, data: { status: "processing" } })
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({ where: { id: "entry_1" }, data: { status: "pending" } })
  })

  it("dispatches and marks the entry paid when the owner accepts", async () => {
    const res = await postAccept()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: "entry_1", status: "paid", paidAmount: 4_000 })
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entry_1", proposedAmount: 4_000 }),
      4_000,
      "staff_user_1"
    )
    expect(mockPrisma.staffPayrollAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryId: "entry_1",
        staffAccountId: "staff_1",
        type: "PARTIAL_ACCEPTED",
        actorClerkUserId: "staff_user_1",
      }),
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// reject-partial
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /entries/[entryId]/reject-partial", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeStaffPortalBaseRequest.mockReset()
    mockPrisma.staffPayrollEntry.findUnique.mockReset()
    mockPrisma.staffPayrollEntry.update.mockReset()
    mockPrisma.staffPayrollAudit.create.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuthorizeStaffPortalBaseRequest.mockResolvedValue({ ok: true, userId: "staff_user_1" })
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(partialEntry)
    mockPrisma.staffPayrollEntry.update.mockResolvedValue({
      ...partialEntry,
      status: "pending",
      proposedAmount: null,
      proposedBy: null,
      rejectionNote: "Prefer full payment",
    })
    mockPrisma.staffPayrollAudit.create.mockResolvedValue({ id: "audit_1" })
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  })

  it("returns 401 when base auth fails before reading the entry", async () => {
    mockAuthorizeStaffPortalBaseRequest.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const res = await postReject()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(mockPrisma.staffPayrollEntry.findUnique).not.toHaveBeenCalled()
  })

  it("returns 404 when the entry does not exist", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(null)

    const res = await postReject()

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Entry not found" })
  })

  it("returns 422 when the entry is not in partial_proposed status", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...partialEntry, status: "pending" })

    const res = await postReject()

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "Entry is not in partial_proposed status" })
    expect(mockPrisma.staffPayrollEntry.update).not.toHaveBeenCalled()
  })

  it("returns 403 when a different staff member tries to reject", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({
      ...partialEntry,
      staffAccount: { clerkUserId: "other_staff" },
    })

    const res = await postReject()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Only the staff member who owns this entry can reject the partial payment" })
    expect(mockPrisma.staffPayrollEntry.update).not.toHaveBeenCalled()
  })

  it("restores the entry to pending and writes an audit entry on success", async () => {
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

  it("uses a default rejection message when no reason is provided", async () => {
    const res = await postReject({})

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPayrollAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: "Partial payment rejected by staff member",
      }),
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// pay (full payment)
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /entries/[entryId]/pay", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeStaffPortalRequest.mockReset()
    mockResolveSchoolIdForClerkUser.mockReset()
    mockDispatch.mockReset()
    mockPrisma.staffPayrollEntry.findUnique.mockReset()
    mockPrisma.staffPayrollEntry.findFirst.mockReset()
    mockPrisma.staffPayrollEntry.update.mockReset()
    mockPrisma.staffPayrollAudit.create.mockReset()
    mockPrisma.staffPaymentMethod.findUnique.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "manager_1", role: "admin", category: "manager" })
    mockResolveSchoolIdForClerkUser.mockResolvedValue("school_1")
    mockDispatch.mockResolvedValue({ ok: true, reference: "ref_abc" })
    mockPrisma.staffPayrollEntry.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "entry_1") {
        // Second call (after update) returns the paid snapshot
        const calls = mockPrisma.staffPayrollEntry.findUnique.mock.calls.length
        if (calls > 1) return Promise.resolve({ ...paidEntry, status: "paid", paidAmount: 10_000 })
      }
      return Promise.resolve({ ...paidEntry, status: "pending" })
    })
    mockPrisma.staffPayrollEntry.findFirst.mockResolvedValue(null)
    mockPrisma.staffPaymentMethod.findUnique.mockResolvedValue({ adapterType: "cash" })
    mockPrisma.staffPayrollEntry.update.mockResolvedValue({ ...paidEntry, status: "processing" })
    mockPrisma.staffPayrollAudit.create.mockResolvedValue({ id: "audit_1" })
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  })

  it("returns 401 when auth fails before reading the entry", async () => {
    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const res = await postPay()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(mockPrisma.staffPayrollEntry.findUnique).not.toHaveBeenCalled()
  })

  it("returns 404 when the entry does not exist", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(null)

    const res = await postPay()

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Entry not found" })
  })

  it("returns 409 when the entry is already paid", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...paidEntry, status: "paid" })

    const res = await postPay()

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "Entry already paid" })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("returns 422 when the entry is cancelled", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...paidEntry, status: "cancelled" })

    const res = await postPay()

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "Entry is cancelled or reversed" })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("returns 422 when the entry is reversed", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...paidEntry, status: "reversed" })

    const res = await postPay()

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "Entry is cancelled or reversed" })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("returns 409 when the entry status is not pending or partial_proposed", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...paidEntry, status: "processing" })

    const res = await postPay()

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "Entry status must be pending or partial_proposed" })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("returns 404 when the entry belongs to a different school", async () => {
    mockResolveSchoolIdForClerkUser.mockResolvedValue("other_school")

    const res = await postPay()

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Entry not found" })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("returns an idempotent paid response when the same key was already processed", async () => {
    mockPrisma.staffPayrollEntry.findFirst.mockResolvedValue({ id: "entry_1" })

    const res = await postPay({ idempotencyKey: "idem_key_1" })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: "entry_1", message: "Idempotent response", status: "paid" })
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("rolls back to pending and returns 500 when the payment dispatch fails", async () => {
    mockDispatch.mockResolvedValue({ ok: false, error: "Gateway timeout" })

    const res = await postPay()

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Gateway timeout" })
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({
      where: { id: "entry_1" },
      data: { status: "processing" },
    })
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({
      where: { id: "entry_1" },
      data: { status: "pending" },
    })
  })

  it("dispatches, marks the entry paid, and writes an audit entry on success", async () => {
    const res = await postPay()

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({
      where: { id: "entry_1" },
      data: { status: "processing" },
    })
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ id: "entry_1", totalAmount: 10_000 }),
      10_000,
      "manager_1"
    )
    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "entry_1" },
        data: expect.objectContaining({ status: "paid", paidBy: "manager_1", paidAmount: 10_000 }),
      })
    )
    expect(mockPrisma.staffPayrollAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryId: "entry_1",
        staffAccountId: "staff_1",
        type: "PAID",
        actorClerkUserId: "manager_1",
      }),
    })
  })

  it("accepts an explicit paymentMethodId override in the request body", async () => {
    const res = await postPay({ paymentMethodId: "method_override" })

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPaymentMethod.findUnique).toHaveBeenCalledWith({
      where: { id: "method_override" },
      select: { adapterType: true },
    })
  })

  it("accepts a partial_proposed entry for full payment", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...paidEntry, status: "partial_proposed" })

    const res = await postPay()

    expect(res.status).toBe(200)
    expect(mockDispatch).toHaveBeenCalled()
  })
})
