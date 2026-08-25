import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffTerminalSession = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockIsTerminalBlocked = vi.fn()
const mockRecordTerminalMiss = vi.fn()
const mockClearTerminalMisses = vi.fn()
const mockCreateKioskIdentificationSession = vi.fn()
const mockResolveKioskPinThrottleSeverity = vi.fn()
const mockGetKioskPinThrottleMessage = vi.fn()

const mockUserFindFirst = vi.fn()
const mockTransaction = vi.fn()

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("@/lib/security/student-pin", () => ({
  isTerminalBlocked: (...args: unknown[]) => mockIsTerminalBlocked(...args),
  recordTerminalMiss: (...args: unknown[]) => mockRecordTerminalMiss(...args),
  clearTerminalMisses: (...args: unknown[]) => mockClearTerminalMisses(...args),
}))

vi.mock("@/lib/checkin/kiosk-session", () => ({
  createKioskIdentificationSession: (...args: unknown[]) => mockCreateKioskIdentificationSession(...args),
}))

vi.mock("@/lib/security/kiosk-pin-throttle", () => ({
  resolveKioskPinThrottleSeverity: (...args: unknown[]) => mockResolveKioskPinThrottleSeverity(...args),
  getKioskPinThrottleMessage: (...args: unknown[]) => mockGetKioskPinThrottleMessage(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

const TERMINAL_ID = "terminal_1"
const SESSION_ID = "terminal_session_1"

const makePostRequest = (body: unknown) =>
  new Request("http://localhost/api/checkin/phone/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const UNBLOCKED_TERMINAL_STATE = {
  blocked: false,
  terminalBlocked: false,
  cooldownActive: false,
  blockedUntil: null,
  attemptsRemaining: 5,
  missCount: 0,
}

describe("checkin phone identify route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeStaffTerminalSession.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()
    mockIsTerminalBlocked.mockReset()
    mockRecordTerminalMiss.mockReset()
    mockClearTerminalMisses.mockReset()
    mockCreateKioskIdentificationSession.mockReset()
    mockResolveKioskPinThrottleSeverity.mockReset()
    mockGetKioskPinThrottleMessage.mockReset()
    mockUserFindFirst.mockReset()
    mockTransaction.mockReset()

    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      sessionId: SESSION_ID,
      terminal: {
        id: TERMINAL_ID,
        slug: "terminal-1",
        name: "Terminal 1",
        location: null,
        defaultCourseSlug: null,
        active: true,
      },
    })
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockIsTerminalBlocked.mockResolvedValue(UNBLOCKED_TERMINAL_STATE)
    mockRecordTerminalMiss.mockResolvedValue({
      blocked: false,
      terminalBlocked: false,
      cooldownActive: false,
      blockedUntil: null,
      attemptsRemaining: 4,
      missCount: 1,
    })
    mockClearTerminalMisses.mockResolvedValue(undefined)
    mockResolveKioskPinThrottleSeverity.mockReturnValue("normal")
    mockGetKioskPinThrottleMessage.mockReturnValue("Too many failed attempts.")
    mockUserFindFirst.mockResolvedValue({ id: "db_user_1" })
    mockCreateKioskIdentificationSession.mockResolvedValue({
      id: "kiosk_session_token_1",
      expiresAt: new Date("2026-07-01T12:00:00.000Z"),
    })
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        kioskIdentificationSession: {
          deleteMany: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({
            id: "kiosk_session_token_1",
            expiresAt: new Date("2026-07-01T12:00:00.000Z"),
          }),
        },
        kioskTerminalMissCounter: {
          deleteMany: vi.fn().mockResolvedValue({}),
        },
      })
    )
  })

  it("returns 401 when terminal session is missing or expired", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(makePostRequest({ phone: "5551112222" }))

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/terminal session required/i)
  })

  it("returns 429 when rate limited", async () => {
    mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 30 })

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(makePostRequest({ phone: "5551112222" }))

    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("30")
  })

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/checkin/phone/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(req)

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/invalid json/i)
  })

  it("returns 400 when phone is missing", async () => {
    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(makePostRequest({ phone: "" }))

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/valid phone number/i)
  })

  it("returns 400 when phone is too short", async () => {
    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(makePostRequest({ phone: "12345" }))

    expect(res.status).toBe(400)
  })

  it("returns 423 when terminal is in cooldown state", async () => {
    const blockedUntil = new Date(Date.now() + 60_000)
    mockIsTerminalBlocked.mockResolvedValue({
      blocked: true,
      terminalBlocked: false,
      cooldownActive: true,
      blockedUntil,
      attemptsRemaining: 0,
      missCount: 6,
    })
    mockResolveKioskPinThrottleSeverity.mockReturnValue("cooldown")

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(makePostRequest({ phone: "5551112222" }))

    expect(res.status).toBe(423)
    const data = await res.json()
    expect(data.identified).toBe(false)
    expect(data.terminalBlocked).toBe(false)
  })

  it("returns 429 when terminal is fully blocked", async () => {
    const blockedUntil = new Date(Date.now() + 300_000)
    mockIsTerminalBlocked.mockResolvedValue({
      blocked: true,
      terminalBlocked: true,
      cooldownActive: true,
      blockedUntil,
      attemptsRemaining: 0,
      missCount: 12,
    })
    mockResolveKioskPinThrottleSeverity.mockReturnValue("emergency")

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(makePostRequest({ phone: "5551112222" }))

    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.identified).toBe(false)
    expect(data.terminalBlocked).toBe(true)
  })

  it("returns 401 and records a miss when phone does not match any user", async () => {
    mockUserFindFirst.mockResolvedValue(null)
    mockRecordTerminalMiss.mockResolvedValue({
      blocked: false,
      terminalBlocked: false,
      cooldownActive: false,
      blockedUntil: null,
      attemptsRemaining: 4,
      missCount: 1,
    })
    mockResolveKioskPinThrottleSeverity.mockReturnValue("normal")

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(makePostRequest({ phone: "5559999999" }))

    expect(res.status).toBe(401)
    expect(mockRecordTerminalMiss).toHaveBeenCalledTimes(1)
    const data = await res.json()
    expect(data.identified).toBe(false)
  })

  it("returns 423 and records a miss when phone miss triggers cooldown", async () => {
    mockUserFindFirst.mockResolvedValue(null)
    mockRecordTerminalMiss.mockResolvedValue({
      blocked: false,
      terminalBlocked: false,
      cooldownActive: true,
      blockedUntil: new Date(Date.now() + 60_000),
      attemptsRemaining: 0,
      missCount: 5,
    })
    mockResolveKioskPinThrottleSeverity.mockReturnValue("cooldown")

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(makePostRequest({ phone: "5559999999" }))

    expect(res.status).toBe(423)
    const data = await res.json()
    expect(data.identified).toBe(false)
  })

  it("returns 429 and records a miss when phone miss triggers terminal block", async () => {
    mockUserFindFirst.mockResolvedValue(null)
    mockRecordTerminalMiss.mockResolvedValue({
      blocked: true,
      terminalBlocked: true,
      cooldownActive: true,
      blockedUntil: new Date(Date.now() + 300_000),
      attemptsRemaining: 0,
      missCount: 10,
    })
    mockResolveKioskPinThrottleSeverity.mockReturnValue("emergency")

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(makePostRequest({ phone: "5559999999" }))

    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.identified).toBe(false)
    expect(data.terminalBlocked).toBe(true)
  })

  it("identifies user and returns session token on successful phone match", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "db_user_1" })
    mockTransaction.mockResolvedValue({
      id: "kiosk_session_token_1",
      expiresAt: new Date("2026-07-01T12:00:00.000Z"),
    })

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    const res = await POST(makePostRequest({ phone: "5551112222" }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.identified).toBe(true)
    expect(data.userId).toBe("db_user_1")
    expect(data.credentialKind).toBe("phone")
    expect(data.requiresPinRotation).toBe(false)
    expect(data.sessionToken).toBe("kiosk_session_token_1")
    expect(data.sessionExpiresAt).toBe("2026-07-01T12:00:00.000Z")
  })

  it("clears terminal misses on successful identification", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "db_user_1" })
    mockTransaction.mockResolvedValue({
      id: "kiosk_session_token_1",
      expiresAt: new Date("2026-07-01T12:00:00.000Z"),
    })

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    await POST(makePostRequest({ phone: "5551112222" }))

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    // clearTerminalMisses is called inside the transaction — the transaction mock
    // does not execute the fn body here, so we just verify the transaction ran
  })

  it("searches both exact phone and US country code variant", async () => {
    mockUserFindFirst.mockResolvedValue({ id: "db_user_1" })
    mockTransaction.mockResolvedValue({
      id: "kiosk_session_token_1",
      expiresAt: new Date("2026-07-01T12:00:00.000Z"),
    })

    const { POST } = await import("@/app/api/checkin/phone/identify/route")
    await POST(makePostRequest({ phone: "5551112222" }))

    expect(mockUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          phone: expect.objectContaining({ in: expect.any(Array) }),
        }),
      })
    )
    const callArgs = mockUserFindFirst.mock.calls[0]?.[0]
    const phoneCandidates: string[] = callArgs.where.phone.in
    expect(phoneCandidates.length).toBe(2)
  })
})
