import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeStaffTerminalSession = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockCreateKioskIdentificationSession = vi.fn()
const mockWriteStudentPinAudit = vi.fn()
const mockCreateStudentPinLookupDigest = vi.fn()
const mockLookupActiveCredentialByDigest = vi.fn()
const mockVerifyStudentPinHash = vi.fn()
const mockIsTerminalBlocked = vi.fn()
const mockRecordTerminalMiss = vi.fn()
const mockMarkStudentPinVerified = vi.fn()
const mockClearTerminalMisses = vi.fn()
const mockSyncStudentPinLifecycleForCredential = vi.fn()

const mockPrisma = {
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/checkin/kiosk-session", () => ({
  createKioskIdentificationSession: (...args: unknown[]) => mockCreateKioskIdentificationSession(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/security/student-pin", () => ({
  createStudentPinLookupDigest: (...args: unknown[]) => mockCreateStudentPinLookupDigest(...args),
  clearTerminalMisses: (...args: unknown[]) => mockClearTerminalMisses(...args),
  isStudentPinFormatValid: (value: string) => /^\d{4}$/.test(value),
  isStudentPinExpired: (credential: { status: string; expiresAt?: Date | null }) =>
    credential.status === "expired_due_to_day_close" || Boolean(credential.expiresAt && credential.expiresAt <= new Date("2026-03-27T00:00:00.000Z")),
  isStudentPinLifecycleEnabled: () => true,
  isStudentPinObsolete: (credential: { status: string }) => credential.status === "obsolete_due_to_inactivity",
  isTerminalBlocked: (...args: unknown[]) => mockIsTerminalBlocked(...args),
  lookupActiveCredentialByDigest: (...args: unknown[]) => mockLookupActiveCredentialByDigest(...args),
  markStudentPinVerified: (...args: unknown[]) => mockMarkStudentPinVerified(...args),
  recordTerminalMiss: (...args: unknown[]) => mockRecordTerminalMiss(...args),
  syncStudentPinLifecycleForCredential: (...args: unknown[]) => mockSyncStudentPinLifecycleForCredential(...args),
  verifyStudentPinHash: (...args: unknown[]) => mockVerifyStudentPinHash(...args),
}))

vi.mock("@/lib/security/student-pin-audit", () => ({
  STUDENT_PIN_AUDIT_ACTIONS: {
      KIOSK_IDENTIFIED: "kiosk_identified",
      EXPIRED: "expired",
      OBSOLETE: "obsolete",
    },
  writeStudentPinAudit: (...args: unknown[]) => mockWriteStudentPinAudit(...args),
}))

describe("checkin PIN identify route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeStaffTerminalSession.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()
    mockCreateKioskIdentificationSession.mockReset()
    mockWriteStudentPinAudit.mockReset()
    mockCreateStudentPinLookupDigest.mockReset()
    mockLookupActiveCredentialByDigest.mockReset()
    mockVerifyStudentPinHash.mockReset()
    mockIsTerminalBlocked.mockReset()
    mockRecordTerminalMiss.mockReset()
    mockMarkStudentPinVerified.mockReset()
    mockClearTerminalMisses.mockReset()
    mockSyncStudentPinLifecycleForCredential.mockReset()
    mockPrisma.$transaction.mockReset()

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
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockCreateStudentPinLookupDigest.mockReturnValue("digest_1234")
    mockIsTerminalBlocked.mockResolvedValue({
      blocked: false,
      blockedUntil: null,
      attemptsRemaining: 5,
      missCount: 0,
    })
    mockLookupActiveCredentialByDigest.mockResolvedValue(null)
    mockVerifyStudentPinHash.mockResolvedValue(true)
    mockRecordTerminalMiss.mockResolvedValue({
      blocked: false,
      blockedUntil: null,
      attemptsRemaining: 4,
      missCount: 1,
    })
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
  })

  it("returns 401 when the terminal session is missing", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })

    const { POST } = await import("@/app/api/checkin/pin/identify/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      })
    )

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      error: "Terminal session required for kiosk PIN identification.",
    })
  })

  it("returns a blocked response before lookup when the terminal is throttled", async () => {
    mockIsTerminalBlocked.mockResolvedValue({
      blocked: true,
      blockedUntil: new Date("2026-03-26T12:05:00.000Z"),
      attemptsRemaining: 0,
      missCount: 5,
    })

    const { POST } = await import("@/app/api/checkin/pin/identify/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      })
    )

    expect(res.status).toBe(429)
    await expect(res.json()).resolves.toEqual({
      identified: false,
      terminalBlocked: true,
      blockedUntil: "2026-03-26T12:05:00.000Z",
      attemptsRemaining: 0,
    })
    expect(mockLookupActiveCredentialByDigest).not.toHaveBeenCalled()
  })

  it("records a terminal miss when no active credential matches the PIN digest", async () => {
    const { POST } = await import("@/app/api/checkin/pin/identify/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      })
    )

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      identified: false,
      terminalBlocked: false,
      blockedUntil: null,
      attemptsRemaining: 4,
    })
    expect(mockCreateStudentPinLookupDigest).toHaveBeenCalledWith("1234")
    expect(mockLookupActiveCredentialByDigest).toHaveBeenCalledWith(mockPrisma, "digest_1234")
    expect(mockRecordTerminalMiss).toHaveBeenCalledWith(mockPrisma, "terminal_1", expect.any(Date))
  })

  it("treats a digest hit with a hash mismatch as an unresolved miss", async () => {
    mockLookupActiveCredentialByDigest.mockResolvedValue({
      id: "cred_1",
      userId: "user_1",
      kind: "permanent",
      status: "active",
      pinHash: "hash",
      pinLookupDigest: "digest_1234",
    })
    mockVerifyStudentPinHash.mockResolvedValue(false)

    const { POST } = await import("@/app/api/checkin/pin/identify/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      })
    )

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      identified: false,
      terminalBlocked: false,
      blockedUntil: null,
      attemptsRemaining: 4,
    })
    expect(mockVerifyStudentPinHash).toHaveBeenCalledWith("1234", {
      pinHash: "hash",
      pinLookupDigest: "digest_1234",
    })
    expect(mockRecordTerminalMiss).toHaveBeenCalledTimes(1)
  })

  it("returns regeneration required when a permanent PIN is obsolete", async () => {
    mockLookupActiveCredentialByDigest.mockResolvedValue({
      id: "cred_1",
      userId: "user_1",
      kind: "permanent",
      status: "obsolete_due_to_inactivity",
      pinHash: "hash",
      pinLookupDigest: "digest_1234",
    })
    mockCreateKioskIdentificationSession.mockResolvedValue({
      id: "session_obsolete",
      credentialKind: "permanent",
      requiresPinRotation: true,
      expiresAt: new Date("2026-03-26T12:15:00.000Z"),
    })

    const { POST } = await import("@/app/api/checkin/pin/identify/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      identified: true,
      userId: "user_1",
      credentialKind: "permanent",
      requiresPinRotation: true,
      requiresPinRegeneration: true,
      regenerationReason: "obsolete",
      sessionToken: "session_obsolete",
      sessionExpiresAt: "2026-03-26T12:15:00.000Z",
    })
    expect(mockSyncStudentPinLifecycleForCredential).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ id: "cred_1" }),
      expect.objectContaining({ source: "kiosk_identify", terminalId: "terminal_1" })
    )
    expect(mockCreateKioskIdentificationSession).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        terminalId: "terminal_1",
        userId: "user_1",
        credentialKind: "permanent",
        requiresPinRotation: true,
      })
    )
    expect(mockClearTerminalMisses).toHaveBeenCalledWith(mockPrisma, "terminal_1")
  })

  it("expires stale provisional PINs before allowing identification", async () => {
    mockLookupActiveCredentialByDigest.mockResolvedValue({
      id: "prov_1",
      userId: "user_1",
      kind: "provisional",
      status: "active",
      expiresAt: new Date("2026-03-26T23:59:59.999Z"),
      pinHash: "hash",
      pinLookupDigest: "digest_1234",
    })
    mockRecordTerminalMiss.mockResolvedValue({
      blocked: false,
      blockedUntil: null,
      attemptsRemaining: 4,
      missCount: 1,
    })

    const { POST } = await import("@/app/api/checkin/pin/identify/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      })
    )

    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toEqual({
      identified: false,
      terminalBlocked: false,
      blockedUntil: null,
      attemptsRemaining: 4,
    })
    expect(mockSyncStudentPinLifecycleForCredential).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ id: "prov_1" }),
      expect.objectContaining({ source: "kiosk_identify", terminalId: "terminal_1" })
    )
    expect(mockRecordTerminalMiss).toHaveBeenCalledTimes(1)
    expect(mockCreateKioskIdentificationSession).not.toHaveBeenCalled()
  })

  it("creates a kiosk identification session for a verified PIN", async () => {
    mockLookupActiveCredentialByDigest.mockResolvedValue({
      id: "cred_1",
      userId: "user_1",
      kind: "provisional",
      status: "active",
      pinHash: "hash",
      pinLookupDigest: "digest_1234",
    })
    mockMarkStudentPinVerified.mockResolvedValue({
      id: "cred_1",
      kind: "provisional",
      status: "rotation_required",
    })
    mockCreateKioskIdentificationSession.mockResolvedValue({
      id: "session_1",
      credentialKind: "provisional",
      requiresPinRotation: true,
      expiresAt: new Date("2026-03-26T12:15:00.000Z"),
    })

    const { POST } = await import("@/app/api/checkin/pin/identify/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      identified: true,
      userId: "user_1",
      credentialKind: "provisional",
      requiresPinRotation: true,
      sessionToken: "session_1",
      sessionExpiresAt: "2026-03-26T12:15:00.000Z",
    })
    expect(mockMarkStudentPinVerified).toHaveBeenCalledWith(mockPrisma, "cred_1")
    expect(mockClearTerminalMisses).toHaveBeenCalledWith(mockPrisma, "terminal_1")
    expect(mockWriteStudentPinAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockPrisma,
        userId: "user_1",
        action: "kiosk_identified",
        terminalId: "terminal_1",
        metadata: { requiresPinRotation: true },
      })
    )
  })
})
