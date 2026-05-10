import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockVerifyWebhook = vi.fn()
const mockSyncDbUserFromClerkUser = vi.fn()

vi.mock("@clerk/nextjs/webhooks", () => ({
  verifyWebhook: (...args: unknown[]) => mockVerifyWebhook(...args),
}))

vi.mock("@/lib/clerk-user-sync", () => ({
  syncDbUserFromClerkUser: (...args: unknown[]) => mockSyncDbUserFromClerkUser(...args),
}))

describe("clerk webhook route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockVerifyWebhook.mockReset()
    mockSyncDbUserFromClerkUser.mockReset()
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = "whsec_clerk_test"
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.spyOn(console, "info").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("syncs user on user.updated", async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: "user.updated",
      data: { id: "clerk_1", firstName: "Ana", lastName: "Updated" },
    })
    mockSyncDbUserFromClerkUser.mockResolvedValue({ id: "db_1" })

    const { POST } = await import("@/app/api/clerk/webhook/route")
    const res = await POST(new Request("http://localhost/api/clerk/webhook", { method: "POST", body: "{}" }))

    expect(res.status).toBe(200)
    expect(mockSyncDbUserFromClerkUser).toHaveBeenCalledTimes(1)
  })

  it("ignores unsupported events", async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: "session.created",
      data: { id: "sess_1" },
    })

    const { POST } = await import("@/app/api/clerk/webhook/route")
    const res = await POST(new Request("http://localhost/api/clerk/webhook", { method: "POST", body: "{}" }))
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.ignored).toBe(true)
    expect(mockSyncDbUserFromClerkUser).not.toHaveBeenCalled()
  })

  it("returns 400 when webhook signature is invalid", async () => {
    mockVerifyWebhook.mockRejectedValue(new Error("invalid signature"))

    const { POST } = await import("@/app/api/clerk/webhook/route")
    const res = await POST(new Request("http://localhost/api/clerk/webhook", { method: "POST", body: "{}" }))

    expect(res.status).toBe(400)
    expect(console.error).toHaveBeenCalledWith(
      "clerk.webhook.signature_verification_failed",
      expect.objectContaining({ error: expect.any(Error) }),
    )
  })

  it("logs when a supported event does not sync a db user", async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: "user.created",
      data: { id: "clerk_without_email" },
    })
    mockSyncDbUserFromClerkUser.mockResolvedValue(null)

    const { POST } = await import("@/app/api/clerk/webhook/route")
    const res = await POST(new Request("http://localhost/api/clerk/webhook", { method: "POST", body: "{}" }))
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.synced).toBe(false)
    expect(console.warn).toHaveBeenCalledWith(
      "clerk.webhook.user_sync_skipped",
      expect.objectContaining({ clerkId: "clerk_without_email", eventType: "user.created" }),
    )
  })

  it("returns 500 when webhook processing fails after signature verification", async () => {
    mockVerifyWebhook.mockResolvedValue({
      type: "user.updated",
      data: { id: "clerk_1", firstName: "Ana" },
    })
    mockSyncDbUserFromClerkUser.mockRejectedValue(new Error("db unavailable"))

    const { POST } = await import("@/app/api/clerk/webhook/route")
    const res = await POST(new Request("http://localhost/api/clerk/webhook", { method: "POST", body: "{}" }))

    expect(res.status).toBe(500)
    expect(console.error).toHaveBeenCalledWith(
      "clerk.webhook.processing_failed",
      expect.objectContaining({ clerkId: "clerk_1", eventType: "user.updated", error: expect.any(Error) }),
    )
  })
})
