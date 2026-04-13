import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"

const mockClerkClient = vi.fn()
const mockCreateTeacherClockEntryWithSlugs = vi.fn()

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
  buildRateLimitKey: vi.fn(() => "staff-checkin-pin"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/clock/teacher-clock", () => ({
  createTeacherClockEntryWithSlugs: (...args: unknown[]) => mockCreateTeacherClockEntryWithSlugs(...args),
}))

const hashPin = (pin: string) => {
  const salt = "salt"
  const hash = createHash("sha256")
    .update(`${pin}:${salt}:${process.env.CLERK_SECRET_KEY || "staff-pin"}`)
    .digest("hex")
  return `${salt}:${hash}`
}

describe("staff checkin PIN route", () => {
  beforeEach(() => {
    usersApi.getUser.mockReset()
    usersApi.getUserList.mockReset()
    usersApi.updateUserMetadata.mockReset()
    signInTokensApi.createSignInToken.mockReset()
    mockClerkClient.mockReset()
    mockCreateTeacherClockEntryWithSlugs.mockReset()

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
    usersApi.updateUserMetadata.mockResolvedValue({ id: "staff_1" })
    signInTokensApi.createSignInToken.mockResolvedValue({
      token: "ticket_123",
      url: "https://clerk.test/sign-in?token=ticket_123",
    })
    mockCreateTeacherClockEntryWithSlugs.mockResolvedValue(undefined)
  })

  it("returns no session fields when skipSession is true", async () => {
    const { POST } = await import("@/app/api/staff/checkin/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1", skipSession: true }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.ticket).toBeUndefined()
    expect(data.signInUrl).toBeUndefined()
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
  })

  it("returns session fields when skipSession is false", async () => {
    const { POST } = await import("@/app/api/staff/checkin/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1", skipSession: false }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ticket).toBe("ticket_123")
    expect(data.signInUrl).toContain("redirect_url=http%3A%2F%2Flocalhost%2Fstaff%2Fresolve")
    expect(signInTokensApi.createSignInToken).toHaveBeenCalledWith({
      userId: "staff_1",
      expiresInSeconds: 60,
    })
  })

  it("defaults to creating a session when skipSession is omitted", async () => {
    const { POST } = await import("@/app/api/staff/checkin/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1" }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ticket).toBe("ticket_123")
    expect(data.signInUrl).toContain("ticket_123")
  })
})
