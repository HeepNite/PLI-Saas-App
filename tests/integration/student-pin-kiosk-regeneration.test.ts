import { beforeEach, describe, expect, it, vi } from "vitest"

const shared = vi.hoisted(() => {
  const user = {
    id: "user_1",
    clerkId: "clerk_user_1",
    email: "student@example.com",
    name: "Student Example",
    phone: "+1 555 111 2222",
  }

  const permanentCredential = {
    id: "perm_1",
    userId: user.id,
    kind: "permanent",
    status: "obsolete_due_to_inactivity",
    pinHash: "hash",
    pinLookupDigest: "digest_1234",
  }

  return {
    user,
    permanentCredential,
    sessions: new Map<string, {
      id: string
      userId: string
      terminalId: string
      credentialKind: string
      requiresPinRotation: boolean
      rotationBypassed: boolean
      expiresAt: Date
      lastActivityAt: Date
      user: typeof user
    }>(),
    terminalAuth: {
      ok: true as const,
      sessionId: "terminal_session_1",
      terminal: {
        id: "terminal_1",
        slug: "front-desk",
        name: "Front desk",
        location: "Lobby",
        defaultCourseSlug: null,
        active: true,
      },
    },
  }
})

const mockPrisma = {
  studentPinCredential: {
    findUnique: vi.fn(),
  },
  kioskIdentificationSession: {
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}

const mockAuth = vi.fn()
const mockAuthorizeStaffTerminalSession = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: vi.fn(),
}))

vi.mock("@clerk/backend", () => ({
  verifyToken: vi.fn(),
}))

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "rate-limit-key"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}))

vi.mock("@/lib/checkin/kiosk-session", () => ({
  createKioskIdentificationSession: vi.fn(async (_db: unknown, input: {
    terminalId: string
    userId: string
    credentialKind: string
    requiresPinRotation: boolean
  }) => {
    const now = new Date("2026-03-26T12:00:00.000Z")
    const session = {
      id: `session_${shared.sessions.size + 1}`,
      userId: input.userId,
      terminalId: input.terminalId,
      credentialKind: input.credentialKind,
      requiresPinRotation: input.requiresPinRotation,
      rotationBypassed: false,
      expiresAt: new Date("2026-03-26T12:15:00.000Z"),
      lastActivityAt: now,
      user: shared.user,
    }
    shared.sessions.set(session.id, session)
    return session
  }),
  resolveTerminalKioskSession: vi.fn(async (sessionToken: unknown, options: { allowRotationRequired?: boolean } = {}) => {
    const normalizedToken = typeof sessionToken === "string" ? sessionToken.trim() : ""
    if (!normalizedToken) {
      return {
        ok: false as const,
        status: 400,
        error: "Missing kiosk session token.",
      }
    }

    const terminalAuth = await mockAuthorizeStaffTerminalSession()
    if (!terminalAuth.ok) {
      return {
        ok: false as const,
        status: 401,
        error: "Terminal session required for kiosk checkout.",
      }
    }

    const session = shared.sessions.get(normalizedToken)
    if (!session) {
      return {
        ok: false as const,
        status: 401,
        error: "Kiosk identification session expired.",
      }
    }

    if (session.requiresPinRotation && !options.allowRotationRequired && !session.rotationBypassed) {
      return {
        ok: false as const,
        status: 409,
        error: "PIN rotation is required before continuing.",
        code: "PIN_ROTATION_REQUIRED",
      }
    }

    session.lastActivityAt = new Date("2026-03-26T12:05:00.000Z")

    return {
      ok: true as const,
      terminalAuth,
      session,
    }
  }),
}))

vi.mock("@/lib/security/student-pin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security/student-pin")>("@/lib/security/student-pin")

  return {
    ...actual,
    assertStudentPinConfirmation: (nextPin: string, confirmPin: string) => {
      if (!/^\d{4}$/.test(nextPin)) return { status: 400, error: "PIN must be exactly 4 digits." }
      if (nextPin !== confirmPin) return { status: 400, error: "PIN confirmation does not match." }
      return null
    },
    clearStudentPinLockout: vi.fn(async () => null),
    clearTerminalMisses: vi.fn(async () => null),
    consumeStudentPinCredential: vi.fn(async () => null),
    createStudentPinLookupDigest: vi.fn(() => "digest_1234"),
    isStudentPinConflictError: (error: unknown) =>
      Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "PIN_ALREADY_IN_USE"),
    isStudentPinFormatValid: (value: string) => /^\d{4}$/.test(value),
    isStudentPinLifecycleEnabled: () => true,
    isStudentPinObsolete: (credential: { status: string }) => credential.status.startsWith("obsolete"),
    isTerminalBlocked: vi.fn(async () => ({
      blocked: false,
      blockedUntil: null,
      attemptsRemaining: 5,
      missCount: 0,
    })),
    lookupActiveCredentialByDigest: vi.fn(async () => shared.permanentCredential),
    markStudentPinObsolete: vi.fn(async () => {
      shared.permanentCredential.status = "obsolete"
      return shared.permanentCredential
    }),
    markStudentPinVerified: vi.fn(async () => shared.permanentCredential),
    recordTerminalMiss: vi.fn(async () => ({
      blocked: false,
      blockedUntil: null,
      attemptsRemaining: 4,
      missCount: 1,
    })),
    replacePermanentStudentPin: vi.fn(async (_db: unknown, input: { userId: string; nextPin: string }) => {
      shared.permanentCredential.userId = input.userId
      shared.permanentCredential.status = "active"
      shared.permanentCredential.pinLookupDigest = `digest_${input.nextPin}`
      return {
        id: shared.permanentCredential.id,
        kind: "permanent",
        status: "active",
      }
    }),
    syncStudentPinLifecycleForCredential: vi.fn(async () => {
      shared.permanentCredential.status = "obsolete"
      return {
        ...shared.permanentCredential,
        status: "obsolete",
      }
    }),
    verifyStudentPinHash: vi.fn(async () => true),
  }
})

vi.mock("@/lib/security/student-pin-audit", () => ({
  STUDENT_PIN_AUDIT_ACTIONS: {
    KIOSK_IDENTIFIED: "kiosk_identified",
    OBSOLETE: "obsolete",
    ROTATED: "rotated",
    ENROLLED: "enrolled",
  },
  writeStudentPinAudit: vi.fn(async () => null),
}))

vi.mock("@/lib/clerk-users", () => ({
  ensureClerkUser: vi.fn(),
  findClerkUserByIdentifiers: vi.fn(),
  resolveAvatarState: vi.fn(() => ({ hasAvatar: false, needsRefresh: false })),
  updateClerkUserIfMissing: vi.fn(),
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: vi.fn(),
}))

describe("obsolete kiosk PIN regeneration continuation", () => {
  beforeEach(() => {
    vi.resetModules()
    shared.sessions.clear()
    shared.permanentCredential.status = "obsolete_due_to_inactivity"
    shared.permanentCredential.pinLookupDigest = "digest_1234"

    mockAuth.mockReset()
    mockAuthorizeStaffTerminalSession.mockReset()
    mockPrisma.studentPinCredential.findUnique.mockReset()
    mockPrisma.kioskIdentificationSession.update.mockReset()
    mockPrisma.$transaction.mockReset()

    mockAuth.mockResolvedValue({ userId: null })
    mockAuthorizeStaffTerminalSession.mockResolvedValue(shared.terminalAuth)
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma))
    mockPrisma.studentPinCredential.findUnique.mockImplementation(async (input: {
      where: { userId_kind: { kind: string } }
    }) => {
      if (input.where.userId_kind.kind === "provisional") {
        return null
      }

      return {
        id: shared.permanentCredential.id,
        status: shared.permanentCredential.status === "obsolete_due_to_inactivity" ? "obsolete" : shared.permanentCredential.status,
      }
    })
    mockPrisma.kioskIdentificationSession.update.mockImplementation(async ({
      where,
      data,
    }: {
      where: { id: string }
      data: { credentialKind: string; requiresPinRotation: boolean; rotationBypassed: boolean }
    }) => {
      const session = shared.sessions.get(where.id)
      if (!session) throw new Error("Missing kiosk session")
      Object.assign(session, data)
      return session
    })
  })

  it("allows checkout continuation after obsolete identify and regeneration", async () => {
    const { POST: identifyPin } = await import("@/app/api/checkin/pin/identify/route")
    const identifyResponse = await identifyPin(
      new Request("http://localhost/api/checkin/pin/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: "1234" }),
      })
    )

    expect(identifyResponse.status).toBe(200)
    const identifyPayload = await identifyResponse.json()
    expect(identifyPayload).toMatchObject({
      identified: true,
      requiresPinRotation: true,
      requiresPinRegeneration: true,
      regenerationReason: "obsolete",
    })

    const { prepareCheckoutAccount } = await import("@/lib/checkout")
    await expect(
      prepareCheckoutAccount(
        new Request("http://localhost/checkout"),
        {},
        {
          photoContext: "kiosk_terminal",
          kioskSessionToken: identifyPayload.sessionToken,
        }
      )
    ).resolves.toMatchObject({
      status: 409,
      error: "PIN rotation is required before continuing.",
    })

    const { POST: rotatePin } = await import("@/app/api/checkin/pin/rotate/route")
    const rotateResponse = await rotatePin(
      new Request("http://localhost/api/checkin/pin/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken: identifyPayload.sessionToken,
          nextPin: "2468",
          confirmPin: "2468",
        }),
      })
    )

    expect(rotateResponse.status).toBe(200)
    await expect(rotateResponse.json()).resolves.toEqual({
      rotated: true,
      credential: {
        id: "perm_1",
        kind: "permanent",
        status: "active",
      },
    })

    const prepared = await prepareCheckoutAccount(
      new Request("http://localhost/checkout"),
      {},
      {
        photoContext: "kiosk_terminal",
        kioskSessionToken: identifyPayload.sessionToken,
      }
    )

    expect("status" in prepared).toBe(false)
    if ("status" in prepared) throw new Error("Expected prepared checkout account")

    expect(prepared).toMatchObject({
      resolvedUserId: "clerk_user_1",
      identity: {
        resolvedEmail: "student@example.com",
        phoneNormalized: "15551112222",
      },
      account: {
        clerkUserId: "clerk_user_1",
        created: false,
        requiresSignIn: false,
        hasAvatar: true,
      },
    })
  })
})
