import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"

const mockClerkClient = vi.fn()
const mockAuth = vi.fn()
const mockAuthorizeStaffTerminalSession = vi.fn()
const mockReadTrustedDeviceCookie = vi.fn()
const mockValidateTrustedDeviceToken = vi.fn()
const mockEnrollTrustedDevice = vi.fn()
const mockSetTrustedDeviceCookie = vi.fn()

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
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) => mockAuthorizeStaffTerminalSession(...args),
}))

// PR3: staff-pin-gate's PERSONAL context now depends on this module.
// Default (no cookie) so PR2-era TERMINAL/CLERK_SESSION scenarios in this
// file are unaffected; PR3 grandfather-scoping tests below override the
// enroll/setCookie mocks explicitly.
vi.mock("@/lib/security/staff-trusted-device", () => ({
  readTrustedDeviceCookie: (...args: unknown[]) => mockReadTrustedDeviceCookie(...args),
  validateTrustedDeviceToken: (...args: unknown[]) => mockValidateTrustedDeviceToken(...args),
  enrollTrustedDevice: (...args: unknown[]) => mockEnrollTrustedDevice(...args),
  setTrustedDeviceCookie: (...args: unknown[]) => mockSetTrustedDeviceCookie(...args),
}))

// PR3: the terminal:{slug}:targeted aggregate cap is now derived from the
// REAL roster size (design ADR 15) instead of the PR2 fixed
// TERMINAL_TARGETED_BASE_CAP literal. Default to a large roster (40) so
// computeTerminalTargetedCap saturates at its 20 clamp — i.e. identical
// behavior to the PR2-era fixed constant — for every PR2-era scenario in
// this file that doesn't care about the cap directly. The dedicated
// "real roster size" test below overrides this with a small roster.
const mockListStaffRosterForSchool = vi.fn()
vi.mock("@/lib/security/staff-roster", () => ({
  listStaffRosterForSchool: (...args: unknown[]) => mockListStaffRosterForSchool(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff-login-pin"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn((req: Request) => req.headers.get("x-forwarded-for") || "127.0.0.1"),
}))

// In-memory fake standing in for the `staffPinAttemptCounter` Postgres table
// so the persistent throttle module runs its REAL logic end-to-end through
// the route (not a mocked rate-limit abstraction) — see staff-pin-throttle.ts.
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

const hashPin = (pin: string) => {
  const salt = "salt"
  const hash = createHash("sha256")
    .update(`${pin}:${salt}:${process.env.CLERK_SECRET_KEY || "staff-pin"}`)
    .digest("hex")
  return `${salt}:${hash}`
}

const buildTerminalSession = (overrides: Record<string, unknown> = {}) => ({
  ok: true,
  sessionId: "terminal_session_1",
  terminal: {
    id: "terminal_1",
    slug: "front-desk",
    name: "Front desk",
    location: "Lobby",
    defaultCourseSlug: null,
    active: true,
    schoolId: "school_a",
    ...overrides,
  },
})

const post = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  import("@/app/api/staff/login/pin/route").then(({ POST }) =>
    POST(
      new Request("http://localhost/api/staff/login/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      })
    )
  )

describe("staff login PIN route (Phase 2: TOTAL gate + throttle + hardened resolver)", () => {
  beforeEach(() => {
    usersApi.getUser.mockReset()
    usersApi.getUserList.mockReset()
    usersApi.updateUserMetadata.mockReset()
    signInTokensApi.createSignInToken.mockReset()
    mockClerkClient.mockReset()
    mockAuth.mockReset()
    mockAuthorizeStaffTerminalSession.mockReset()
    mockReadTrustedDeviceCookie.mockReset()
    mockValidateTrustedDeviceToken.mockReset()
    mockEnrollTrustedDevice.mockReset()
    mockSetTrustedDeviceCookie.mockReset()
    mockListStaffRosterForSchool.mockReset()
    counterStore.clear()
    delete process.env.STAFF_DEVICE_GATE_MODE

    process.env.CLERK_SECRET_KEY = "test-secret"

    mockClerkClient.mockResolvedValue({
      users: usersApi,
      signInTokens: signInTokensApi,
    })
    mockAuth.mockResolvedValue({ userId: null })
    mockAuthorizeStaffTerminalSession.mockResolvedValue(buildTerminalSession())
    mockReadTrustedDeviceCookie.mockResolvedValue("")
    mockValidateTrustedDeviceToken.mockResolvedValue(null)
    mockEnrollTrustedDevice.mockResolvedValue({ token: "new-device-token" })
    mockListStaffRosterForSchool.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({ id: `roster_${i}`, displayName: `Roster ${i}`, role: "staff" }))
    )

    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      firstName: "Ana",
      lastName: "Desk",
      primaryEmailAddress: { emailAddress: "ana@example.com" },
      publicMetadata: { role: "staff", staffCategory: "front_desk", schoolId: "school_a" },
      privateMetadata: { staffPinHash: hashPin("1234"), staffCheckInCount: 2 },
    })
    signInTokensApi.createSignInToken.mockResolvedValue({
      token: "ticket_456",
      url: "https://clerk.test/sign-in?token=ticket_456",
    })
  })

  it("creates a sign-in token and returns session fields (TERMINAL context, requestedUserId provided)", async () => {
    const res = await post({ pin: "1234", userId: "staff_1" })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.ticket).toBe("ticket_456")
    expect(data.signInUrl).toContain("redirect_url=http%3A%2F%2Flocalhost%2Fstaff%2Fresolve")
    expect(signInTokensApi.createSignInToken).toHaveBeenCalledWith({
      userId: "staff_1",
      expiresInSeconds: 300,
    })
  })

  it("does NOT mutate attendance metadata (no updateUserMetadata call)", async () => {
    await post({ pin: "1234", userId: "staff_1" })
    expect(usersApi.updateUserMetadata).not.toHaveBeenCalled()
  })

  it("does NOT return checkedInAt field", async () => {
    const res = await post({ pin: "1234", userId: "staff_1" })
    const data = await res.json()
    expect(data.checkedInAt).toBeUndefined()
  })

  it("returns staff info for a deliberately-targeted login (requestedUserId provided)", async () => {
    const res = await post({ pin: "1234", userId: "staff_1" })
    const data = await res.json()
    expect(data.staff).toEqual({
      id: "staff_1",
      name: "Ana Desk",
      role: "staff",
      category: "front_desk",
    })
  })

  it("returns 401 for invalid PIN", async () => {
    const res = await post({ pin: "9999", userId: "staff_1" })
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe("Invalid PIN.")
  })

  it("returns 400 for non-4-digit PIN", async () => {
    const res = await post({ pin: "12", userId: "staff_1" })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("PIN must be exactly 4 digits.")
  })

  it("REQUIRES requestedUserId — 400 when omitted, NEVER scans, NEVER mints a session (no blind scan-all)", async () => {
    const res = await post({ pin: "1234" })

    expect(res.status).toBe(400)
    expect(usersApi.getUserList).not.toHaveBeenCalled()
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
  })

  it("NO trusted context (no terminal session, no Clerk session) -> 403, no scan, no mint", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })

    const res = await post({ pin: "1234", userId: "staff_1" })

    expect(res.status).toBe(403)
    expect(usersApi.getUser).not.toHaveBeenCalled()
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
  })

  it("expectedSchoolId is server-derived from the terminal — a spoofed payload.schoolId is IGNORED entirely", async () => {
    // Attacker sets payload.schoolId to match, but the real terminal.schoolId
    // (school_a) differs from the target user's real school (school_b).
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      firstName: "Ana",
      lastName: "Desk",
      publicMetadata: { role: "staff", schoolId: "school_b" },
      privateMetadata: { staffPinHash: hashPin("1234") },
    })

    const res = await post({ pin: "1234", userId: "staff_1", schoolId: "school_b" })

    expect(res.status).toBe(403)
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
  })

  it("school-scope is enforced BEFORE the hash compare — 403 even with the CORRECT pin when terminal.schoolId mismatches", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      publicMetadata: { role: "staff", schoolId: "school_other" },
      privateMetadata: { staffPinHash: hashPin("1234") },
    })

    const res = await post({ pin: "1234", userId: "staff_1" })

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain("school context")
  })

  it("BRUTE-FORCE LOCKOUT: repeated wrong PINs against one victim trip a 423, regardless of ROTATED x-forwarded-for per request", async () => {
    // The 5th miss crosses the cooldown threshold and gets recorded as a 401
    // (the block takes effect starting with the NEXT request); the 6th
    // request is the one that observes the resulting 423.
    let lastRes
    for (let i = 0; i < 6; i += 1) {
      lastRes = await post({ pin: "0000", userId: "staff_1" }, { "x-forwarded-for": `10.0.0.${i}` })
    }

    expect(lastRes!.status).toBe(423)
    const data = await lastRes!.json()
    expect(data.error).toBeTruthy()
  })

  it("terminal:{slug}:targeted aggregate cap is derived from the REAL roster size (design ADR 15), not a fixed constant", async () => {
    // Small roster (4 staff) -> effectiveCap = min(20, ceil(0.5*4)) = 2 —
    // trips well before the per-user cooldown threshold (5) could.
    mockListStaffRosterForSchool.mockResolvedValue([
      { id: "r1", displayName: "R1", role: "staff" },
      { id: "r2", displayName: "R2", role: "staff" },
      { id: "r3", displayName: "R3", role: "staff" },
      { id: "r4", displayName: "R4", role: "staff" },
    ])
    usersApi.getUser.mockImplementation(async (id: string) => ({
      id,
      publicMetadata: { role: "staff", schoolId: "school_a" },
      privateMetadata: { staffPinHash: hashPin("1234") },
    }))

    // Two DIFFERENT targets, each missed once, cross the small
    // roster-derived aggregate cap; a third request (any target) then
    // observes the resulting terminal-wide 423.
    await post({ pin: "0000", userId: "staff_a" })
    await post({ pin: "0000", userId: "staff_b" })
    const res = await post({ pin: "0000", userId: "staff_c" })

    expect(res.status).toBe(423)
    expect(mockListStaffRosterForSchool).toHaveBeenCalledWith("school_a")
  })

  it("CLERK_SESSION context (monitor mode, no terminal session): self-restricted login succeeds for the caller's own id", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
    mockAuth.mockResolvedValue({ userId: "staff_1" })

    const res = await post({ pin: "1234", userId: "staff_1" })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })

  it("CLERK_SESSION context: requesting a DIFFERENT userId than the caller is rejected with 403", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
    mockAuth.mockResolvedValue({ userId: "staff_9" })
    usersApi.getUser.mockImplementation(async (id: string) =>
      id === "staff_9"
        ? { id: "staff_9", publicMetadata: { role: "staff", schoolId: "school_a" }, privateMetadata: {} }
        : {
            id: "staff_1",
            publicMetadata: { role: "staff", schoolId: "school_a" },
            privateMetadata: { staffPinHash: hashPin("1234") },
          }
    )

    const res = await post({ pin: "1234", userId: "staff_1" })

    expect(res.status).toBe(403)
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
  })

  it("ENFORCE mode: a Clerk-session-only request (no terminal/personal context) is rejected via the generic 403", async () => {
    process.env.STAFF_DEVICE_GATE_MODE = "enforce"
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
    mockAuth.mockResolvedValue({ userId: "staff_1" })

    const res = await post({ pin: "1234", userId: "staff_1" })

    expect(res.status).toBe(403)
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
  })

  describe("GRANDFATHER auto-enroll scope (PR3, design v5 ADR 13/1)", () => {
    it("CLERK_SESSION-context hit auto-enrolls the device and sets the trusted-device cookie", async () => {
      mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
      mockAuth.mockResolvedValue({ userId: "staff_1" })

      const res = await post({ pin: "1234", userId: "staff_1" })

      expect(res.status).toBe(200)
      expect(mockEnrollTrustedDevice).toHaveBeenCalledWith("staff_1")
      expect(mockSetTrustedDeviceCookie).toHaveBeenCalledOnce()
    })

    it("TERMINAL-context hit with a stray same-user Clerk session present does NOT auto-enroll", async () => {
      // Terminal session resolves normally (default mock); a stray Clerk
      // session for the SAME user is also present on the request, but
      // TERMINAL context takes precedence over CLERK_SESSION in the gate —
      // grandfather must NOT fire here (design v5 R4-WARNING fix).
      mockAuth.mockResolvedValue({ userId: "staff_1" })

      const res = await post({ pin: "1234", userId: "staff_1" })

      expect(res.status).toBe(200)
      expect(mockEnrollTrustedDevice).not.toHaveBeenCalled()
      expect(mockSetTrustedDeviceCookie).not.toHaveBeenCalled()
    })

    it("PERSONAL-context hit (already-enrolled device) does NOT re-auto-enroll", async () => {
      mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
      mockReadTrustedDeviceCookie.mockResolvedValue("existing-device-token")
      mockValidateTrustedDeviceToken.mockResolvedValue({ id: "device_1", staffUserId: "staff_1" })

      const res = await post({ pin: "1234", userId: "staff_1" })

      expect(res.status).toBe(200)
      expect(mockEnrollTrustedDevice).not.toHaveBeenCalled()
      expect(mockSetTrustedDeviceCookie).not.toHaveBeenCalled()
    })
  })
})
