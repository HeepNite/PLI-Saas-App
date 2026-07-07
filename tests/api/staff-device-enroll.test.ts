import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const usersApi = { getUser: vi.fn() }
const mockConsumeEnrollmentChallenge = vi.fn()
const mockEnrollTrustedDevice = vi.fn()
const mockSetTrustedDeviceCookie = vi.fn()
const mockSendSms = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/security/staff-enrollment-challenge", () => ({
  consumeEnrollmentChallenge: (...args: unknown[]) => mockConsumeEnrollmentChallenge(...args),
}))

vi.mock("@/lib/security/staff-trusted-device", () => ({
  enrollTrustedDevice: (...args: unknown[]) => mockEnrollTrustedDevice(...args),
  setTrustedDeviceCookie: (...args: unknown[]) => mockSetTrustedDeviceCookie(...args),
}))

vi.mock("@/lib/sms/send-sms", () => ({
  sendSms: (...args: unknown[]) => mockSendSms(...args),
}))

// In-memory fake for the SMS-cost ceiling re-check (defense in depth).
type FakeRow = {
  targetKey: string
  missCount: number
  lifetimeMissCount: number
  windowStart: Date
  blockedUntil: Date | null
  cooldownLevel: number
  lockedPermanentlyAt: Date | null
}
const counterStore = new Map<string, FakeRow>()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffPinAttemptCounter: {
      upsert: vi.fn(async ({ where, create }: { where: { targetKey: string }; create: Partial<FakeRow> }) => {
        const row: FakeRow = {
          targetKey: where.targetKey,
          missCount: 0,
          lifetimeMissCount: 0,
          windowStart: new Date(),
          blockedUntil: null,
          cooldownLevel: 0,
          lockedPermanentlyAt: null,
          ...create,
        }
        counterStore.set(where.targetKey, row)
        return { ...row }
      }),
      update: vi.fn(async ({ where, data }: { where: { targetKey: string }; data: Partial<FakeRow> }) => {
        const row = counterStore.get(where.targetKey)
        if (!row) throw new Error("not found")
        Object.assign(row, data)
        return { ...row }
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
      findUnique: vi.fn(async ({ where }: { where: { targetKey: string } }) => {
        const row = counterStore.get(where.targetKey)
        return row ? { ...row } : null
      }),
    },
  },
}))

const post = (body: Record<string, unknown>) =>
  import("@/app/api/staff/device/enroll/route").then(({ POST }) =>
    POST(
      new Request("http://localhost/api/staff/device/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    )
  )

describe("POST /api/staff/device/enroll — consume OTP, mint trusted device", () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    usersApi.getUser.mockReset()
    mockConsumeEnrollmentChallenge.mockReset()
    mockEnrollTrustedDevice.mockReset()
    mockSetTrustedDeviceCookie.mockReset()
    mockSendSms.mockReset()
    counterStore.clear()

    mockClerkClient.mockResolvedValue({ users: usersApi })
    mockAuth.mockResolvedValue({ userId: "staff_1" })
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      publicMetadata: { role: "staff" },
      privateMetadata: {},
      primaryPhoneNumber: { phoneNumber: "+15551234567" },
    })
    mockConsumeEnrollmentChallenge.mockResolvedValue({ ok: true })
    mockEnrollTrustedDevice.mockResolvedValue({ token: "brand-new-device-token" })
    mockSendSms.mockResolvedValue({ ok: true, provider: "twilio" })
  })

  it("rejects an unauthenticated request with 401", async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const res = await post({ code: "123456" })

    expect(res.status).toBe(401)
    expect(mockConsumeEnrollmentChallenge).not.toHaveBeenCalled()
  })

  it("rejects a malformed (non-6-digit) code with 400", async () => {
    const res = await post({ code: "12" })

    expect(res.status).toBe(400)
    expect(mockConsumeEnrollmentChallenge).not.toHaveBeenCalled()
  })

  it("on a WRONG/expired/reused code, returns the underlying 409 and mints NOTHING", async () => {
    mockConsumeEnrollmentChallenge.mockResolvedValue({ ok: false, status: 409, error: "Incorrect code." })

    const res = await post({ code: "000000" })

    expect(res.status).toBe(409)
    expect(mockEnrollTrustedDevice).not.toHaveBeenCalled()
    expect(mockSetTrustedDeviceCookie).not.toHaveBeenCalled()
  })

  it("consumes the code scoped to auth().userId — never a client-supplied userId in the body", async () => {
    await post({ code: "123456", userId: "someone-else" })

    expect(mockConsumeEnrollmentChallenge).toHaveBeenCalledWith("staff_1", "123456")
  })

  it("on a correct code, mints a trusted device BOUND TO auth().userId ONLY and sets the cookie", async () => {
    const res = await post({ code: "123456" })

    expect(res.status).toBe(200)
    expect(mockEnrollTrustedDevice).toHaveBeenCalledWith("staff_1")
    expect(mockSetTrustedDeviceCookie).toHaveBeenCalledOnce()
    const [, token] = mockSetTrustedDeviceCookie.mock.calls[0]!
    expect(token).toBe("brand-new-device-token")
  })

  it("rejects a non-staff caller with 403 even with a correct code — no device minted", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      publicMetadata: {},
      privateMetadata: {},
      primaryPhoneNumber: { phoneNumber: "+15551234567" },
    })

    const res = await post({ code: "123456" })

    expect(res.status).toBe(403)
    expect(mockEnrollTrustedDevice).not.toHaveBeenCalled()
  })

  it("best-effort notifies the staff member of the new enrollment via SMS, without blocking the response", async () => {
    const res = await post({ code: "123456" })

    expect(res.status).toBe(200)
    expect(mockSendSms).toHaveBeenCalledOnce()
    const [to] = mockSendSms.mock.calls[0]!
    expect(to).toBe("+15551234567")
  })
})
