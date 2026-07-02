import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffPortalSectionRequest = vi.fn()
const mockAuthorizeOwnerOrAdminRequest = vi.fn()
const mockGetUserList = vi.fn()

const mockPrisma = {
  attendance: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  purchase: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalSectionRequest: (...args: unknown[]) => mockAuthorizeStaffPortalSectionRequest(...args),
  authorizeOwnerOrAdminRequest: () => mockAuthorizeOwnerOrAdminRequest(),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUserList: (...args: unknown[]) => mockGetUserList(...args),
    },
  }),
}))

vi.mock("@/lib/class-schedule", () => ({
  getTodayNewYork: () => "2026-07-02",
  getStartOfDayNY: () => new Date("2026-07-02T04:00:00.000Z"),
  buildSessionStartsAt: () => new Date("2026-07-02T04:00:00.000Z"),
}))

const schemaUnavailableError = () => ({
  name: "PrismaClientKnownRequestError",
  code: "P2022",
})

describe("staff service busy hardening", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mockAuthorizeStaffPortalSectionRequest.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin", category: "manager" })
    mockAuthorizeOwnerOrAdminRequest.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner" })
  })

  it("returns safe empty web-cash arrivals when an optional schema dependency is unavailable", async () => {
    mockPrisma.attendance.findMany.mockRejectedValueOnce(schemaUnavailableError())

    const { GET } = await import("@/app/api/staff/checkin/web-cash-arrivals/route")
    const res = await GET(new NextRequest("http://localhost/api/staff/checkin/web-cash-arrivals?since=2026-07-02T00%3A00%3A00.000Z"))

    expect(res.status).toBe(200)
    expect(res.headers.get("X-Staff-Service-Status")).toBe("degraded")
    expect(res.headers.get("X-Staff-Service-Reason")).toBeNull()
    expect(await res.json()).toEqual([])
  })

  it("returns degraded Clerk sync health instead of a blocking 503 when Clerk is rate limited", async () => {
    mockGetUserList.mockRejectedValueOnce({ status: 429, headers: { "retry-after": "45" } })

    const { GET } = await import("@/app/api/staff/users/sync-clerk/health/route")
    const res = await GET()
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get("Retry-After")).toBe("45")
    expect(payload).toMatchObject({
      status: "degraded",
      error: "User sync status is temporarily unavailable. Try checking again shortly.",
    })
    expect(payload.serviceStatus).toBeUndefined()
    expect(payload.missingCount).toBeUndefined()
  })

  it("returns degraded payments pulse for optional schema drift without breaking the staff board", async () => {
    mockPrisma.purchase.aggregate.mockRejectedValueOnce(schemaUnavailableError())
    mockPrisma.attendance.count.mockResolvedValueOnce(0)

    const { GET } = await import("@/app/api/staff/payments/pulse/route")
    const res = await GET()
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get("X-Staff-Service-Status")).toBe("degraded")
    expect(payload).toEqual({
      status: "degraded",
      purchaseCount: 0,
      attendanceCount: 0,
      latestPurchaseAt: null,
    })
  })

  it("still requires staff auth before returning optional web-cash arrivals", async () => {
    mockAuthorizeStaffPortalSectionRequest.mockResolvedValueOnce({ ok: false, status: 401, error: "Unauthorized" })

    const { GET } = await import("@/app/api/staff/checkin/web-cash-arrivals/route")
    const res = await GET(new NextRequest("http://localhost/api/staff/checkin/web-cash-arrivals"))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(mockPrisma.attendance.findMany).not.toHaveBeenCalled()
  })

  it("still requires staff auth before returning optional payments pulse", async () => {
    mockAuthorizeStaffPortalSectionRequest.mockResolvedValueOnce({ ok: false, status: 403, error: "Forbidden" })

    const { GET } = await import("@/app/api/staff/payments/pulse/route")
    const res = await GET()

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Forbidden" })
    expect(mockPrisma.purchase.aggregate).not.toHaveBeenCalled()
  })

  it("still requires owner/admin auth before returning Clerk sync health", async () => {
    mockAuthorizeOwnerOrAdminRequest.mockResolvedValueOnce({ ok: false, status: 401, error: "Unauthorized" })

    const { GET } = await import("@/app/api/staff/users/sync-clerk/health/route")
    const res = await GET()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(mockGetUserList).not.toHaveBeenCalled()
  })
})
