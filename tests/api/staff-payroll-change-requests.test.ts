import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffPortalRequest = vi.fn()

const mockPrisma = {
  staffPaymentChangeRequest: {
    findMany: vi.fn(),
  },
  staffAccount: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizeStaffPortalRequest(...args),
  authorizeStaffPortalBaseRequest: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff payroll change requests route", () => {
  beforeEach(() => {
    mockAuthorizeStaffPortalRequest.mockReset()
    mockPrisma.staffPaymentChangeRequest.findMany.mockReset()
    mockPrisma.staffAccount.findMany.mockReset()
    mockPrisma.staffAccount.findUnique.mockReset()
    mockPrisma.staffAccount.update.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuthorizeStaffPortalRequest.mockResolvedValue({ ok: true, userId: "manager_1", role: "admin", category: "manager" })
  })

  it("lists change requests without relying on a Prisma relation include", async () => {
    mockPrisma.staffPaymentChangeRequest.findMany.mockResolvedValueOnce([
      {
        id: "req_1",
        staffAccountId: "staff_1",
        requestedMethod: "direct_deposit",
        requestedInfo: { cbu: "123" },
        reason: "Updated bank",
        status: "pending",
        createdAt: new Date("2026-04-13T10:00:00.000Z"),
      },
    ])
    mockPrisma.staffAccount.findMany.mockResolvedValueOnce([
      {
        id: "staff_1",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
      },
    ])

    const { GET } = await import("@/app/api/staff/payroll/change-requests/route")
    const res = await GET()

    expect(res.status).toBe(200)
    expect(mockPrisma.staffPaymentChangeRequest.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        staffAccountId: true,
        requestedMethod: true,
        requestedInfo: true,
        reason: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })
    expect(mockPrisma.staffAccount.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["staff_1"] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    })
    expect(await res.json()).toEqual({
      items: [
        {
          id: "req_1",
          staffAccountId: "staff_1",
          requestedMethod: "direct_deposit",
          requestedInfo: { cbu: "123" },
          reason: "Updated bank",
          status: "pending",
          createdAt: "2026-04-13T10:00:00.000Z",
          staffAccount: {
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@example.com",
          },
        },
      ],
    })
  })

  it("keeps returning items when a change request points to a missing staff account", async () => {
    mockPrisma.staffPaymentChangeRequest.findMany.mockResolvedValueOnce([
      {
        id: "req_orphan",
        staffAccountId: "staff_missing",
        requestedMethod: "cash",
        requestedInfo: {},
        reason: null,
        status: "pending",
        createdAt: new Date("2026-04-13T10:00:00.000Z"),
      },
    ])
    mockPrisma.staffAccount.findMany.mockResolvedValueOnce([])

    const { GET } = await import("@/app/api/staff/payroll/change-requests/route")
    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      items: [
        {
          id: "req_orphan",
          staffAccountId: "staff_missing",
          requestedMethod: "cash",
          requestedInfo: {},
          reason: null,
          status: "pending",
          createdAt: "2026-04-13T10:00:00.000Z",
          staffAccount: {
            firstName: "",
            lastName: "",
            email: "",
          },
        },
      ],
    })
  })
})
