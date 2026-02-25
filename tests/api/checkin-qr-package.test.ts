import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: vi.fn(),
}))

describe("qr check-in package route", () => {
  beforeEach(() => {
    mockAuth.mockReset()
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", date: "2026-02-24", time: "11:00" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid payload", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    const { POST } = await import("@/app/api/checkin/qr/package/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "", date: "2026-02-24", time: "11:00" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
