import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: vi.fn(),
}))

describe("profile bookings assign route", () => {
  beforeEach(() => {
    mockAuth.mockReset()
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { POST } = await import("@/app/api/profile/bookings/assign/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packagePurchaseId: "pkg_1", assignments: [{ date: "2026-02-20", time: "10:00" }] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid assignment payload", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    const { POST } = await import("@/app/api/profile/bookings/assign/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packagePurchaseId: "", assignments: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
