import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"

const mockClerkClient = vi.fn()
const mockAuth = vi.fn()
const mockAuthorizeStaffTerminalSession = vi.fn()
const mockCreateTeacherClockEntryWithSlugs = vi.fn()
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
vi.mock("@/lib/security/staff-trusted-device", () => ({
  readTrustedDeviceCookie: (...args: unknown[]) => mockReadTrustedDeviceCookie(...args),
  validateTrustedDeviceToken: (...args: unknown[]) => mockValidateTrustedDeviceToken(...args),
  enrollTrustedDevice: (...args: unknown[]) => mockEnrollTrustedDevice(...args),
  setTrustedDeviceCookie: (...args: unknown[]) => mockSetTrustedDeviceCookie(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  buildRateLimitKey: vi.fn(() => "staff-checkin-pin"),
  consumeRateLimit: vi.fn(() => ({ ok: true })),
  getClientIp: vi.fn((req: Request) => req.headers.get("x-forwarded-for") || "127.0.0.1"),
}))

vi.mock("@/lib/clock/teacher-clock", () => ({
  createTeacherClockEntryWithSlugs: (...args: unknown[]) => mockCreateTeacherClockEntryWithSlugs(...args),
}))

// PR3: terminal:{slug}:targeted aggregate cap is now derived from the REAL
// roster size (design ADR 15). Default to a large roster (40) so
// computeTerminalTargetedCap saturates at its 20 clamp, matching the PR2
// fixed constant, for scenarios that don't test the cap directly.
const mockListStaffRosterForSchool = vi.fn()
vi.mock("@/lib/security/staff-roster", () => ({
  listStaffRosterForSchool: (...args: unknown[]) => mockListStaffRosterForSchool(...args),
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
  import("@/app/api/staff/checkin/pin/route").then(({ POST }) =>
    POST(
      new Request("http://localhost/api/staff/checkin/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      })
    )
  )

describe("staff checkin PIN route (Phase 2: TOTAL gate + throttle + hardened resolver)", () => {
  beforeEach(() => {
    usersApi.getUser.mockReset()
    usersApi.getUserList.mockReset()
    usersApi.updateUserMetadata.mockReset()
    signInTokensApi.createSignInToken.mockReset()
    mockClerkClient.mockReset()
    mockAuth.mockReset()
    mockAuthorizeStaffTerminalSession.mockReset()
    mockCreateTeacherClockEntryWithSlugs.mockReset()
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
    usersApi.updateUserMetadata.mockResolvedValue({ id: "staff_1" })
    signInTokensApi.createSignInToken.mockResolvedValue({
      token: "ticket_123",
      url: "https://clerk.test/sign-in?token=ticket_123",
    })
    mockCreateTeacherClockEntryWithSlugs.mockResolvedValue(undefined)
  })

  it("returns no session fields when skipSession is true", async () => {
    const res = await post({ pin: "1234", userId: "staff_1", skipSession: true })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.ticket).toBeUndefined()
    expect(data.signInUrl).toBeUndefined()
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
  })

  it("returns 400 when skipSession is false (legacy login path removed)", async () => {
    const res = await post({ pin: "1234", userId: "staff_1", skipSession: false })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("check-in only")
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
    expect(usersApi.updateUserMetadata).not.toHaveBeenCalled()
  })

  it("returns 400 when skipSession is omitted (legacy login path removed)", async () => {
    const res = await post({ pin: "1234", userId: "staff_1" })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("check-in only")
    expect(signInTokensApi.createSignInToken).not.toHaveBeenCalled()
    expect(usersApi.updateUserMetadata).not.toHaveBeenCalled()
  })

  it("never returns signInUrl or ticket fields regardless of request shape", async () => {
    const res1 = await post({ pin: "1234", userId: "staff_1", skipSession: false })
    const data1 = await res1.json()
    expect(data1.signInUrl).toBeUndefined()
    expect(data1.ticket).toBeUndefined()

    const res2 = await post({ pin: "1234", userId: "staff_1" })
    const data2 = await res2.json()
    expect(data2.signInUrl).toBeUndefined()
    expect(data2.ticket).toBeUndefined()
  })

  it("check-in mode mutates attendance metadata (staffLastCheckInAt, staffCheckInCount, staffPresenceStatus)", async () => {
    await post({ pin: "1234", userId: "staff_1", skipSession: true })

    expect(usersApi.updateUserMetadata).toHaveBeenCalledTimes(1)
    const [userId, metadataUpdate] = usersApi.updateUserMetadata.mock.calls[0]
    expect(userId).toBe("staff_1")
    expect(metadataUpdate.privateMetadata).toMatchObject({
      staffCheckInCount: 3,
      staffPresenceStatus: "online",
    })
    expect(metadataUpdate.privateMetadata.staffLastCheckInAt).toBeTruthy()
  })

  it("check-in mode returns checkedInAt timestamp with full staff info for a targeted (requestedUserId) check-in", async () => {
    const res = await post({ pin: "1234", userId: "staff_1", skipSession: true })

    const data = await res.json()
    expect(data.checkedInAt).toBeTruthy()
    expect(data.staff).toEqual({
      id: "staff_1",
      name: "Ana Desk",
      role: "staff",
      category: "front_desk",
    })
  })

  it("NO trusted context (no terminal session, no Clerk session) -> 403, no scan, no mutation", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })

    const res = await post({ pin: "1234", userId: "staff_1", skipSession: true })

    expect(res.status).toBe(403)
    expect(usersApi.getUser).not.toHaveBeenCalled()
    expect(usersApi.updateUserMetadata).not.toHaveBeenCalled()
  })

  it("ANONYMOUS SCAN-ALL (TERMINAL context, no requestedUserId): PII-trimmed success — only id, no name/role/category", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [
        {
          id: "staff_1",
          firstName: "Ana",
          lastName: "Desk",
          publicMetadata: { role: "staff", staffCategory: "front_desk", schoolId: "school_a" },
          privateMetadata: { staffPinHash: hashPin("1234") },
        },
      ],
    })

    const res = await post({ pin: "1234", skipSession: true })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.staff).toEqual({ id: "staff_1" })
  })

  it("ANONYMOUS SCAN-ALL from a non-enrolled/non-trusted device is rejected BEFORE any user-list scan", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })

    const res = await post({ pin: "1234", skipSession: true })

    expect(res.status).toBe(403)
    expect(usersApi.getUserList).not.toHaveBeenCalled()
  })

  it("scan-all mode is school-scoped BEFORE compare — a same-pin candidate outside the terminal's school is excluded", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [
        {
          id: "staff_out_of_school",
          publicMetadata: { role: "staff", schoolId: "school_other" },
          privateMetadata: { staffPinHash: hashPin("1234") },
        },
        {
          id: "staff_1",
          firstName: "Ana",
          lastName: "Desk",
          publicMetadata: { role: "staff", schoolId: "school_a" },
          privateMetadata: { staffPinHash: hashPin("1234") },
        },
      ],
    })

    const res = await post({ pin: "1234", skipSession: true })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.staff.id).toBe("staff_1")
  })

  it("BRUTE-FORCE LOCKOUT: repeated wrong PINs against one victim trip a 423, regardless of ROTATED x-forwarded-for per request", async () => {
    let lastRes
    for (let i = 0; i < 6; i += 1) {
      lastRes = await post({ pin: "0000", userId: "staff_1", skipSession: true }, { "x-forwarded-for": `10.0.0.${i}` })
    }

    expect(lastRes!.status).toBe(423)
  })

  it("terminal:{slug}:targeted aggregate cap is derived from the REAL roster size (design ADR 15), not a fixed constant", async () => {
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

    await post({ pin: "0000", userId: "staff_a", skipSession: true })
    await post({ pin: "0000", userId: "staff_b", skipSession: true })
    const res = await post({ pin: "0000", userId: "staff_c", skipSession: true })

    expect(res.status).toBe(423)
    expect(mockListStaffRosterForSchool).toHaveBeenCalledWith("school_a")
  })

  it("school-scope is enforced BEFORE the hash compare for a targeted check-in — 403 even with the CORRECT pin", async () => {
    usersApi.getUser.mockResolvedValue({
      id: "staff_1",
      publicMetadata: { role: "staff", schoolId: "school_other" },
      privateMetadata: { staffPinHash: hashPin("1234") },
    })

    const res = await post({ pin: "1234", userId: "staff_1", skipSession: true })

    expect(res.status).toBe(403)
    expect(usersApi.updateUserMetadata).not.toHaveBeenCalled()
  })

  it("CLERK_SESSION context (monitor mode, no terminal session): self-restricted check-in succeeds for the caller's own id", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
    mockAuth.mockResolvedValue({ userId: "staff_1" })

    const res = await post({ pin: "1234", userId: "staff_1", skipSession: true })

    expect(res.status).toBe(200)
  })

  it("ENFORCE mode: a Clerk-session-only request (no terminal/personal context) is rejected via the generic 403", async () => {
    process.env.STAFF_DEVICE_GATE_MODE = "enforce"
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
    mockAuth.mockResolvedValue({ userId: "staff_1" })

    const res = await post({ pin: "1234", userId: "staff_1", skipSession: true })

    expect(res.status).toBe(403)
    expect(usersApi.updateUserMetadata).not.toHaveBeenCalled()
  })

  describe("GRANDFATHER auto-enroll scope (PR3, design v5 ADR 13/1)", () => {
    it("CLERK_SESSION-context hit auto-enrolls the device and sets the trusted-device cookie", async () => {
      mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
      mockAuth.mockResolvedValue({ userId: "staff_1" })

      const res = await post({ pin: "1234", userId: "staff_1", skipSession: true })

      expect(res.status).toBe(200)
      expect(mockEnrollTrustedDevice).toHaveBeenCalledWith("staff_1")
      expect(mockSetTrustedDeviceCookie).toHaveBeenCalledOnce()
    })

    it("TERMINAL-context hit with a stray same-user Clerk session present does NOT auto-enroll", async () => {
      mockAuth.mockResolvedValue({ userId: "staff_1" })

      const res = await post({ pin: "1234", userId: "staff_1", skipSession: true })

      expect(res.status).toBe(200)
      expect(mockEnrollTrustedDevice).not.toHaveBeenCalled()
      expect(mockSetTrustedDeviceCookie).not.toHaveBeenCalled()
    })

    it("PERSONAL-context hit (already-enrolled device) does NOT re-auto-enroll", async () => {
      mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "missing" })
      mockReadTrustedDeviceCookie.mockResolvedValue("existing-device-token")
      mockValidateTrustedDeviceToken.mockResolvedValue({ id: "device_1", staffUserId: "staff_1" })

      const res = await post({ pin: "1234", userId: "staff_1", skipSession: true })

      expect(res.status).toBe(200)
      expect(mockEnrollTrustedDevice).not.toHaveBeenCalled()
      expect(mockSetTrustedDeviceCookie).not.toHaveBeenCalled()
    })

    it("TERMINAL scan-all hit (no requestedUserId) does NOT auto-enroll", async () => {
      usersApi.getUserList.mockResolvedValue({
        data: [
          {
            id: "staff_1",
            firstName: "Ana",
            lastName: "Desk",
            publicMetadata: { role: "staff", staffCategory: "front_desk", schoolId: "school_a" },
            privateMetadata: { staffPinHash: hashPin("1234") },
          },
        ],
      })

      const res = await post({ pin: "1234", skipSession: true })

      expect(res.status).toBe(200)
      expect(mockEnrollTrustedDevice).not.toHaveBeenCalled()
      expect(mockSetTrustedDeviceCookie).not.toHaveBeenCalled()
    })
  })
})
