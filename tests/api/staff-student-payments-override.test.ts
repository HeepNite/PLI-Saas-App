import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdmin = vi.fn()
const mockWriteAudit = vi.fn()

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  purchase: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: (...args: unknown[]) => mockAuthorizeOwnerOrAdmin(...args),
}))

vi.mock("@/lib/audit/student-data-audit", () => ({
  writeStudentDataAudit: (...args: unknown[]) => mockWriteAudit(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

const USER_ID = "user_student_1"
const PURCHASE_ID = "purchase_1"

describe("PATCH /api/staff/students/[userId]/payments", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeOwnerOrAdmin.mockReset()
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: true, userId: "user_owner_1", role: "owner", category: null })
    mockWriteAudit.mockReset()
    mockWriteAudit.mockResolvedValue(undefined)

    mockPrisma.user.findUnique.mockReset()
    mockPrisma.purchase.findUnique.mockReset()
    mockPrisma.purchase.update.mockReset()
    mockPrisma.$transaction.mockReset()

    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, name: "Test Student" })
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: USER_ID,
      amount: 10000,
      status: "pending",
      metadata: { settlementStatus: "pending", outstandingBalance: 10000, paymentMethod: "cash" },
    })
  })

  it("returns 403 when authorization fails", async () => {
    mockAuthorizeOwnerOrAdmin.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: PURCHASE_ID, reason: "Test" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(403)
  })

  it("returns 400 when purchaseId is missing", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Test" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "purchaseId is required." })
  })

  it("returns 400 when reason is missing", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: PURCHASE_ID }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Reason is required (max 500 characters)." })
  })

  it("returns 400 when no valid fields to update", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: PURCHASE_ID, reason: "Test", invalidField: "value" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "No valid fields to update." })
  })

  it("returns 400 when amount is invalid", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: PURCHASE_ID, reason: "Test", amount: -100 }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Amount must be a non-negative integer (cents)." })
  })

  it("returns 400 when amount is not an integer", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: PURCHASE_ID, reason: "Test", amount: 100.5 }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
  })

  it("returns 400 when settlementStatus is invalid", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: PURCHASE_ID, reason: "Test", settlementStatus: "invalid" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid settlementStatus") })
  })

  it("returns 400 when paymentMethod is invalid", async () => {
    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: PURCHASE_ID, reason: "Test", paymentMethod: "bitcoin" }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("Invalid paymentMethod") })
  })

  it("updates amount and recalculates balance", async () => {
    mockPrisma.purchase.update.mockResolvedValue({
      id: PURCHASE_ID,
      amount: 8000,
      status: "pending",
      metadata: { settlementStatus: "pending", outstandingBalance: 8000, paymentMethod: "cash" },
    })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: PURCHASE_ID,
          reason: "Corrected amount",
          amount: 8000,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(mockPrisma.purchase.update).toHaveBeenCalled()
  })

  it("marks as paid and clears balance", async () => {
    mockPrisma.purchase.update.mockResolvedValue({
      id: PURCHASE_ID,
      amount: 10000,
      status: "paid",
      metadata: { settlementStatus: "paid", outstandingBalance: 0, paymentMethod: "cash", settledAt: expect.any(String) },
    })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: PURCHASE_ID,
          reason: "Marked as paid",
          settlementStatus: "paid",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
  })

  it("returns 403 when purchase does not belong to student", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: PURCHASE_ID,
      userId: "other_student",
      amount: 10000,
      status: "pending",
      metadata: {},
    })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: PURCHASE_ID,
          reason: "Test",
          amount: 8000,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: "Purchase does not belong to this student." })
  })

  it("returns 404 when purchase not found", async () => {
    mockPrisma.purchase.findUnique.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: PURCHASE_ID,
          reason: "Test",
          amount: 8000,
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(404)
  })

  it("updates payment method", async () => {
    mockPrisma.purchase.update.mockResolvedValue({
      id: PURCHASE_ID,
      amount: 10000,
      status: "pending",
      metadata: { settlementStatus: "pending", outstandingBalance: 10000, paymentMethod: "card" },
    })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      return fn(mockPrisma)
    })

    const { PATCH } = await import("@/app/api/staff/students/[userId]/payments/route")
    const res = await PATCH(
      new Request(`http://localhost/api/staff/students/${USER_ID}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: PURCHASE_ID,
          reason: "Fixed payment method",
          paymentMethod: "card",
        }),
      }),
      { params: Promise.resolve({ userId: USER_ID }) }
    )

    expect(res.status).toBe(200)
  })
})
