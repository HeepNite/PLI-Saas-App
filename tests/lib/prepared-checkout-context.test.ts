import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPreparedCreate = vi.fn()
const mockPreparedDeleteMany = vi.fn()
const mockPreparedFindFirst = vi.fn()
const mockCookies = vi.fn()
const mockSessionFindFirst = vi.fn()
const mockSessionUpdate = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    preparedCheckoutContext: {
      create: (...args: unknown[]) => mockPreparedCreate(...args),
      deleteMany: (...args: unknown[]) => mockPreparedDeleteMany(...args),
      findFirst: (...args: unknown[]) => mockPreparedFindFirst(...args),
    },
    staffTerminalSession: {
      findFirst: (...args: unknown[]) => mockSessionFindFirst(...args),
      update: (...args: unknown[]) => mockSessionUpdate(...args),
    },
  },
}))

vi.mock("next/headers", () => ({
  cookies: (...args: unknown[]) => mockCookies(...args),
}))

describe("prepared checkout context helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PREPARED_CHECKOUT_CONTEXT = "1"
    process.env.STAFF_TERMINAL_SECRET = "terminal-secret"
    mockCookies.mockResolvedValue({
      get: () => ({ value: "terminal_token_1" }),
    })
  })

  it("replaces previous context for the same terminal session", async () => {
    const { createPreparedCheckoutContext } = await import("@/lib/checkout/prepared-context")

    await createPreparedCheckoutContext({
      terminalId: "terminal_1",
      kioskSessionId: "kiosk_session_1",
      validation: {
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        durationMinutes: 60,
      },
      preparedAccount: {
        userId: "db_user_1",
        clerkUser: null,
        resolvedUserId: "clerk_user_1",
        identity: {
          resolvedEmail: "student@example.com",
          phoneRaw: "+1 555 111 2222",
          phoneNormalized: "15551112222",
        },
        account: {
          clerkUserId: "clerk_user_1",
          created: false,
          requiresSignIn: false,
          hasAvatar: true,
        },
      },
      verification: { hasVerifiedPhone: true },
    })

    expect(mockPreparedDeleteMany).toHaveBeenCalledWith({
      where: {
        terminalId: "terminal_1",
        kioskSessionId: "kiosk_session_1",
      },
    })
    expect(mockPreparedCreate).toHaveBeenCalledTimes(1)
  })

  it("returns the replacement snapshot only for its exact fresh class slot", async () => {
    const rows: Array<Record<string, unknown>> = []
    mockPreparedDeleteMany.mockImplementation(async ({ where }) => {
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index].terminalId === where.terminalId && rows[index].kioskSessionId === where.kioskSessionId) rows.splice(index, 1)
      }
    })
    mockPreparedCreate.mockImplementation(async ({ data }) => {
      const row = { ...data, id: `prepared_${rows.length + 1}`, createdAt: new Date() }
      rows.push(row)
      return row
    })
    mockPreparedFindFirst.mockImplementation(async ({ where }) =>
      rows.find((row) =>
        Object.entries(where).every(([key, expected]) =>
          key === "expiresAt" && expected && typeof expected === "object" && "gt" in expected
            ? row.expiresAt instanceof Date && row.expiresAt > (expected as { gt: Date }).gt
            : row[key] === expected
        )
      ) || null
    )

    const { createPreparedCheckoutContext, lookupPreparedCheckoutContext, PREPARED_CHECKOUT_FALLBACK_REASONS } = await import("@/lib/checkout/prepared-context")
    const validation = { courseSlug: "salsa-femenina-matutina", date: "2026-02-24", time: "11:00", durationMinutes: 60 }
    const account = (email: string) => ({
      userId: "db_user_1", clerkUser: null, resolvedUserId: "clerk_user_1",
      identity: { resolvedEmail: email, phoneRaw: "+1 555 111 2222", phoneNormalized: "15551112222" },
      account: { clerkUserId: "clerk_user_1", created: false, requiresSignIn: false, hasAvatar: true },
    })

    await createPreparedCheckoutContext({ terminalId: "terminal_1", kioskSessionId: "kiosk_session_1", validation, preparedAccount: account("old@example.com"), verification: { hasVerifiedPhone: false } })
    await createPreparedCheckoutContext({ terminalId: "terminal_1", kioskSessionId: "kiosk_session_1", validation, preparedAccount: account("fresh@example.com"), verification: { hasVerifiedPhone: true } })

    await expect(lookupPreparedCheckoutContext({ terminalId: "terminal_1", kioskSessionId: "kiosk_session_1", validation })).resolves.toMatchObject({
      ok: true,
      preparedAccount: { identity: { resolvedEmail: "fresh@example.com" } },
      verification: { hasVerifiedPhone: true },
    })
    await expect(lookupPreparedCheckoutContext({
      terminalId: "terminal_1", kioskSessionId: "kiosk_session_1", validation: { ...validation, durationMinutes: 45 },
    })).resolves.toEqual({ ok: false, reason: PREPARED_CHECKOUT_FALLBACK_REASONS.classSlotMismatch })
  })

  it("returns class slot mismatch when another active class exists for the same session", async () => {
    mockPreparedFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "prepared_1",
        terminalId: "terminal_1",
        kioskSessionId: "kiosk_session_1",
        classSlotKey: "other-course|2026-02-24|11:00|60",
        expiresAt: new Date("2026-04-03T20:00:00.000Z"),
      })

    const { lookupPreparedCheckoutContext, PREPARED_CHECKOUT_FALLBACK_REASONS } = await import("@/lib/checkout/prepared-context")
    const result = await lookupPreparedCheckoutContext({
      terminalId: "terminal_1",
      kioskSessionId: "kiosk_session_1",
      validation: {
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        durationMinutes: 60,
      },
    })

    expect(result).toEqual({
      ok: false,
      reason: PREPARED_CHECKOUT_FALLBACK_REASONS.classSlotMismatch,
    })
  })

  it("replaces an expired matching context with a fresh server-bound snapshot", async () => {
    mockPreparedFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "prepared_1",
        terminalId: "terminal_1",
        kioskSessionId: "kiosk_session_1",
        classSlotKey: "salsa-femenina-matutina|2026-02-24|11:00|60",
        expiresAt: new Date("2026-04-03T10:00:00.000Z"),
      })

    const { createPreparedCheckoutContext, lookupPreparedCheckoutContext, PREPARED_CHECKOUT_FALLBACK_REASONS } = await import("@/lib/checkout/prepared-context")
    const validation = {
      courseSlug: "salsa-femenina-matutina",
      date: "2026-02-24",
      time: "11:00",
      durationMinutes: 60,
    }
    const result = await lookupPreparedCheckoutContext({ terminalId: "terminal_1", kioskSessionId: "kiosk_session_1", validation })

    expect(result).toEqual({ ok: false, reason: PREPARED_CHECKOUT_FALLBACK_REASONS.expired })

    await createPreparedCheckoutContext({
      terminalId: "terminal_1",
      kioskSessionId: "kiosk_session_1",
      validation,
      preparedAccount: {
        userId: "db_user_1", clerkUser: null, resolvedUserId: "clerk_user_1",
        identity: { resolvedEmail: "student@example.com", phoneRaw: "+1 555 111 2222", phoneNormalized: "15551112222" },
        account: { clerkUserId: "clerk_user_1", created: false, requiresSignIn: false, hasAvatar: true },
      },
      verification: { hasVerifiedPhone: true },
    })

    expect(mockPreparedDeleteMany).toHaveBeenCalledWith({ where: { terminalId: "terminal_1", kioskSessionId: "kiosk_session_1" } })
    expect(mockPreparedCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        terminalId: "terminal_1", kioskSessionId: "kiosk_session_1",
        classSlotKey: "salsa-femenina-matutina|2026-02-24|11:00|60",
        verificationSnapshot: { hasVerifiedPhone: true },
      }),
    }))
  })
})

describe("staff terminal session lastSeen throttling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STAFF_TERMINAL_SECRET = "terminal-secret"
    mockCookies.mockResolvedValue({
      get: () => ({ value: "terminal_token_1" }),
    })
  })

  it("skips lastSeen writes when the session was touched recently", async () => {
    mockSessionFindFirst.mockResolvedValue({
      id: "session_1",
      lastSeenAt: new Date(Date.now() - 10_000),
      terminal: {
        id: "terminal_1",
        slug: "terminal-1",
        name: "Terminal 1",
        location: null,
        defaultCourseSlug: null,
        active: true,
      },
    })

    const { authorizeStaffTerminalSession } = await import("@/lib/security/staff-terminal")
    const result = await authorizeStaffTerminalSession()

    expect(result).toMatchObject({ ok: true })
    expect(mockSessionUpdate).not.toHaveBeenCalled()
  })

  it("does not write a stale session when authorization explicitly disables lastSeen updates", async () => {
    mockSessionFindFirst.mockResolvedValue({
      id: "session_1", lastSeenAt: null,
      terminal: { id: "terminal_1", active: true },
    })
    const { authorizeStaffTerminalSession } = await import("@/lib/security/staff-terminal")
    expect(await authorizeStaffTerminalSession({ touchLastSeen: false })).toMatchObject({ ok: true })
    expect(mockSessionUpdate).not.toHaveBeenCalled()
  })

  it.each(["missing", "expired", "inactive"])("denies %s terminal sessions without writing", async (reason) => {
    if (reason === "missing") mockCookies.mockResolvedValue({ get: () => undefined })
    mockSessionFindFirst.mockResolvedValue(reason === "inactive" ? { terminal: { active: false } } : null)
    const { authorizeStaffTerminalSession } = await import("@/lib/security/staff-terminal")
    expect(await authorizeStaffTerminalSession({ touchLastSeen: false })).toEqual({ ok: false, reason })
    expect(mockSessionUpdate).not.toHaveBeenCalled()
    if (reason === "missing") expect(mockSessionFindFirst).not.toHaveBeenCalled()
  })
})
