import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
    studentPinCredential: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    kioskTerminalMissCounter: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    studentPinAudit: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

import {
  assertStudentPinConfirmation,
  consumeStudentPinCredential,
  createStudentPinLookupDigest,
  hashStudentPin,
  getStudentPinStatus,
  isStudentPinLifecycleEnabled,
  isStudentPinExpired,
  isTerminalBlocked,
  isStudentPinObsolete,
  issueProvisionalStudentPin,
  lookupActiveCredentialByDigest,
  markStudentPinVerified,
  clearTerminalMisses,
  recordFailedStudentPinAttempt,
  recordTerminalMiss,
  replacePermanentStudentPin,
  requiresStudentPinRegeneration,
  StudentPinConflictError,
  unlockStudentPinCredentials,
  verifyStudentPinHash,
} from "@/lib/security/student-pin"

describe("student PIN helpers", () => {
  beforeEach(() => {
    mockPrisma.$transaction.mockReset()
    mockPrisma.studentPinCredential.findFirst.mockReset()
    mockPrisma.studentPinCredential.findMany.mockReset()
    mockPrisma.studentPinCredential.upsert.mockReset()
    mockPrisma.studentPinCredential.updateMany.mockReset()
    mockPrisma.studentPinCredential.update.mockReset()
    mockPrisma.studentPinCredential.findUnique.mockReset()
    mockPrisma.kioskTerminalMissCounter.findUnique.mockReset()
    mockPrisma.kioskTerminalMissCounter.create.mockReset()
    mockPrisma.kioskTerminalMissCounter.update.mockReset()
    mockPrisma.kioskTerminalMissCounter.deleteMany.mockReset()
    mockPrisma.studentPinAudit.create.mockReset()
    mockPrisma.studentPinCredential.findFirst.mockResolvedValue(null)
    mockPrisma.studentPinCredential.findMany.mockResolvedValue([])
    mockPrisma.studentPinCredential.findUnique.mockResolvedValue(null)
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
    process.env.STUDENT_PIN_LIFECYCLE_ENABLED = "true"
  })

  it("validates PIN confirmation", () => {
    expect(assertStudentPinConfirmation("1234", "1234")).toBeNull()
    expect(assertStudentPinConfirmation("1234", "5678")?.error).toMatch(/confirmation/i)
    expect(assertStudentPinConfirmation("12", "12")?.error).toMatch(/exactly 4 digits/i)
  })

  it("creates deterministic lookup digests", () => {
    expect(createStudentPinLookupDigest("1234")).toBe(createStudentPinLookupDigest("1234"))
    expect(createStudentPinLookupDigest("1234")).not.toBe(createStudentPinLookupDigest("4321"))
  })

  it("enables the lifecycle by default unless explicitly disabled", () => {
    delete process.env.STUDENT_PIN_LIFECYCLE_ENABLED
    expect(isStudentPinLifecycleEnabled()).toBe(true)

    process.env.STUDENT_PIN_LIFECYCLE_ENABLED = "false"
    expect(isStudentPinLifecycleEnabled()).toBe(false)
  })

  it("marks permanent credentials obsolete after six months without PIN-auth activity", () => {
    expect(
      isStudentPinObsolete(
        {
          kind: "permanent",
          status: "active",
          createdAt: new Date("2025-08-01T00:00:00.000Z"),
          lastPinAuthAt: new Date("2025-09-01T00:00:00.000Z"),
        },
        new Date("2026-03-26T00:00:00.000Z")
      )
    ).toBe(true)
    expect(
      isStudentPinObsolete(
        {
          kind: "permanent",
          status: "active",
          createdAt: new Date("2025-08-01T00:00:00.000Z"),
          lastPinAuthAt: new Date("2026-01-01T00:00:00.000Z"),
        },
        new Date("2026-03-26T00:00:00.000Z")
      )
    ).toBe(false)
  })

  it("flags permanent credentials that require regeneration", () => {
    expect(
      requiresStudentPinRegeneration(
        {
          kind: "permanent",
          status: "obsolete",
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
          lastPinAuthAt: new Date("2025-08-01T00:00:00.000Z"),
        },
        new Date("2026-03-26T00:00:00.000Z")
      )
    ).toBe(true)
    expect(
      requiresStudentPinRegeneration(
        {
          kind: "provisional",
          status: "active",
          createdAt: new Date("2026-03-26T00:00:00.000Z"),
          lastPinAuthAt: null,
        },
        new Date("2026-03-26T00:00:00.000Z")
      )
    ).toBe(false)
  })

  it("detects expired provisional credentials after end-of-day", () => {
    expect(
      isStudentPinExpired(
        {
          kind: "provisional",
          status: "active",
          expiresAt: new Date("2026-03-26T23:59:59.999Z"),
        },
        new Date("2026-03-27T00:00:00.000Z")
      )
    ).toBe(true)
    expect(
      isStudentPinExpired(
        {
          kind: "provisional",
          status: "active",
          expiresAt: new Date("2026-03-26T23:59:59.999Z"),
        },
        new Date("2026-03-26T12:00:00.000Z")
      )
    ).toBe(false)
  })

  it("hashes and verifies a PIN", async () => {
    const hashed = await hashStudentPin("1234")
    await expect(verifyStudentPinHash("1234", hashed)).resolves.toBe(true)
    await expect(verifyStudentPinHash("4321", hashed)).resolves.toBe(false)
  })

  it("creates permanent credentials without stamping verification time", async () => {
    mockPrisma.studentPinCredential.upsert.mockResolvedValue({ id: "perm_1" })
    mockPrisma.studentPinCredential.updateMany.mockResolvedValue({ count: 0 })

    await replacePermanentStudentPin(mockPrisma as never, { userId: "user_1", nextPin: "1234" })

    expect(mockPrisma.studentPinCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: "permanent",
          lastVerifiedAt: null,
          failedAttempts: 0,
        }),
        update: expect.objectContaining({
          kind: "permanent",
          lastVerifiedAt: null,
        }),
      })
    )
    expect(mockPrisma.studentPinCredential.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ kind: "provisional" }),
        data: expect.objectContaining({ status: "superseded" }),
      })
    )
  })

  it("rejects permanent PIN replacement when another active student already uses the PIN", async () => {
    mockPrisma.studentPinCredential.findFirst.mockResolvedValue({ id: "cred_other" })

    await expect(
      replacePermanentStudentPin(mockPrisma as never, { userId: "user_1", nextPin: "1234" })
    ).rejects.toBeInstanceOf(StudentPinConflictError)

    expect(mockPrisma.studentPinCredential.upsert).not.toHaveBeenCalled()
  })

  it("creates provisional credentials that expire end-of-day", async () => {
    mockPrisma.studentPinCredential.upsert.mockResolvedValue({ id: "prov_1" })

    await issueProvisionalStudentPin(mockPrisma as never, { userId: "user_1", nextPin: "1234" })

    expect(mockPrisma.studentPinCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: "provisional",
          lastVerifiedAt: null,
          expiresAt: expect.any(Date),
        }),
      })
    )
  })

  it("rejects provisional PIN issuance when another active student already uses the PIN", async () => {
    mockPrisma.studentPinCredential.findFirst.mockResolvedValue({ id: "cred_other" })

    await expect(
      issueProvisionalStudentPin(mockPrisma as never, { userId: "user_1", nextPin: "1234" })
    ).rejects.toBeInstanceOf(StudentPinConflictError)

    expect(mockPrisma.studentPinCredential.upsert).not.toHaveBeenCalled()
  })

  it("looks up active credentials by digest for kiosk identification", async () => {
    mockPrisma.studentPinCredential.findFirst.mockResolvedValue({ id: "cred_1" })

    const result = await lookupActiveCredentialByDigest(mockPrisma as never, "digest_1234")

    expect(result).toEqual({ id: "cred_1" })
    expect(mockPrisma.studentPinCredential.findFirst).toHaveBeenCalledWith({
      where: {
        pinLookupDigest: "digest_1234",
        kind: { in: ["permanent", "provisional"] },
        status: { in: ["active", "rotation_required"] },
      },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            email: true,
            name: true,
            phone: true,
          },
        },
      },
    })
  })

  it("tracks terminal miss counters and blocks on the fifth unresolved miss", async () => {
    const now = new Date("2026-03-26T12:00:00.000Z")
    mockPrisma.kioskTerminalMissCounter.findUnique.mockResolvedValue({
      id: "counter_1",
      terminalId: "terminal_1",
      missCount: 4,
      windowStart: new Date("2026-03-26T11:55:00.000Z"),
      blockedUntil: null,
    })
    mockPrisma.kioskTerminalMissCounter.update.mockResolvedValue({
      blockedUntil: new Date("2026-03-26T12:05:00.000Z"),
      missCount: 5,
    })

    const result = await recordTerminalMiss(mockPrisma as never, "terminal_1", now)

    expect(result).toEqual({
      blocked: true,
      blockedUntil: new Date("2026-03-26T12:05:00.000Z"),
      attemptsRemaining: 0,
      missCount: 5,
    })
    expect(mockPrisma.kioskTerminalMissCounter.update).toHaveBeenCalledWith({
      where: { terminalId: "terminal_1" },
      data: {
        missCount: 5,
        windowStart: new Date("2026-03-26T11:55:00.000Z"),
        blockedUntil: new Date("2026-03-26T12:05:00.000Z"),
      },
    })
  })

  it("reports a terminal as unblocked once the miss window has expired", async () => {
    mockPrisma.kioskTerminalMissCounter.findUnique.mockResolvedValue({
      terminalId: "terminal_1",
      missCount: 5,
      windowStart: new Date("2026-03-26T11:30:00.000Z"),
      blockedUntil: new Date("2026-03-26T11:40:00.000Z"),
    })

    const result = await isTerminalBlocked(
      mockPrisma as never,
      "terminal_1",
      new Date("2026-03-26T12:00:00.000Z")
    )

    expect(result).toEqual({
      blocked: false,
      blockedUntil: null,
      attemptsRemaining: 5,
      missCount: 0,
    })
  })

  it("clears terminal miss counters after a successful identification", async () => {
    mockPrisma.kioskTerminalMissCounter.deleteMany.mockResolvedValue({ count: 1 })

    await clearTerminalMisses(mockPrisma as never, "terminal_1")

    expect(mockPrisma.kioskTerminalMissCounter.deleteMany).toHaveBeenCalledWith({
      where: { terminalId: "terminal_1" },
    })
  })

  it("locks the credential on the fifth failed attempt", async () => {
    mockPrisma.studentPinCredential.update.mockResolvedValue({ id: "cred_1" })

    await recordFailedStudentPinAttempt(mockPrisma as never, {
      credentialId: "cred_1",
      failedAttempts: 4,
      lockReason: "too_many_attempts",
    })

    expect(mockPrisma.studentPinCredential.update).toHaveBeenCalledWith({
      where: { id: "cred_1" },
      data: expect.objectContaining({
        failedAttempts: 5,
        status: "locked",
        lockReason: "too_many_attempts",
        lockedAt: expect.any(Date),
      }),
    })
  })

  it("unlocks only locked credentials and restores them to active state", async () => {
    mockPrisma.studentPinCredential.updateMany.mockResolvedValue({ count: 2 })

    const count = await unlockStudentPinCredentials(mockPrisma as never, "user_1")

    expect(count).toBe(2)
    expect(mockPrisma.studentPinCredential.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        kind: { in: ["permanent", "provisional"] },
        status: "locked",
      },
      data: {
        status: "active",
        failedAttempts: 0,
        lockedAt: null,
        lockReason: null,
      },
    })
  })

  it("marks provisional verification as rotation required", async () => {
    mockPrisma.studentPinCredential.findUnique.mockResolvedValue({ kind: "provisional" })
    mockPrisma.studentPinCredential.update.mockResolvedValue({ id: "cred_1" })

    await markStudentPinVerified(mockPrisma as never, "cred_1")

    expect(mockPrisma.studentPinCredential.update).toHaveBeenCalledWith({
      where: { id: "cred_1" },
      data: expect.objectContaining({
        status: "rotation_required",
        failedAttempts: 0,
        usedAt: expect.any(Date),
        lastVerifiedAt: expect.any(Date),
      }),
    })
  })

  it("marks consumed credentials with a timestamp", async () => {
    mockPrisma.studentPinCredential.update.mockResolvedValue({ id: "cred_1" })

    await consumeStudentPinCredential(mockPrisma as never, "cred_1")

    expect(mockPrisma.studentPinCredential.update).toHaveBeenCalledWith({
      where: { id: "cred_1" },
      data: expect.objectContaining({
        status: "consumed",
        consumedAt: expect.any(Date),
        failedAttempts: 0,
      }),
    })
  })

  it("surfaces regeneration-required status for obsolete permanent PINs", async () => {
    mockPrisma.studentPinCredential.findMany.mockResolvedValue([
      {
        kind: "permanent",
        status: "obsolete",
        failedAttempts: 0,
        lockedAt: null,
        lastVerifiedAt: new Date("2025-08-01T00:00:00.000Z"),
        lastPinAuthAt: new Date("2025-08-01T00:00:00.000Z"),
        expiresAt: null,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
      },
    ])

    const result = await getStudentPinStatus("user_1")

    expect(result).toMatchObject({
      enabled: true,
      enrolled: false,
      needsEnrollment: true,
      requiresRegeneration: true,
      permanent: {
        status: "obsolete",
        lastPinAuthAt: "2025-08-01T00:00:00.000Z",
        requiresRegeneration: true,
      },
    })
  })

  it("lazily expires stale provisional credentials when reading status", async () => {
    mockPrisma.studentPinCredential.findMany
      .mockResolvedValueOnce([
        {
          id: "prov_1",
          userId: "user_1",
          kind: "provisional",
          status: "active",
          failedAttempts: 2,
          lockedAt: null,
          lastVerifiedAt: null,
          lastPinAuthAt: null,
          expiresAt: new Date("2020-03-26T23:59:59.999Z"),
          createdAt: new Date("2026-03-26T10:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          kind: "provisional",
          status: "expired",
          failedAttempts: 0,
          lockedAt: null,
          lastVerifiedAt: null,
          lastPinAuthAt: null,
          expiresAt: new Date("2020-03-26T23:59:59.999Z"),
          createdAt: new Date("2026-03-26T10:00:00.000Z"),
        },
      ])

    const result = await getStudentPinStatus("user_1")

    expect(result).toMatchObject({
      enabled: true,
      provisional: {
        active: false,
        expiresAt: "2020-03-26T23:59:59.999Z",
      },
    })
    expect(mockPrisma.studentPinCredential.update).toHaveBeenCalledWith({
      where: { id: "prov_1" },
      data: {
        status: "expired",
        failedAttempts: 0,
        lockedAt: null,
        lockReason: null,
      },
    })
    expect(mockPrisma.studentPinAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          action: "expired",
          actorType: "system",
          credentialKind: "provisional",
        }),
      })
    )
  })

  it("lazily obsoletes stale permanent credentials when reading status", async () => {
    mockPrisma.studentPinCredential.findMany
      .mockResolvedValueOnce([
        {
          id: "perm_1",
          userId: "user_1",
          kind: "permanent",
          status: "active",
          failedAttempts: 1,
          lockedAt: new Date("2026-03-01T00:00:00.000Z"),
          lastVerifiedAt: new Date("2025-08-01T00:00:00.000Z"),
          lastPinAuthAt: new Date("2025-08-01T00:00:00.000Z"),
          expiresAt: null,
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          kind: "permanent",
          status: "obsolete",
          failedAttempts: 0,
          lockedAt: null,
          lastVerifiedAt: new Date("2025-08-01T00:00:00.000Z"),
          lastPinAuthAt: new Date("2025-08-01T00:00:00.000Z"),
          expiresAt: null,
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
        },
      ])

    const result = await getStudentPinStatus("user_1")

    expect(result).toMatchObject({
      enabled: true,
      enrolled: false,
      requiresRegeneration: true,
      permanent: {
        status: "obsolete",
        requiresRegeneration: true,
      },
    })
    expect(mockPrisma.studentPinCredential.update).toHaveBeenCalledWith({
      where: { id: "perm_1" },
      data: {
        status: "obsolete",
        failedAttempts: 0,
        lockedAt: null,
        lockReason: null,
      },
    })
    expect(mockPrisma.studentPinAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          action: "obsolete",
          actorType: "system",
          credentialKind: "permanent",
        }),
      })
    )
  })
})
