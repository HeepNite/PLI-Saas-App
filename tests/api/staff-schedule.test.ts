import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockPrisma = {
  attendance: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff schedule route", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockPrisma.attendance.findMany.mockReset()
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockPrisma.attendance.findMany.mockResolvedValue([])
  })

  it("returns 403 when auth fails", async () => {
    mockAuthorizePortal.mockResolvedValue({ ok: false, status: 403, error: "Insufficient role" })
    const { GET } = await import("@/app/api/staff/schedule/route")
    const res = await GET(new Request("http://localhost/api/staff/schedule?month=2026-02"))
    expect(res.status).toBe(403)
  })

  it("returns grouped events by day", async () => {
    mockPrisma.attendance.findMany.mockResolvedValue([
      {
        id: "att_1",
        status: "scheduled",
        user: {
          id: "u_1",
          name: "Ana Front",
          email: "ana@example.com",
          phone: "+15555550123",
        },
        session: {
          id: "s_1",
          startsAt: new Date("2026-02-17T15:00:00.000Z"),
          courseSlug: "salsa-femenina-matutina",
          title: "Salsa feminine style (morning)",
        },
      },
    ])

    const { GET } = await import("@/app/api/staff/schedule/route")
    const res = await GET(new Request("http://localhost/api/staff/schedule?month=2026-02"))
    expect(res.status).toBe(200)
    const data = await res.json()
    const keys = Object.keys(data.eventsByDay)
    expect(keys.length).toBe(1)
    const firstDayEvents = data.eventsByDay[keys[0]]
    expect(Array.isArray(firstDayEvents)).toBe(true)
    expect(firstDayEvents[0].userName).toBe("Ana Front")
    expect(firstDayEvents[0].courseSlug).toBe("salsa-femenina-matutina")
  })
})
