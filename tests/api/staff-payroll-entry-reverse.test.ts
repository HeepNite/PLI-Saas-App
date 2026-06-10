import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerRequest = vi.fn()

const mockPrisma = {
  staffPayrollEntry: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  staffPayrollAudit: {
    create: vi.fn(),
  },
  staffCreditLedgerEntry: {
    create: vi.fn(),
  },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerRequest: (...args: unknown[]) => mockAuthorizeOwnerRequest(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const paidEntry = {
  id: "entry_1",
  staffAccountId: "staff_1",
  status: "paid",
  paidAt: new Date("2026-06-01T12:00:00.000Z"),
  paymentMethodId: "method_1",
  paymentMethod: { adapterType: "bank_transfer" },
}

const reversedEntry = {
  ...paidEntry,
  status: "reversed",
  reversedBy: "owner_1",
  reversalReason: "Duplicate payout",
}

const postReverse = async (body: unknown = { reason: "Duplicate payout" }, entryId = "entry_1") => {
  const { POST } = await import("@/app/api/staff/payroll/entries/[entryId]/reverse/route")
  return POST(
    new Request("http://localhost/api/staff/payroll/entries/entry_1/reverse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ entryId }) }
  )
}

describe("staff payroll entry reverse route", () => {
  beforeEach(() => {
    mockAuthorizeOwnerRequest.mockReset()
    mockPrisma.staffPayrollEntry.findUnique.mockReset()
    mockPrisma.staffPayrollEntry.update.mockReset()
    mockPrisma.staffPayrollAudit.create.mockReset()
    mockPrisma.staffCreditLedgerEntry.create.mockReset()
    mockPrisma.$executeRaw.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuthorizeOwnerRequest.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner", category: "manager" })
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(paidEntry)
    mockPrisma.staffPayrollEntry.update.mockResolvedValue(reversedEntry)
    mockPrisma.staffPayrollAudit.create.mockResolvedValue({ id: "audit_1" })
    mockPrisma.staffCreditLedgerEntry.create.mockResolvedValue({ id: "ledger_1" })
    mockPrisma.$executeRaw.mockResolvedValue(1)
    mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
  })

  it("returns auth failure before reading the entry", async () => {
    mockAuthorizeOwnerRequest.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" })

    const res = await postReverse()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Forbidden" })
    expect(mockPrisma.staffPayrollEntry.findUnique).not.toHaveBeenCalled()
  })

  it("requires a non-empty reversal reason", async () => {
    const res = await postReverse({ reason: "   " })

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "Reason is required" })
    expect(mockPrisma.staffPayrollEntry.findUnique).not.toHaveBeenCalled()
  })

  it("returns 404 when the payroll entry does not exist", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue(null)

    const res = await postReverse()

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Entry not found" })
  })

  it("rejects entries that are not paid", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...paidEntry, status: "pending" })

    const res = await postReverse()

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "Entry must be paid to reverse" })
  })

  it("rejects entries that are already reversed", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({ ...paidEntry, status: "reversed" })

    const res = await postReverse()
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "Entry is already reversed" })
  })

  it("reverses a paid non-credit payroll entry without creating credit ledger entries", async () => {
    const res = await postReverse()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: "entry_1", status: "reversed", reversalReason: "Duplicate payout" })
    expect(mockPrisma.staffPayrollEntry.update).toHaveBeenCalledWith({
      where: { id: "entry_1" },
      data: expect.objectContaining({
        status: "reversed",
        reversedBy: "owner_1",
        reversalReason: "Duplicate payout",
      }),
    })
    expect(mockPrisma.staffPayrollAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryId: "entry_1",
        staffAccountId: "staff_1",
        type: "REVERSAL",
        actorClerkUserId: "owner_1",
        reason: "Duplicate payout",
      }),
    })
    expect(mockPrisma.staffCreditLedgerEntry.create).not.toHaveBeenCalled()
    expect(mockPrisma.$executeRaw).toHaveBeenCalled()
  })

  it("creates a credit ledger reversal when reversing a credits payout", async () => {
    mockPrisma.staffPayrollEntry.findUnique.mockResolvedValue({
      ...paidEntry,
      paymentMethod: { adapterType: "credits" },
    })

    const res = await postReverse()

    expect(res.status).toBe(200)
    expect(mockPrisma.staffCreditLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        staffAccountId: "staff_1",
        type: "REVERSAL",
        amount: 0,
        note: "Reversal of payroll entry entry_1",
        eventKey: "payroll-reversal-entry_1",
        awardedBy: "owner_1",
      },
    })
  })
})
