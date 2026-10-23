import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffTerminalSession = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockIsTerminalBlocked = vi.fn()
const mockRecordTerminalMiss = vi.fn()
const mockClearTerminalMisses = vi.fn()
const mockCreateKioskIdentificationSession = vi.fn()
const mockFindClerkUserByIdentifiers = vi.fn()
const mockUserFindFirst = vi.fn()
const mockPurchaseFindFirst = vi.fn()
const mockTransaction = vi.fn()

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }))
vi.mock("@clerk/backend", () => ({ verifyToken: vi.fn() }))

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: () => "127.0.0.1",
}))

vi.mock("@/lib/security/student-pin", () => ({
  isTerminalBlocked: (...args: unknown[]) => mockIsTerminalBlocked(...args),
  recordTerminalMiss: (...args: unknown[]) => mockRecordTerminalMiss(...args),
  clearTerminalMisses: (...args: unknown[]) => mockClearTerminalMisses(...args),
}))

const NEW_STUDENT_SESSION_MAX_ACCOUNT_AGE_MS = 30 * 60_000

vi.mock("@/lib/checkin/kiosk-session", () => ({
  createKioskIdentificationSession: (...args: unknown[]) => mockCreateKioskIdentificationSession(...args),
  NEW_STUDENT_SESSION_MAX_ACCOUNT_AGE_MS: 30 * 60_000,
}))

vi.mock("@/lib/clerk-users", () => ({
  findClerkUserByIdentifiers: (...args: unknown[]) => mockFindClerkUserByIdentifiers(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: (...args: unknown[]) => mockUserFindFirst(...args) },
    purchase: { findFirst: (...args: unknown[]) => mockPurchaseFindFirst(...args) },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

const TERMINAL_ID = "terminal_1"
const PHONE = "+1 (305) 555-0101"
const EXPIRES_AT = new Date("2026-10-23T12:15:00.000Z")

const makeClerkUser = (overrides: { phone?: string; status?: string; createdAt?: number } = {}) => ({
  id: "user_clerk_1",
  createdAt: overrides.createdAt ?? Date.now() - 5 * 60_000,
  primaryPhoneNumberId: "phone_1",
  phoneNumbers: [
    {
      id: "phone_1",
      phoneNumber: overrides.phone ?? "+13055550101",
      verification: { status: overrides.status ?? "verified" },
    },
  ],
  primaryEmailAddress: { emailAddress: "new@student.test" },
})

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/checkin/qr/new-student/kiosk-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const loadRoute = async () => (await import("@/app/api/checkin/qr/new-student/kiosk-session/route")).POST

describe("new-student kiosk session mint route", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test" // secret-scan: allow
    mockAuthorizeStaffTerminalSession.mockResolvedValue({
      ok: true,
      terminal: { id: TERMINAL_ID },
      sessionId: "terminal_session_1",
    })
    mockBuildRateLimitKey.mockImplementation((prefix: string, ip: string) => `${prefix}:${ip}`)
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockIsTerminalBlocked.mockResolvedValue({ blocked: false })
    mockRecordTerminalMiss.mockResolvedValue({ terminalBlocked: false, cooldownActive: false })
    mockFindClerkUserByIdentifiers.mockResolvedValue(makeClerkUser())
    mockUserFindFirst.mockResolvedValue({ id: "db_user_1", phone: "3055550101" })
    mockPurchaseFindFirst.mockResolvedValue(null)
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}))
    mockCreateKioskIdentificationSession.mockResolvedValue({ id: "kiosk_session_1", expiresAt: EXPIRES_AT })
  })

  it("mints a new_student_sms session for a Clerk-verified new student and returns only token and expiry", async () => {
    const POST = await loadRoute()
    const res = await POST(makeRequest({ phone: PHONE }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      sessionToken: "kiosk_session_1",
      sessionExpiresAt: EXPIRES_AT.toISOString(),
    })
    expect(mockFindClerkUserByIdentifiers).toHaveBeenCalledWith({ phone: PHONE })
    expect(mockUserFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clerkId: "user_clerk_1" } })
    )
    expect(mockCreateKioskIdentificationSession).toHaveBeenCalledWith(expect.anything(), {
      terminalId: TERMINAL_ID,
      userId: "db_user_1",
      credentialKind: "new_student_sms",
      requiresPinRotation: false,
    })
    expect(mockClearTerminalMisses).toHaveBeenCalled()
  })

  it("requires terminal auth", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false })
    const POST = await loadRoute()
    const res = await POST(makeRequest({ phone: PHONE }))

    expect(res.status).toBe(401)
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockCreateKioskIdentificationSession).not.toHaveBeenCalled()
  })

  it("rate limits per terminal session and IP", async () => {
    mockConsumeRateLimit.mockReturnValue({ ok: false, retryAfterSec: 12 })
    const POST = await loadRoute()
    const res = await POST(makeRequest({ phone: PHONE }))

    expect(res.status).toBe(429)
    expect(mockConsumeRateLimit).toHaveBeenCalledWith({
      key: "checkin:qr:new-student:kiosk-session:terminal_session_1:127.0.0.1",
      limit: 30,
      windowMs: 60_000,
    })
    expect(mockCreateKioskIdentificationSession).not.toHaveBeenCalled()
  })

  it("rejects a blocked terminal without minting", async () => {
    mockIsTerminalBlocked.mockResolvedValue({ blocked: true, terminalBlocked: true })
    const POST = await loadRoute()
    const res = await POST(makeRequest({ phone: PHONE }))

    expect(res.status).toBe(429)
    expect(mockCreateKioskIdentificationSession).not.toHaveBeenCalled()
  })

  it("refuses with 403 and records a miss when the Clerk phone is not verified", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue(makeClerkUser({ status: "unverified" }))
    const POST = await loadRoute()
    const res = await POST(makeRequest({ phone: PHONE }))

    expect(res.status).toBe(403)
    expect(mockRecordTerminalMiss).toHaveBeenCalled()
    expect(mockCreateKioskIdentificationSession).not.toHaveBeenCalled()
  })

  it("refuses with 403 when no Clerk user exists for the phone", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    const POST = await loadRoute()
    const res = await POST(makeRequest({ phone: PHONE }))

    expect(res.status).toBe(403)
    expect(mockCreateKioskIdentificationSession).not.toHaveBeenCalled()
  })

  it("refuses when the verified Clerk phone is not the submitted phone", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue(makeClerkUser({ phone: "+13055559999" }))
    const POST = await loadRoute()
    const res = await POST(makeRequest({ phone: PHONE }))

    expect(res.status).toBe(403)
    expect(mockCreateKioskIdentificationSession).not.toHaveBeenCalled()
  })

  it("refuses when the DB user is missing or has a different phone", async () => {
    mockUserFindFirst.mockResolvedValueOnce(null)
    const POST = await loadRoute()
    expect((await POST(makeRequest({ phone: PHONE }))).status).toBe(403)

    mockUserFindFirst.mockResolvedValueOnce({ id: "db_user_1", phone: "3055559999" })
    expect((await POST(makeRequest({ phone: PHONE }))).status).toBe(403)
    expect(mockCreateKioskIdentificationSession).not.toHaveBeenCalled()
  })

  it("refuses a prior purchaser with the uniform response and records a miss", async () => {
    mockPurchaseFindFirst.mockResolvedValue({ id: "purchase_1" })
    const POST = await loadRoute()
    const res = await POST(makeRequest({ phone: PHONE }))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Phone verification required before card payment." })
    expect(mockRecordTerminalMiss).toHaveBeenCalled()
    expect(mockCreateKioskIdentificationSession).not.toHaveBeenCalled()
  })

  it("refuses an old verified account not created during this visit", async () => {
    expect(NEW_STUDENT_SESSION_MAX_ACCOUNT_AGE_MS).toBe(30 * 60_000)
    mockFindClerkUserByIdentifiers.mockResolvedValue(
      makeClerkUser({ createdAt: Date.now() - NEW_STUDENT_SESSION_MAX_ACCOUNT_AGE_MS - 60_000 })
    )
    const POST = await loadRoute()
    const res = await POST(makeRequest({ phone: PHONE }))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: "Phone verification required before card payment." })
    expect(mockRecordTerminalMiss).toHaveBeenCalled()
    expect(mockCreateKioskIdentificationSession).not.toHaveBeenCalled()
  })

  it("rejects an invalid phone", async () => {
    const POST = await loadRoute()
    const res = await POST(makeRequest({ phone: "123" }))

    expect(res.status).toBe(400)
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
  })
})
