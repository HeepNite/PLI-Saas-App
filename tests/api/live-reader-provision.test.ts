import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ limit: vi.fn(), account: vi.fn(), token: vi.fn() }))
vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: mocks.limit,
  buildRateLimitKey: (scope: string, ip: string) => `${scope}:${ip}`,
  getClientIp: () => "127.0.0.1",
}))
vi.mock("stripe", () => ({
  default: class Stripe {
    accounts = { retrieve: mocks.account }
    terminal = { connectionTokens: { create: mocks.token } }
  },
}))

const original = { ...process.env }
const request = (secret = "provision-secret") => new Request(
  "https://pli.palladiumlatin.art/api/kiosk/terminal/live-reader-provision",
  { method: "POST", headers: { authorization: `Bearer ${secret}` } },
)

beforeEach(() => {
  process.env.VERCEL_ENV = "production"
  process.env.INTERNAL_PURCHASE_LIVE_PROVISIONING_ENABLED = "true"
  process.env.INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED = "false"
  process.env.INTERNAL_PURCHASE_LIVE_PROVISIONING_SECRET = "provision-secret"
  process.env.STRIPE_INTERNAL_PURCHASE_LIVE_SECRET_KEY = "rk_live_runtime"
  mocks.limit.mockReturnValue({ ok: true, remaining: 2, retryAfterSec: 0 })
  mocks.account.mockResolvedValue({ id: "acct_1PWRzcRtYdjwed35" })
  mocks.token.mockResolvedValue({ secret: "pst_live_once", location: "tml_GqQ6wPY5rSAhAt" })
})

afterEach(() => {
  process.env = { ...original }
  vi.clearAllMocks()
})

describe("POST /api/kiosk/terminal/live-reader-provision", () => {
  it("returns one location-bound token only under the one-time bearer", async () => {
    const { POST } = await import("@/app/api/kiosk/terminal/live-reader-provision/route")
    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ secret: "pst_live_once", locationId: "tml_GqQ6wPY5rSAhAt" })
    expect(mocks.token).toHaveBeenCalledWith({ location: "tml_GqQ6wPY5rSAhAt" })
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })

  it.each([
    ["preview", "true", "false"],
    ["production", "false", "false"],
    ["production", "true", "true"],
  ])("fails closed for environment %s provisioning %s payment %s", async (environment, provisioning, payment) => {
    process.env.VERCEL_ENV = environment
    process.env.INTERNAL_PURCHASE_LIVE_PROVISIONING_ENABLED = provisioning
    process.env.INTERNAL_PURCHASE_LIVE_PAYMENT_ENABLED = payment
    const { POST } = await import("@/app/api/kiosk/terminal/live-reader-provision/route")

    expect((await POST(request())).status).toBe(503)
    expect(mocks.token).not.toHaveBeenCalled()
  })

  it("rate limits before provider access", async () => {
    mocks.limit.mockReturnValueOnce({ ok: false, remaining: 0, retryAfterSec: 30 })
    const { POST } = await import("@/app/api/kiosk/terminal/live-reader-provision/route")
    expect((await POST(request())).status).toBe(429)
    expect(mocks.token).not.toHaveBeenCalled()
  })

  it("rejects a wrong bearer before Stripe", async () => {
    const { POST } = await import("@/app/api/kiosk/terminal/live-reader-provision/route")
    expect((await POST(request("wrong"))).status).toBe(401)
    expect(mocks.token).not.toHaveBeenCalled()
  })

  it("rejects merchant or location drift", async () => {
    const { POST } = await import("@/app/api/kiosk/terminal/live-reader-provision/route")
    mocks.account.mockResolvedValueOnce({ id: "acct_wrong" })
    expect((await POST(request())).status).toBe(503)

    mocks.token.mockResolvedValueOnce({ secret: "pst_live_once", location: "tml_wrong" })
    expect((await POST(request())).status).toBe(502)
  })
})
