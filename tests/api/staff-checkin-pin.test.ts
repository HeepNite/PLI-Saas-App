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

  it("returns 400 when skipSession is false (legacy login path removed)", async () => {
    const { POST } = await import("@/app/api/staff/checkin/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1", skipSession: false }),
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("check-in only")
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
    expect(usersApi.updateUserMetadata).not.toHaveBeenCalled()
  })

  it("returns 400 when skipSession is omitted (legacy login path removed)", async () => {
    const { POST } = await import("@/app/api/staff/checkin/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1" }),
      })
    )

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("check-in only")
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
    expect(usersApi.updateUserMetadata).not.toHaveBeenCalled()
  })

  it("never returns signInUrl or ticket fields regardless of request shape", async () => {
    const { POST } = await import("@/app/api/staff/checkin/pin/route")

    // Attempt with skipSession=false
    const res1 = await POST(
      new Request("http://localhost/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1", skipSession: false }),
      })
    )
    const data1 = await res1.json()
    expect(data1.signInUrl).toBeUndefined()
    expect(data1.ticket).toBeUndefined()

    // Attempt with skipSession omitted
    const res2 = await POST(
      new Request("http://localhost/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1" }),
      })
    )
    const data2 = await res2.json()
    expect(data2.signInUrl).toBeUndefined()
    expect(data2.ticket).toBeUndefined()
  })

  it("check-in mode mutates attendance metadata (staffLastCheckInAt, staffCheckInCount, staffPresenceStatus)", async () => {
    const { POST } = await import("@/app/api/staff/checkin/pin/route")

    await POST(
      new Request("http://localhost/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1", skipSession: true }),
      })
    )

    expect(usersApi.updateUserMetadata).toHaveBeenCalledTimes(1)
    const [userId, metadataUpdate] = usersApi.updateUserMetadata.mock.calls[0]
    expect(userId).toBe("staff_1")
    expect(metadataUpdate.privateMetadata).toMatchObject({
      staffCheckInCount: 3,
      staffPresenceStatus: "online",
    })
    expect(metadataUpdate.privateMetadata.staffLastCheckInAt).toBeTruthy()
  })

  it("check-in mode returns checkedInAt timestamp", async () => {
    const { POST } = await import("@/app/api/staff/checkin/pin/route")

    const res = await POST(
      new Request("http://localhost/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234", userId: "staff_1", skipSession: true }),
      })
    )

    const data = await res.json()
    expect(data.checkedInAt).toBeTruthy()
    expect(data.staff.id).toBe("staff_1")
  })
})
