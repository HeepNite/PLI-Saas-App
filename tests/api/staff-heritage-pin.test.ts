import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStudentOperationalRequest = vi.fn()
const mockWriteStudentDataAudit = vi.fn()

const mockPrisma = {
  purchase: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStudentOperationalRequest: (...args: unknown[]) => mockAuthorizeStudentOperationalRequest(...args),
}))
vi.mock("@/lib/audit/student-data-audit", () => ({
  writeStudentDataAudit: (...args: unknown[]) => mockWriteStudentDataAudit(...args),
}))
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

const pendingMetadata = {
  paymentChannel: "card",
  heritagePinCampaign: "latin-heritage-2026",
  heritagePinCountryCode: "CO",
  heritagePinStatus: "pending",
  heritagePinEarnedAt: "2026-10-04T15:00:00.000Z",
  heritagePinSource: "public_booking",
}

const deliveredMetadata = {
  ...pendingMetadata,
  heritagePinStatus: "delivered",
  heritagePinDeliveredAt: "2026-10-05T15:00:00.000Z",
  heritagePinDeliveredBy: "staff_1",
}

const request = () => new Request("http://localhost/api/staff/students/user_1/heritage-pin", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ purchaseId: "purchase_1" }),
})

describe("staff Heritage pin delivery route", () => {
  beforeEach(() => {
    mockAuthorizeStudentOperationalRequest.mockReset()
    mockWriteStudentDataAudit.mockReset()
    mockPrisma.purchase.findFirst.mockReset()
    mockPrisma.purchase.findUnique.mockReset()
    mockPrisma.purchase.updateMany.mockReset()
    mockPrisma.$transaction.mockReset()
    mockAuthorizeStudentOperationalRequest.mockResolvedValue({
      ok: true,
      userId: "staff_1",
      role: "staff",
      category: "front_desk",
      staffName: "Front Desk",
    })
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
  })

  it("rejects callers without student operational permission", async () => {
    mockAuthorizeStudentOperationalRequest.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })
    const { POST } = await import("@/app/api/staff/students/[userId]/heritage-pin/route")
    const response = await POST(request(), { params: Promise.resolve({ userId: "user_1" }) })
    expect(response.status).toBe(403)
    expect(mockPrisma.purchase.findFirst).not.toHaveBeenCalled()
  })

  it("marks a pending physical pin delivered and audits the handoff", async () => {
    mockPrisma.purchase.findFirst.mockResolvedValue({
      id: "purchase_1",
      userId: "user_1",
      metadata: pendingMetadata,
      createdAt: new Date("2026-10-04T15:00:00.000Z"),
    })
    mockPrisma.purchase.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: "purchase_1",
      userId: "user_1",
      metadata: deliveredMetadata,
      createdAt: new Date("2026-10-04T15:00:00.000Z"),
    })

    const { POST } = await import("@/app/api/staff/students/[userId]/heritage-pin/route")
    const response = await POST(request(), { params: Promise.resolve({ userId: "user_1" }) })

    expect(response.status).toBe(200)
    expect(mockPrisma.purchase.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        metadata: expect.objectContaining({
          paymentChannel: "card",
          heritagePinStatus: "delivered",
          heritagePinDeliveredBy: "staff_1",
        }),
      },
    }))
    expect(mockWriteStudentDataAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: "user_1",
        entity: "profile",
        entityId: "purchase_1",
        field: "heritage_pin_delivery",
        staffClerkId: "staff_1",
      }),
      mockPrisma,
    )
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      idempotent: false,
      heritagePin: { status: "delivered", countryCode: "CO" },
    })
  })

  it("returns an already delivered handoff without another write or audit", async () => {
    mockPrisma.purchase.findFirst.mockResolvedValue({
      id: "purchase_1",
      userId: "user_1",
      metadata: deliveredMetadata,
      createdAt: new Date("2026-10-04T15:00:00.000Z"),
    })

    const { POST } = await import("@/app/api/staff/students/[userId]/heritage-pin/route")
    const response = await POST(request(), { params: Promise.resolve({ userId: "user_1" }) })

    expect(response.status).toBe(200)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockWriteStudentDataAudit).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ ok: true, idempotent: true })
  })

  it("rejects a purchase that belongs to another student", async () => {
    mockPrisma.purchase.findFirst.mockResolvedValue(null)
    const { POST } = await import("@/app/api/staff/students/[userId]/heritage-pin/route")
    const response = await POST(request(), { params: Promise.resolve({ userId: "user_1" }) })
    expect(response.status).toBe(404)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
