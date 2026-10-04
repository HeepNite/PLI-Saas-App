import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockCheckoutPost = vi.fn()
const mockRunWithTrustedChannel = vi.fn((_: unknown, callback: () => unknown) => callback())

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mockAuth() }))
vi.mock("@/app/api/checkout/session/route", () => ({
  POST: (...args: unknown[]) => mockCheckoutPost(...args),
}))
vi.mock("@/lib/checkout/trusted-checkout-channel", () => ({
  runWithTrustedCheckoutChannel: (...args: [unknown, () => unknown]) => mockRunWithTrustedChannel(...args),
}))

describe("profile checkout session route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockCheckoutPost.mockReset()
    mockRunWithTrustedChannel.mockClear()
  })

  it("rejects unauthenticated callers before checkout", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { POST } = await import("@/app/api/profile/checkout/session/route")
    const response = await POST(new Request("http://localhost/api/profile/checkout/session", { method: "POST" }))

    expect(response.status).toBe(401)
    expect(mockCheckoutPost).not.toHaveBeenCalled()
    expect(mockRunWithTrustedChannel).not.toHaveBeenCalled()
  })

  it("binds authenticated requests to the trusted profile channel", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_1" })
    mockCheckoutPost.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const request = new Request("http://localhost/api/profile/checkout/session", { method: "POST" })
    const { POST } = await import("@/app/api/profile/checkout/session/route")
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockRunWithTrustedChannel).toHaveBeenCalledWith("profile", expect.any(Function))
    expect(mockCheckoutPost).toHaveBeenCalledWith(request)
  })
})
