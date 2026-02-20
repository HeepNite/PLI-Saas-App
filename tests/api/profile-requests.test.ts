import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockUpsertUser = vi.fn()

const mockPrisma = {
  actionRequest: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  packagePurchase: {
    findFirst: vi.fn(),
  },
  attendance: {
    findFirst: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUser(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

describe("profile requests route", () => {
  const usersApi = {
    getUser: vi.fn(),
  }

  beforeEach(() => {
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockUpsertUser.mockReset()
    usersApi.getUser.mockReset()
    mockPrisma.actionRequest.findMany.mockReset()
    mockPrisma.actionRequest.findFirst.mockReset()
    mockPrisma.actionRequest.create.mockReset()
    mockPrisma.packagePurchase.findFirst.mockReset()
    mockPrisma.attendance.findFirst.mockReset()
    mockClerkClient.mockResolvedValue({ users: usersApi })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const { GET } = await import("@/app/api/profile/requests/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(401)
  })

  it("lists requests for authenticated user", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockPrisma.actionRequest.findMany.mockResolvedValue([
      {
        id: "ar_1",
        type: "CLASS_CHANGE",
        status: "PENDING",
        message: "Quiero mover la clase al jueves.",
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
        resolvedAt: null,
      },
    ])

    const { GET } = await import("@/app/api/profile/requests/route")
    const res = await GET(new Request("http://localhost"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.requests).toHaveLength(1)
    expect(data.requests[0].type).toBe("CLASS_CHANGE")
  })

  it("creates class change request", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockPrisma.actionRequest.findFirst.mockResolvedValue(null)
    mockPrisma.actionRequest.create.mockResolvedValue({
      id: "ar_1",
      type: "CLASS_CHANGE",
      status: "PENDING",
      message: "Mover al martes 8PM",
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
    })

    const { POST } = await import("@/app/api/profile/requests/route")
    const req = new Request("http://localhost/api/profile/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "CLASS_CHANGE", message: "Mover al martes 8PM" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.request.type).toBe("CLASS_CHANGE")
    expect(mockPrisma.actionRequest.create).toHaveBeenCalled()
  })

  it("returns 409 when pending request already exists", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockPrisma.actionRequest.findFirst.mockResolvedValue({ id: "ar_1" })
    mockPrisma.attendance.findFirst.mockResolvedValue({
      id: "att_1",
      sessionId: "sess_1",
      session: {
        id: "sess_1",
        courseSlug: "musica-bebes",
        startsAt: new Date("2026-03-01T16:00:00.000Z"),
        title: "Musical stimulation for babies",
      },
    })

    const { POST } = await import("@/app/api/profile/requests/route")
    const req = new Request("http://localhost/api/profile/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "CANCEL",
        message: "Cancelar",
        meta: { effectiveDate: "2026-03-01", attendanceId: "att_1", refundRequested: true },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it("creates suspend request with date range metadata", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockPrisma.actionRequest.findFirst.mockResolvedValue(null)
    mockPrisma.packagePurchase.findFirst.mockResolvedValue({
      id: "pkg_1",
      packageId: "babies-2-week",
      packageLabel: "Babies 2-week pack",
      courseSlug: "musica-bebes",
      expiresAt: new Date("2026-04-01T00:00:00.000Z"),
    })
    mockPrisma.actionRequest.create.mockResolvedValue({
      id: "ar_suspend",
      type: "SUSPEND",
      status: "PENDING",
      message: "Viaje",
      meta: { startDate: "2026-03-01", endDate: "2026-03-20", packagePurchaseId: "pkg_1" },
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
    })

    const { POST } = await import("@/app/api/profile/requests/route")
    const req = new Request("http://localhost/api/profile/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "SUSPEND",
        message: "Viaje",
        meta: { startDate: "2026-03-01", endDate: "2026-03-20", packagePurchaseId: "pkg_1" },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.actionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "SUSPEND",
          meta: expect.objectContaining({
            startDate: "2026-03-01",
            endDate: "2026-03-20",
            packagePurchaseId: "pkg_1",
          }),
        }),
      })
    )
  })

  it("returns 400 for invalid suspend range", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockPrisma.actionRequest.findFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/profile/requests/route")
    const req = new Request("http://localhost/api/profile/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "SUSPEND",
        message: "Viaje",
        meta: { startDate: "2026-03-20", endDate: "2026-03-01", packagePurchaseId: "pkg_1" },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("creates cancel request with selected class and refund flag", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    usersApi.getUser.mockResolvedValue({
      firstName: "Test",
      lastName: "User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 555 5555" },
    })
    mockUpsertUser.mockResolvedValue({ id: "db_user" })
    mockPrisma.actionRequest.findFirst.mockResolvedValue(null)
    mockPrisma.attendance.findFirst.mockResolvedValue({
      id: "att_1",
      sessionId: "sess_1",
      session: {
        id: "sess_1",
        courseSlug: "musica-bebes",
        startsAt: new Date("2026-03-01T16:00:00.000Z"),
        title: "Musical stimulation for babies",
      },
    })
    mockPrisma.actionRequest.create.mockResolvedValue({
      id: "ar_cancel",
      type: "CANCEL",
      status: "PENDING",
      message: "No puedo asistir",
      meta: {
        effectiveDate: "2026-03-01",
        attendanceId: "att_1",
        refundRequested: true,
      },
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
    })

    const { POST } = await import("@/app/api/profile/requests/route")
    const req = new Request("http://localhost/api/profile/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "CANCEL",
        message: "No puedo asistir",
        meta: {
          effectiveDate: "2026-03-01",
          attendanceId: "att_1",
          refundRequested: true,
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockPrisma.attendance.findFirst).toHaveBeenCalled()
  })
})
