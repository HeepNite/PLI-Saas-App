import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortalBase = vi.fn()
const mockClerkClient = vi.fn()
const mockSyncStaffAccountFromClerkUser = vi.fn()
const mockCreateStaffRoleAudit = vi.fn()

const mockPrisma = {
  staffAccount: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

const usersApi = {
  getUser: vi.fn(),
  updateUser: vi.fn(),
  updateUserMetadata: vi.fn(),
}

const sessionsApi = {
  getSessionList: vi.fn(),
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalBaseRequest: (...args: unknown[]) => mockAuthorizePortalBase(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff-profile-payment"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/security/staff-account-sync", () => ({
  createStaffRoleAudit: (...args: unknown[]) => mockCreateStaffRoleAudit(...args),
  extractStaffRoleSnapshot: vi.fn((user: { publicMetadata?: Record<string, unknown> }) => ({
    role: user.publicMetadata?.role ?? null,
    category: user.publicMetadata?.staffCategory ?? null,
  })),
  syncStaffAccountFromClerkUser: (...args: unknown[]) => mockSyncStaffAccountFromClerkUser(...args),
}))

describe("staff profile payment route", () => {
  const baseUser = {
    id: "staff_1",
    firstName: "Ana",
    lastName: "Desk",
    imageUrl: "",
    lastSignInAt: null,
    publicMetadata: { role: "staff", staffCategory: "front_desk", staffProfile: {} },
    privateMetadata: {},
  }

  beforeEach(() => {
    mockAuthorizePortalBase.mockReset()
    mockClerkClient.mockReset()
    mockSyncStaffAccountFromClerkUser.mockReset()
    mockCreateStaffRoleAudit.mockReset()
    mockPrisma.staffAccount.findUnique.mockReset()
    mockPrisma.staffAccount.update.mockReset()
    usersApi.getUser.mockReset()
    usersApi.updateUser.mockReset()
    usersApi.updateUserMetadata.mockReset()
    sessionsApi.getSessionList.mockReset()

    mockAuthorizePortalBase.mockResolvedValue({
      ok: true,
      status: 200,
      userId: "staff_1",
      role: "staff",
      category: "front_desk",
    })

    mockClerkClient.mockResolvedValue({ users: usersApi, sessions: sessionsApi })
    usersApi.getUser.mockResolvedValue(baseUser)
    usersApi.updateUser.mockResolvedValue(baseUser)
    usersApi.updateUserMetadata.mockImplementation(async (_userId: string, payload: { publicMetadata?: unknown; privateMetadata?: unknown }) => ({
      ...baseUser,
      publicMetadata: payload.publicMetadata ?? baseUser.publicMetadata,
      privateMetadata: payload.privateMetadata ?? baseUser.privateMetadata,
    }))
    sessionsApi.getSessionList.mockResolvedValue({ data: [] })
    mockSyncStaffAccountFromClerkUser.mockResolvedValue(undefined)
    mockCreateStaffRoleAudit.mockResolvedValue(undefined)
    mockPrisma.staffAccount.findUnique.mockResolvedValue({ paymentPreference: "card", paymentInfo: { cbu: "999", alias: "alias-db" } })
    mockPrisma.staffAccount.update.mockResolvedValue({ paymentPreference: "cash", paymentInfo: null })
  })

  it("PATCH accepts a valid cash payment preference", async () => {
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")

    const res = await PATCH(
      new Request("http://localhost/api/staff/users/staff_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentPreference: "cash" }),
      }),
      { params: Promise.resolve({ userId: "staff_1" }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.paymentPreference).toBe("cash")
    expect(mockPrisma.staffAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkUserId: "staff_1" },
        data: expect.objectContaining({ paymentPreference: "cash" }),
      })
    )
  })

  it("PATCH accepts valid payment info fields", async () => {
    mockPrisma.staffAccount.update.mockResolvedValue({
      paymentPreference: null,
      paymentInfo: { cbu: "123", alias: "test" },
    })
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")

    const res = await PATCH(
      new Request("http://localhost/api/staff/users/staff_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentInfo: { cbu: "123", alias: "test" } }),
      }),
      { params: Promise.resolve({ userId: "staff_1" }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.paymentInfo).toEqual({ cbu: "123", alias: "test" })
    expect(mockPrisma.staffAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentInfo: { cbu: "123", alias: "test" } }),
      })
    )
  })

  it("PATCH accepts USA payout fields and normalizes whitespace", async () => {
    mockPrisma.staffAccount.update.mockResolvedValue({
      paymentPreference: null,
      paymentInfo: {
        routingNumber: "021000021",
        accountNumber: "000123456789",
        zelleId: "ana@example.com",
        venmoUser: "@ana-desk",
      },
    })

    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")

    const res = await PATCH(
      new Request("http://localhost/api/staff/users/staff_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentInfo: {
            routingNumber: " 021000021 ",
            accountNumber: " 000123456789 ",
            zelleId: " ana@example.com ",
            venmoUser: " @ana-desk ",
          },
        }),
      }),
      { params: Promise.resolve({ userId: "staff_1" }) }
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.paymentInfo).toEqual({
      routingNumber: "021000021",
      accountNumber: "000123456789",
      zelleId: "ana@example.com",
      venmoUser: "@ana-desk",
    })
    expect(mockPrisma.staffAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentInfo: {
            routingNumber: "021000021",
            accountNumber: "000123456789",
            zelleId: "ana@example.com",
            venmoUser: "@ana-desk",
          },
        }),
      })
    )
  })

  it("PATCH rejects an invalid payment preference", async () => {
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")

    const res = await PATCH(
      new Request("http://localhost/api/staff/users/staff_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentPreference: "crypto" }),
      }),
      { params: Promise.resolve({ userId: "staff_1" }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid payment preference." })
  })

  it("PATCH rejects an invalid payment info structure", async () => {
    const { PATCH } = await import("@/app/api/staff/users/[userId]/profile/route")

    const res = await PATCH(
      new Request("http://localhost/api/staff/users/staff_1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentInfo: { cbu: 123 } }),
      }),
      { params: Promise.resolve({ userId: "staff_1" }) }
    )

    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: "Invalid payment information." })
  })

  it("GET returns payment preference and payment info from the database", async () => {
    mockPrisma.staffAccount.findUnique.mockResolvedValueOnce({
      paymentPreference: "card",
      paymentInfo: {
        routingNumber: "021000021",
        accountNumber: "000123456789",
        zelleId: "ana@example.com",
        venmoUser: "@ana-desk",
      },
    })

    const { GET } = await import("@/app/api/staff/users/[userId]/profile/route")

    const res = await GET(new Request("http://localhost/api/staff/users/staff_1/profile"), {
      params: Promise.resolve({ userId: "staff_1" }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.paymentPreference).toBe("card")
    expect(data.paymentInfo).toEqual({
      routingNumber: "021000021",
      accountNumber: "000123456789",
      zelleId: "ana@example.com",
      venmoUser: "@ana-desk",
    })
  })
})
