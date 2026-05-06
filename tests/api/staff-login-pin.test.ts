import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"

const mockClerkClient = vi.fn()

const usersApi = {
  getUser: vi.fn(),
  getUserList: vi.fn(),
  updateUserMetadata: vi.fn(),
}

const signInTokensApi = {
  createSignInToken: vi.fn(),
}

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff-login-pin"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

const hashPin = (pin: string) => {
  const salt = "salt"
  const hash = createHash("sha256")
    .update(`${pin}:${salt}:${process.env.CLERK_SECRET_KEY || "staff-pin"}`)
    .digest("hex")
  return `${salt}:${hash}`
}

describe("staff login PIN route", () => {
  beforeEach(() => {
    usersApi.getUser.mockReset()
    usersApi.getUserList.mockReset()
    usersApi.updateUserMetadata.mockReset()
    signInTokensApi.createSignInToken.mockReset()
    mockClerkClient.mockReset()

    process.env.CLERK_SECRET_KEY = "test-secret"

    mockClerkClient.mockResolvedValue({
      users: usersApi,
      signInTokens: signInTokensApi,
    })

    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      firstName: "Ana",
      lastName: "Desk",
      primaryEmailAddress: { emailAddress: "ana@example.com" },
      publicMetadata: { role: "staff", staffCategory: "front_desk" },
      privateMetadata: { staffPinHash: hashPin("1234"), staffCheckInCount: 2 },
    })
    signInTokensApi.createSignInToken.mockResolvedValue({
      token: "ticket_456",
      url: "https://clerk.test/sign-in?token=ticket_456",
    })
  })

  it("creates a sign-in token and returns session fields", async () => {
    const { POST } = await import("@/app/api/staff/login/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1" }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.ticket).toBe("ticket_456")
    expect(data.signInUrl).toContain("redirect_url=http%3A%2F%2Flocalhost%2Fstaff%2Fresolve")
    expect(signInTokensApi.createSignInToken).toHaveBeenCalledWith({
      userId: "staff_1",
      expiresInSeconds: 300,
    })
  })

  it("does NOT mutate attendance metadata (no updateUserMetadata call)", async () => {
    const { POST } = await import("@/app/api/staff/login/pin/route")

    await POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1" }),
      })
    )

    expect(usersApi.updateUserMetadata).not.toHaveBeenCalled()
  })

  it("does NOT return checkedInAt field", async () => {
    const { POST } = await import("@/app/api/staff/login/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1" }),
      })
    )

    const data = await res.json()
    expect(data.checkedInAt).toBeUndefined()
  })

  it("returns staff info without attendance fields", async () => {
    const { POST } = await import("@/app/api/staff/login/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1" }),
      })
    )

    const data = await res.json()
    expect(data.staff).toEqual({
      id: "staff_1",
      name: "Ana Desk",
      role: "staff",
      category: "front_desk",
    })
  })

  it("returns 401 for invalid PIN", async () => {
    const { POST } = await import("@/app/api/staff/login/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "9999", userId: "staff_1" }),
      })
    )

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe("Invalid PIN.")
  })

  it("returns 400 for non-4-digit PIN", async () => {
    const { POST } = await import("@/app/api/staff/login/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "12", userId: "staff_1" }),
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("PIN must be exactly 4 digits.")
  })

  it("allows login when schoolId matches user's school context", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      firstName: "Ana",
      lastName: "Desk",
      primaryEmailAddress: { emailAddress: "ana@example.com" },
      publicMetadata: { role: "staff", staffCategory: "front_desk", schoolId: "school_42" },
      privateMetadata: { staffPinHash: hashPin("1234") },
    })

    const { POST } = await import("@/app/api/staff/login/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1", schoolId: "school_42" }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.ticket).toBe("ticket_456")
  })

  it("returns 403 when schoolId does not match user's school context", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      firstName: "Ana",
      lastName: "Desk",
      primaryEmailAddress: { emailAddress: "ana@example.com" },
      publicMetadata: { role: "staff", staffCategory: "front_desk", schoolId: "school_42" },
      privateMetadata: { staffPinHash: hashPin("1234") },
    })

    const { POST } = await import("@/app/api/staff/login/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1", schoolId: "school_99" }),
      })
    )

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain("school context")
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
  })

  it("allows login when no schoolId is provided in request (backward compat)", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      firstName: "Ana",
      lastName: "Desk",
      primaryEmailAddress: { emailAddress: "ana@example.com" },
      publicMetadata: { role: "staff", staffCategory: "front_desk", schoolId: "school_42" },
      privateMetadata: { staffPinHash: hashPin("1234") },
    })

    const { POST } = await import("@/app/api/staff/login/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1" }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it("does NOT mutate attendance metadata even when schoolId is provided", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      firstName: "Ana",
      lastName: "Desk",
      primaryEmailAddress: { emailAddress: "ana@example.com" },
      publicMetadata: { role: "staff", staffCategory: "front_desk", schoolId: "school_42" },
      privateMetadata: { staffPinHash: hashPin("1234") },
    })

    const { POST } = await import("@/app/api/staff/login/pin/route")

    await POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1", schoolId: "school_42" }),
      })
    )

    expect(usersApi.updateUserMetadata).not.toHaveBeenCalled()
  })
})
