import { beforeEach, describe, expect, it, vi } from "vitest"

const mockResolveTerminalKioskSession = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockReplacePermanentStudentPin = vi.fn()
const mockClearStudentPinLockout = vi.fn()
const mockConsumeStudentPinCredential = vi.fn()
const mockWriteStudentPinAudit = vi.fn()

const mockPrisma = {
  studentPinCredential: {
    findUnique: vi.fn(),
  },
  kioskIdentificationSession: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/checkin/kiosk-session", () => ({
  resolveTerminalKioskSession: (...args: unknown[]) => mockResolveTerminalKioskSession(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("@/lib/security/student-pin", () => ({
  assertStudentPinConfirmation: (nextPin: string, confirmPin: string) => {
    if (!/^\d{4}$/.test(nextPin)) return { status: 400, error: "PIN must be exactly 4 digits." }
    if (nextPin !== confirmPin) return { status: 400, error: "PIN confirmation does not match." }
    return null
  },
  clearStudentPinLockout: (...args: unknown[]) => mockClearStudentPinLockout(...args),
  consumeStudentPinCredential: (...args: unknown[]) => mockConsumeStudentPinCredential(...args),
  isStudentPinConflictError: (error: unknown) =>
    Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "PIN_ALREADY_IN_USE"),
  isStudentPinLifecycleEnabled: () => true,
  replacePermanentStudentPin: (...args: unknown[]) => mockReplacePermanentStudentPin(...args),
}))

vi.mock("@/lib/security/student-pin-audit", () => ({
  STUDENT_PIN_AUDIT_ACTIONS: {
    ROTATED: "rotated",
  },
  writeStudentPinAudit: (...args: unknown[]) => mockWriteStudentPinAudit(...args),
}))

describe("checkin PIN rotate route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockResolveTerminalKioskSession.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()
    mockReplacePermanentStudentPin.mockReset()
    mockClearStudentPinLockout.mockReset()
    mockConsumeStudentPinCredential.mockReset()
    mockWriteStudentPinAudit.mockReset()
    mockPrisma.studentPinCredential.findUnique.mockReset()
    mockPrisma.kioskIdentificationSession.update.mockReset()
    mockPrisma.$transaction.mockReset()

    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        id: "session_1",
        userId: "user_1",
        requiresPinRotation: true,
        rotationBypassed: false,
      },
      terminalAuth: {
        terminal: {
          id: "terminal_1",
        },
      },
    })
    mockPrisma.studentPinCredential.findUnique.mockImplementation(async (input: {
      where: { userId_kind: { kind: string } }
    }) => {
      if (input.where.userId_kind.kind === "provisional") {
        return {
          id: "prov_1",
          status: "rotation_required",
        }
      }

      return {
        id: "perm_1",
        status: "active",
      }
    })
    mockReplacePermanentStudentPin.mockResolvedValue({
      id: "perm_1",
      kind: "permanent",
      status: "active",
    })
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
  })

  it("rotates a provisional kiosk PIN and unlocks purchase continuation", async () => {
    const { POST } = await import("@/app/api/checkin/pin/rotate/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: "session_1",
          nextPin: "2468",
          confirmPin: "2468",
        }),
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      rotated: true,
      credential: {
        id: "perm_1",
        kind: "permanent",
        status: "active",
      },
    })
    expect(mockReplacePermanentStudentPin).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ userId: "user_1", nextPin: "2468" })
    )
    expect(mockClearStudentPinLockout).toHaveBeenCalledWith(mockPrisma, "user_1")
    expect(mockConsumeStudentPinCredential).toHaveBeenCalledWith(mockPrisma, "prov_1", "consumed")
    expect(mockPrisma.kioskIdentificationSession.update).toHaveBeenCalledWith({
      where: { id: "session_1" },
      data: {
        credentialKind: "permanent",
        requiresPinRotation: false,
        rotationBypassed: false,
      },
    })
    expect(mockWriteStudentPinAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        db: mockPrisma,
        userId: "user_1",
        action: "rotated",
        terminalId: "terminal_1",
        credentialKind: "permanent",
      })
    )
  })

  it("returns a conflict when the new permanent PIN is already taken", async () => {
    const collision = new Error("PIN already in use by another student. Please choose a different PIN.") as Error & {
      code: string
    }
    collision.code = "PIN_ALREADY_IN_USE"
    mockReplacePermanentStudentPin.mockRejectedValueOnce(collision)

    const { POST } = await import("@/app/api/checkin/pin/rotate/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: "session_1",
          nextPin: "2468",
          confirmPin: "2468",
        }),
      })
    )

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error: "PIN already in use by another student. Please choose a different PIN.",
    })
    expect(mockConsumeStudentPinCredential).not.toHaveBeenCalled()
    expect(mockPrisma.kioskIdentificationSession.update).not.toHaveBeenCalled()
  })

  it("rejects rotation when the kiosk session no longer has an active provisional PIN", async () => {
    mockPrisma.studentPinCredential.findUnique.mockImplementation(async (input: {
      where: { userId_kind: { kind: string } }
    }) => {
      if (input.where.userId_kind.kind === "provisional") {
        return null
      }

      return {
        id: "perm_1",
        status: "active",
      }
    })

    const { POST } = await import("@/app/api/checkin/pin/rotate/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: "session_1",
          nextPin: "2468",
          confirmPin: "2468",
        }),
      })
    )

    expect(res.status).toBe(409)
    await expect(res.json()).resolves.toEqual({
      error: "Active provisional or obsolete permanent PIN not found for this session.",
    })
    expect(mockReplacePermanentStudentPin).not.toHaveBeenCalled()
  })

  it("allows kiosk regeneration when the session belongs to an obsolete permanent PIN", async () => {
    mockPrisma.studentPinCredential.findUnique.mockImplementation(async (input: {
      where: { userId_kind: { kind: string } }
    }) => {
      if (input.where.userId_kind.kind === "provisional") {
        return null
      }

      return {
        id: "perm_obsolete",
        status: "obsolete",
      }
    })

    const { POST } = await import("@/app/api/checkin/pin/rotate/route")
    const res = await POST(
      new Request("http://localhost/api/checkin/pin/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: "session_1",
          nextPin: "2468",
          confirmPin: "2468",
        }),
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      rotated: true,
      credential: {
        id: "perm_1",
        kind: "permanent",
        status: "active",
      },
    })
    expect(mockConsumeStudentPinCredential).not.toHaveBeenCalled()
    expect(mockWriteStudentPinAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { source: "kiosk_regeneration" },
      })
    )
  })
})
