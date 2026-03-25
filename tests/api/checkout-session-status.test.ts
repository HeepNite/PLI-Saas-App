import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffTerminalSession = vi.fn()
const mockRetrieveCheckoutSession = vi.fn()

const mockPrisma = {
  purchase: {
    findUnique: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = {
      sessions: {
        retrieve: (...args: unknown[]) => mockRetrieveCheckoutSession(...args),
      },
    }
    constructor() {}
  },
}))

describe("checkout session status route", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.STRIPE_SECRET_KEY = "sk_test"

    mockAuthorizeStaffTerminalSession.mockReset()
    mockRetrieveCheckoutSession.mockReset()
    mockPrisma.purchase.findUnique.mockReset()

    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: "terminal_session_1",
      terminal: {
        id: "terminal_1",
        slug: "front-desk",
        name: "Front desk",
        location: "Lobby",
        defaultCourseSlug: null,
        active: true,
      },
    })
    mockRetrieveCheckoutSession.mockResolvedValue({ id: "cs_test_123", status: "open" })
    mockPrisma.purchase.findUnique.mockResolvedValue(null)
  })

  it("requires terminal session authorization", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })

    const { GET } = await import("@/app/api/checkout/session/status/route")
    const res = await GET(new Request("http://localhost/api/checkout/session/status?sessionId=cs_test_123"))

    expect(res.status).toBe(401)
    expect(mockRetrieveCheckoutSession).not.toHaveBeenCalled()
  })

  it("keeps polling open while webhook persistence is still pending", async () => {
    mockRetrieveCheckoutSession.mockResolvedValue({ id: "cs_test_123", status: "complete" })

    const { GET } = await import("@/app/api/checkout/session/status/route")
    const res = await GET(new Request("http://localhost/api/checkout/session/status?sessionId=cs_test_123"))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: "open",
      sessionId: "cs_test_123",
      awaitingWebhook: true,
    })
  })

  it("returns durable completion data only after purchase persistence", async () => {
    mockRetrieveCheckoutSession.mockResolvedValue({ id: "cs_test_123", status: "complete" })
    mockPrisma.purchase.findUnique.mockResolvedValue({
      id: "purchase_123",
      status: "paid",
    })

    const { GET } = await import("@/app/api/checkout/session/status/route")
    const res = await GET(new Request("http://localhost/api/checkout/session/status?sessionId=cs_test_123"))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: "complete",
      sessionId: "cs_test_123",
      purchaseId: "purchase_123",
      paymentStatus: "paid",
    })
  })

  it("returns expired for expired Stripe sessions", async () => {
    mockRetrieveCheckoutSession.mockResolvedValue({ id: "cs_test_123", status: "expired" })

    const { GET } = await import("@/app/api/checkout/session/status/route")
    const res = await GET(new Request("http://localhost/api/checkout/session/status?sessionId=cs_test_123"))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      status: "expired",
      sessionId: "cs_test_123",
    })
  })

  it("maps missing Stripe sessions to not_found", async () => {
    const error = new Error("Missing") as Error & { code?: string }
    error.code = "resource_missing"
    mockRetrieveCheckoutSession.mockRejectedValue(error)

    const { GET } = await import("@/app/api/checkout/session/status/route")
    const res = await GET(new Request("http://localhost/api/checkout/session/status?sessionId=cs_missing"))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({
      status: "not_found",
      sessionId: "cs_missing",
    })
  })
})
