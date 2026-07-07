import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const usersApi = { getUser: vi.fn() }
const mockIssueEnrollmentChallenge = vi.fn()
const mockSendSms = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/security/staff-enrollment-challenge", () => ({
  issueEnrollmentChallenge: (...args: unknown[]) => mockIssueEnrollmentChallenge(...args),
}))

vi.mock("@/lib/sms/send-sms", () => ({
  sendSms: (...args: unknown[]) => mockSendSms(...args),
}))

// In-memory fake standing in for `staffPinAttemptCounter` — same convention
// as tests/api/staff-login-pin.test.ts, proving the REAL throttle logic
// gates the SMS-sending step, not a mocked rate-limit abstraction.
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
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { targetKey: string }
          create: Partial<FakeRow>
          update: { missCount?: { increment?: number }; lifetimeMissCount?: { increment?: number } }
        }) => {
          const existing = counterStore.get(where.targetKey)
          if (!existing) {
            const created: FakeRow = {
              targetKey: where.targetKey,
              missCount: 0,
              lifetimeMissCount: 0,
              windowStart: new Date(),
              blockedUntil: null,
              cooldownLevel: 0,
              lockedPermanentlyAt: null,
              ...create,
            }
            counterStore.set(where.targetKey, created)
            return { ...created }
          }
          const missInc = update.missCount?.increment
          const lifetimeInc = update.lifetimeMissCount?.increment
          if (typeof missInc === "number") existing.missCount += missInc
          if (typeof lifetimeInc === "number") existing.lifetimeMissCount += lifetimeInc
          return { ...existing }
        }
      ),
      update: vi.fn(async ({ where, data }: { where: { targetKey: string }; data: Partial<FakeRow> }) => {
        const row = counterStore.get(where.targetKey)
        if (!row) throw new Error("not found")
        Object.assign(row, data)
        return { ...row }
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { targetKey: string; windowStart?: { lt: Date } }
          data: Partial<FakeRow>
        }) => {
          const row = counterStore.get(where.targetKey)
          if (!row) return { count: 0 }
          if (where.windowStart && !(row.windowStart < where.windowStart.lt)) return { count: 0 }
          Object.assign(row, data)
          return { count: 1 }
        }
      ),
      findUnique: vi.fn(async ({ where }: { where: { targetKey: string } }) => {
        const row = counterStore.get(where.targetKey)
        return row ? { ...row } : null
      }),
    },
  },
}))

const post = () => import("@/app/api/staff/device/enroll/challenge/route").then(({ POST }) => POST())

describe("POST /api/staff/device/enroll/challenge — SMS OTP challenge issuance", () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    usersApi.getUser.mockReset()
    mockIssueEnrollmentChallenge.mockReset()
    mockSendSms.mockReset()
    counterStore.clear()

    mockClerkClient.mockResolvedValue({ users: usersApi })
    mockAuth.mockResolvedValue({ userId: "staff_1" })
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      publicMetadata: { role: "staff" },
      privateMetadata: {},
      primaryPhoneNumber: { phoneNumber: "+15551234567" },
      phoneNumbers: [{ phoneNumber: "+15551234567" }],
    })
    mockIssueEnrollmentChallenge.mockResolvedValue({ code: "123456", expiresAt: new Date(Date.now() + 300_000) })
    mockSendSms.mockResolvedValue({ ok: true, provider: "twilio" })
  })

  it("rejects an unauthenticated request with 401", async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const res = await post()

    expect(res.status).toBe(401)
    expect(mockIssueEnrollmentChallenge).not.toHaveBeenCalled()
    expect(mockSendSms).not.toHaveBeenCalled()
  })

  it("rejects a non-staff caller with 403 and does NOT issue a challenge or send SMS", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      publicMetadata: {},
      privateMetadata: {},
      primaryPhoneNumber: { phoneNumber: "+15551234567" },
    })

    const res = await post()

    expect(res.status).toBe(403)
    expect(mockIssueEnrollmentChallenge).not.toHaveBeenCalled()
    expect(mockSendSms).not.toHaveBeenCalled()
  })

  it("sends the OTP to the phone ON FILE for auth().userId — never a client-supplied number (route takes no body)", async () => {
    const res = await post()

    expect(res.status).toBe(200)
    expect(mockIssueEnrollmentChallenge).toHaveBeenCalledWith("staff_1")
    expect(mockSendSms).toHaveBeenCalledOnce()
    const [to, body] = mockSendSms.mock.calls[0]!
    expect(to).toBe("+15551234567")
    expect(body).toContain("123456")
  })

  it("rejects a staff member with NO phone on file — never sends an SMS to nowhere", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      publicMetadata: { role: "staff" },
      privateMetadata: {},
      primaryPhoneNumber: null,
      phoneNumbers: [],
    })

    const res = await post()

    expect(res.status).toBe(400)
    expect(mockSendSms).not.toHaveBeenCalled()
  })

  it("SMS-COST GATE: repeated calls for one authUserId trip a 429 at the ceiling BEFORE the SMS-triggering send", async () => {
    let lastRes
    for (let i = 0; i < 7; i += 1) {
      lastRes = await post()
    }

    expect(lastRes!.status).toBe(429)
    // The SMS-cost ceiling caps sendSms calls — it must NOT have been called
    // on every one of the 7 requests once the ceiling trips.
    expect(mockSendSms.mock.calls.length).toBeLessThan(7)
  })

  it("the SMS-cost throttle key is scoped per authUserId — a DIFFERENT user is unaffected", async () => {
    for (let i = 0; i < 7; i += 1) {
      await post()
    }

    mockAuth.mockResolvedValue({ userId: "staff_2" })
    usersApi.getUser.mockResolvedValue({
      id: "staff_2",
      publicMetadata: { role: "staff" },
      privateMetadata: {},
      primaryPhoneNumber: { phoneNumber: "+15559999999" },
    })

    const res = await post()
    expect(res.status).toBe(200)
  })
})
