import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: vi.fn(),
}))

describe("profile bookings reschedule route", () => {
  beforeEach(() => {
    mockAuth.mockReset()
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { POST } = await import("@/app/api/profile/bookings/reschedule/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId: "a", date: "2026-02-20", time: "10:00" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid payload", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    const { POST } = await import("@/app/api/profile/bookings/reschedule/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendanceId: "", date: "invalid", time: "10:00" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
