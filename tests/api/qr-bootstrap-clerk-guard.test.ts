import { beforeEach, describe, expect, it, vi } from "vitest"

const BOOTSTRAP_URL = "http://localhost/api/checkin/qr/bootstrap"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockGetUser = vi.fn()
const mockResolveTerminalKioskSession = vi.fn()
const mockGetCatalogCourseBySlug = vi.fn()
const mockPackageFindMany = vi.fn()
const mockPurchaseFindMany = vi.fn()
const mockPurchaseFindFirst = vi.fn()
const mockPurchaseCount = vi.fn().mockResolvedValue(0)
const mockUpsertUserByIdentifiers = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockCreatePreparedCheckoutContext = vi.fn()
const mockFindClerkUserByIdentifiers = vi.fn()

const mockDayOfWeekFindUnique = vi.fn().mockResolvedValue(null)
const mockClassSessionFindUnique = vi.fn().mockResolvedValue(null)
const mockAttendanceFindUnique = vi.fn().mockResolvedValue(null)

const resetNestGatewayEnv = () => {
  delete process.env.NEST_GATEWAY_ENABLED
  delete process.env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED
  delete process.env.NEST_BACKEND_INTERNAL_URL
  delete process.env.NEST_GATEWAY_SHARED_SECRET
  delete process.env.NEST_GATEWAY_TIMEOUT_MS
}

const createRequest = (body: Record<string, unknown>) =>
  new Request(BOOTSTRAP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

vi.mock("@/lib/prisma", () => ({
  prisma: {
    packagePurchase: {
      findMany: (...args: unknown[]) => mockPackageFindMany(...args),
    },
    purchase: {
      findMany: (...args: unknown[]) => mockPurchaseFindMany(...args),
      findFirst: (...args: unknown[]) => mockPurchaseFindFirst(...args),
      count: (...args: unknown[]) => mockPurchaseCount(...args),
    },
    dayOfWeekPurchaseCount: {
      findUnique: (...args: unknown[]) => mockDayOfWeekFindUnique(...args),
    },
    classSession: {
      findUnique: (...args: unknown[]) => mockClassSessionFindUnique(...args),
    },
    attendance: {
      findUnique: (...args: unknown[]) => mockAttendanceFindUnique(...args),
    },
  },
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/checkin/kiosk-session", () => ({
  resolveTerminalKioskSession: (...args: unknown[]) => mockResolveTerminalKioskSession(...args),
}))

vi.mock("@/lib/catalog-courses", () => ({
  getCatalogCourseBySlug: (...args: unknown[]) => mockGetCatalogCourseBySlug(...args),
}))

vi.mock("@/lib/users", () => ({
  upsertUserByIdentifiers: (...args: unknown[]) => mockUpsertUserByIdentifiers(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("@/lib/checkout/prepared-context", async () => {
  const actual = await vi.importActual<typeof import("@/lib/checkout/prepared-context")>("@/lib/checkout/prepared-context")
  return {
    ...actual,
    createPreparedCheckoutContext: (...args: unknown[]) => mockCreatePreparedCheckoutContext(...args),
    isPreparedCheckoutContextEnabled: () => true,
  }
})

vi.mock("@/lib/clerk-users", async () => {
  const actual = await vi.importActual<typeof import("@/lib/clerk-users")>("@/lib/clerk-users")
  return {
    ...actual,
    findClerkUserByIdentifiers: (...args: unknown[]) => mockFindClerkUserByIdentifiers(...args),
  }
})

const FALLBACK_CLERK_USER = {
  id: "clerk_user_fallback",
  firstName: "Jane",
  lastName: "Student",
  hasImage: true,
  primaryEmailAddress: { emailAddress: "student@example.com" },
  primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
  phoneNumbers: [],
}

describe("qr check-in bootstrap route — Clerk lookup guards", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockGetUser.mockReset()
    mockResolveTerminalKioskSession.mockReset()
    mockGetCatalogCourseBySlug.mockReset()
    mockPackageFindMany.mockReset()
    mockPurchaseFindMany.mockReset()
    mockPurchaseFindFirst.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()
    mockCreatePreparedCheckoutContext.mockReset()
    mockFindClerkUserByIdentifiers.mockReset()
    mockDayOfWeekFindUnique.mockReset()
    mockDayOfWeekFindUnique.mockResolvedValue(null)
    mockClassSessionFindUnique.mockReset()
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockAttendanceFindUnique.mockReset()
    mockAttendanceFindUnique.mockResolvedValue(null)
    resetNestGatewayEnv()

    mockClerkClient.mockResolvedValue({
      users: {
        getUser: mockGetUser,
        getUserList: vi.fn().mockResolvedValue({ data: [] }),
      },
    })
    mockGetCatalogCourseBySlug.mockResolvedValue({
      slug: "salsa-femenina-matutina",
      title: "Salsa Femenina Matutina",
      enrollment: {
        services: [{ id: "dropin", label: "Drop-in", price: 20 }],
        packages: [],
        addons: [],
      },
    })
    mockPackageFindMany.mockResolvedValue([])
    mockPurchaseFindMany.mockResolvedValue([])
    mockPurchaseFindFirst.mockResolvedValue(null)
    mockPurchaseCount.mockReset()
    mockPurchaseCount.mockResolvedValue(0)
    mockUpsertUserByIdentifiers.mockResolvedValue({
      id: "db_user_1",
      name: "Jane Student",
      email: "student@example.com",
      phone: "15551112222",
    })
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    vi.unstubAllGlobals()
  })

  // Scenario: Stale clerkId falls back cleanly (qr/bootstrap) — main lookup,
  // reached via the kioskUser?.clerkId branch (customerClerkUserId is null).
  it("falls back to findClerkUserByIdentifiers when the main getCachedClerkUser lookup throws, and does not 500", async () => {
    mockGetUser.mockRejectedValue(new Error("Clerk 404: not found on this instance"))
    mockFindClerkUserByIdentifiers.mockResolvedValue(FALLBACK_CLERK_USER)
    mockAuth.mockResolvedValue({ userId: null })
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "db_user_1",
          clerkId: "stale_clerk_id",
          email: "student@example.com",
          name: "Jane Student",
          phone: "15551112222",
        },
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        kioskSessionToken: "session_1",
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.customer.hasAvatar).toBe(true)
    expect(mockFindClerkUserByIdentifiers).toHaveBeenCalled()
  })

  // Scenario: Fallback also finds nothing — continues with clerkUser = null, no throw.
  // The route still resolves a dbUser via upsertUserByIdentifiers since
  // customerClerkUserId is not set in this branch's kioskUser-only path, so we
  // assert no 500 and a graceful customer payload with defaults preserved.
  it("does not 500 when both the main lookup and the fallback miss", async () => {
    mockGetUser.mockRejectedValue(new Error("Clerk 404: not found on this instance"))
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockAuth.mockResolvedValue({ userId: null })
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "db_user_1",
          clerkId: "stale_clerk_id",
          email: "student@example.com",
          name: "Jane Student",
          phone: "15551112222",
        },
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        kioskSessionToken: "session_1",
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.customer.phone).toBe("15551112222")
  })

  // Scenario: resolveKioskCustomerClerkAuth's own getUser lookup throws
  // (kiosk_terminal flowContext, authResult.userId is non-null — a stale/
  // cross-instance clerkId on the AUTHENTICATED kiosk customer session
  // itself, not the kioskUser record). The route must degrade to its
  // phone/email fallback path instead of surfacing a 500.
  it("falls back to the phone/email path when resolveKioskCustomerClerkAuth's getUser throws for a non-null authResult.userId", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_customer_authenticated" })
    mockGetUser.mockRejectedValue(new Error("Clerk 404: not found on this instance"))
    mockFindClerkUserByIdentifiers.mockResolvedValue(FALLBACK_CLERK_USER)
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        id: "kiosk_session_1",
        user: {
          id: "db_user_1",
          clerkId: null,
          email: "student@example.com",
          name: "Jane Student",
          phone: "+1 555 111 2222",
        },
      },
      terminalAuth: { terminal: { id: "terminal_1" } },
    })

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        kioskSessionToken: "session_1",
        flowContext: "kiosk_terminal",
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.customer.firstName).toBe("Jane")
  })

  // Scenario: resolveKioskCustomerClerkAuth's own getUser lookup throws AND
  // no kioskSessionToken is supplied (kiosk_terminal flowContext,
  // authResult.userId is non-null). shouldPreferKioskSession is false and
  // shouldResolveKioskSession is false (no token), so kioskSessionResult
  // stays null. Previously the guard's `!customerClerkUserId &&
  // !kioskSessionResult?.ok` short-circuited to 401 here because
  // resolveKioskCustomerClerkAuth degraded to userId: null on a lookup
  // failure — before the route's own getCachedClerkUser/
  // findClerkUserByIdentifiers fallback block ever ran. The route must
  // reach that fallback and resolve 200 instead.
  it("falls back to the phone/email path when resolveKioskCustomerClerkAuth's getUser throws and no kioskSessionToken is supplied", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_customer_authenticated" })
    mockGetUser.mockRejectedValue(new Error("Clerk 404: not found on this instance"))
    mockFindClerkUserByIdentifiers.mockResolvedValue(FALLBACK_CLERK_USER)
    mockResolveTerminalKioskSession.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        flowContext: "kiosk_terminal",
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.customer.firstName).toBe("Jane")
    expect(mockResolveTerminalKioskSession).not.toHaveBeenCalled()
  })

  // Scenario: avatar-refresh guard — customerClerkUserId/kioskUser?.clerkId branch
  // (first avatar-refresh call site). clerkUser is kept, refresh skipped, no re-lookup.
  it("keeps the resolved clerkUser and skips the refresh when the avatar-refresh getCachedClerkUser call throws (customerClerkUserId/kioskUser branch)", async () => {
    // Main lookup succeeds without hasImage set (needsRefresh: true), then the
    // avatar-refresh call throws.
    mockGetUser
      .mockResolvedValueOnce({ ...FALLBACK_CLERK_USER, hasImage: undefined })
      .mockRejectedValueOnce(new Error("transient Clerk error"))
    mockAuth.mockResolvedValue({ userId: null })
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "db_user_1",
          clerkId: "clerk_user_1",
          email: "student@example.com",
          name: "Jane Student",
          phone: "15551112222",
        },
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        kioskSessionToken: "session_1",
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.customer.firstName).toBe("Jane")
    expect(data.customer.hasAvatar).toBe(false)
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    expect(mockGetUser).toHaveBeenCalledTimes(2)
  })

  // Scenario: avatar-refresh guard — findClerkUserByIdentifiers else-branch
  // (second avatar-refresh call site). clerkUser is kept, refresh skipped, no re-lookup.
  it("keeps the resolved clerkUser and skips the refresh when the avatar-refresh getCachedClerkUser call throws (findClerkUserByIdentifiers else-branch)", async () => {
    mockFindClerkUserByIdentifiers.mockResolvedValue({
      ...FALLBACK_CLERK_USER,
      hasImage: undefined,
    })
    mockGetUser.mockRejectedValue(new Error("transient Clerk error"))
    mockAuth.mockResolvedValue({ userId: null })
    // No kioskSessionToken/session and no customerClerkUserId — forces the
    // `else if (email || kioskPhoneRaw)` branch. Use flowContext other than
    // kiosk_terminal so shouldPreferKioskSession stays false, and supply no
    // kioskSessionToken so kioskUser stays null; identify via query params is
    // not modeled by this route, so we emulate reaching the else-branch by
    // asserting kioskCustomerAuth.userId resolves email/phone from auth.
    mockResolveTerminalKioskSession.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })

    // customerClerkUserId requires resolveKioskCustomerClerkAuth to be invoked
    // with a truthy userId. Without a real auth session for a customer here,
    // the route relies on falling into the else branch only when email or
    // kioskPhoneRaw are present — both come from kioskUser, so this scenario
    // is exercised via the qr bootstrap's existing find-by-identifiers path.
    // We simulate this by using a kiosk session token with clerkId=null so
    // the `else if` branch is reached (kioskUser is set, clerkId is null).
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "db_user_1",
          clerkId: null,
          email: "student@example.com",
          name: "Jane Student",
          phone: "+1 555 111 2222",
        },
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        kioskSessionToken: "session_1",
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.customer.firstName).toBe("Jane")
    expect(data.customer.hasAvatar).toBe(false)
    // findClerkUserByIdentifiers called once (initial resolution) — not
    // re-invoked as a recovery for the avatar-refresh failure.
    expect(mockFindClerkUserByIdentifiers).toHaveBeenCalledTimes(1)
    expect(mockGetUser).toHaveBeenCalledTimes(1)
  })

  // Scenario: double-miss — kiosk_terminal flowContext, no kioskSessionToken,
  // authResult.userId is set, both the id retry (getCachedClerkUser/getUser)
  // and the identifier fallback (findClerkUserByIdentifiers) fail to resolve
  // anyone. There is no kioskUser and no clerkUser, so email/phone stay
  // empty and upsertUserByIdentifiers would receive no identifiers. The
  // route must degrade to a controlled 500 ("Unable to resolve user")
  // instead of throwing or writing a stale identity.
  it("returns a controlled 500 with 'Unable to resolve user' when both the id retry and the identifier fallback miss", async () => {
    mockAuth.mockResolvedValue({ userId: "clerk_customer_authenticated" })
    mockGetUser.mockRejectedValue(new Error("Clerk 404: not found on this instance"))
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockResolveTerminalKioskSession.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" })
    // No clerkUser was resolved and no kioskUser/email/phone identifiers are
    // available, so the real upsertUserByIdentifiers would reject the
    // empty-identifier upsert and return null — mirror that here.
    mockUpsertUserByIdentifiers.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        flowContext: "kiosk_terminal",
      })
    )

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe("Unable to resolve user")
    expect(mockResolveTerminalKioskSession).not.toHaveBeenCalled()
    // The upsert was attempted with no email/phone identifiers (no clerkUser
    // resolved, no kioskUser) and returned null, matching the real
    // upsertUserByIdentifiers empty-identifier guard — no stale row created.
    expect(mockUpsertUserByIdentifiers).toHaveBeenCalledWith(
      expect.objectContaining({ clerkId: "clerk_customer_authenticated", email: "", phone: "" })
    )
  })
})
