import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockHandleCheckout = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }))
vi.mock("@/app/api/checkout/session/route", () => ({
  handleCheckoutSession: (...args: unknown[]) => mockHandleCheckout(...args),
}))

describe("profile checkout session route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockHandleCheckout.mockReset()
  })

  it("rejects unauthenticated callers before checkout", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { POST } = await import("@/app/api/profile/checkout/session/route")
    const response = await POST(new Request("http://localhost/api/profile/checkout/session", { method: "POST" }))

    expect(response.status).toBe(401)
    expect(mockHandleCheckout).not.toHaveBeenCalled()
  })

  it("binds authenticated requests to the trusted profile channel", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_1" })
    mockHandleCheckout.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const request = new Request("http://localhost/api/profile/checkout/session", { method: "POST" })
    const { POST } = await import("@/app/api/profile/checkout/session/route")
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockHandleCheckout).toHaveBeenCalledWith(request, "profile")
  })
})
