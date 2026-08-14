import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Mocks — defined before any imports ────────────────────────────────────
const mockAuthorizeStaffTerminalSession = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockIsTerminalBlocked = vi.fn()
const mockClearTerminalMisses = vi.fn()
const mockRecordTerminalMiss = vi.fn()
const mockCreateKioskIdentificationSession = vi.fn()
const mockUserFindFirst = vi.fn()
const mockPackagePurchaseFindFirst = vi.fn()
const mockPackagePurchaseFindMany = vi.fn()
const mockPurchaseFindMany = vi.fn()
const mockClassSessionFindUnique = vi.fn()
const mockAttendanceFindUnique = vi.fn()
const mockCourseLinkFindMany = vi.fn()
const mockCourseCatalogFindMany = vi.fn()
const mockGetCatalogCourseBySlug = vi.fn()
const mockFindClerkUserByIdentifiers = vi.fn()
const mockResolveAvatarState = vi.fn()
const mockGetUser = vi.fn()
const mockClerkClient = vi.fn()

vi.mock("@/lib/security/staff-terminal", () => ({
  authorizeStaffTerminalSession: (...args: unknown[]) =>
    mockAuthorizeStaffTerminalSession(...args),
}))

vi.mock("@/lib/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => mockConsumeRateLimit(...args),
  buildRateLimitKey: (...args: unknown[]) => mockBuildRateLimitKey(...args),
  getClientIp: (...args: unknown[]) => mockGetClientIp(...args),
}))

vi.mock("@/lib/security/student-pin", () => ({
  isTerminalBlocked: (...args: unknown[]) => mockIsTerminalBlocked(...args),
  clearTerminalMisses: (...args: unknown[]) => mockClearTerminalMisses(...args),
  recordTerminalMiss: (...args: unknown[]) => mockRecordTerminalMiss(...args),
}))

vi.mock("@/lib/checkin/kiosk-session", () => ({
  createKioskIdentificationSession: (...args: unknown[]) =>
    mockCreateKioskIdentificationSession(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
    },
    packagePurchase: {
      findFirst: (...args: unknown[]) => mockPackagePurchaseFindFirst(...args),
      findMany: (...args: unknown[]) => mockPackagePurchaseFindMany(...args),
    },
    purchase: {
      findMany: (...args: unknown[]) => mockPurchaseFindMany(...args),
      count: async () => 0,
    },
    classSession: {
      findUnique: (...args: unknown[]) => mockClassSessionFindUnique(...args),
    },
    attendance: {
      findUnique: (...args: unknown[]) => mockAttendanceFindUnique(...args),
    },
    courseLink: {
      findMany: (...args: unknown[]) => mockCourseLinkFindMany(...args),
    },
    courseCatalog: {
      findMany: (...args: unknown[]) => mockCourseCatalogFindMany(...args),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  },
}))

vi.mock("@/lib/catalog-courses", () => ({
  getCatalogCourseBySlug: (...args: unknown[]) => mockGetCatalogCourseBySlug(...args),
}))

vi.mock("@/lib/clerk-users", () => ({
  findClerkUserByIdentifiers: (...args: unknown[]) => mockFindClerkUserByIdentifiers(...args),
  resolveAvatarState: (...args: unknown[]) => mockResolveAvatarState(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/checkin/consecutive-offer", () => ({
  resolveConsecutiveOffer: vi.fn().mockResolvedValue(null),
}))

// ─── Fixtures ───────────────────────────────────────────────────────────────

const TERMINAL_AUTH_OK = {
  ok: true,
  sessionId: "terminal_session_1",
  terminal: {
    id: "terminal_1",
    slug: "terminal-1",
    name: "Terminal 1",
    location: null,
    defaultCourseSlug: "salsa",
    active: true,
  },
}

const DB_USER_WITH_CLERK_ID = {
  id: "db_user_1",
  name: "Jane Student",
  email: "student@example.com",
  phone: "15551112222",
  clerkId: "stale_clerk_id_1",
}

const KIOSK_SESSION = {
  id: "kiosk_session_abc",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
}

const COURSE_DATA = {
  slug: "salsa",
  title: "Salsa",
  enrollment: {
    services: [{ id: "dropin", label: "Drop-in", price: 20 }],
    packages: [],
    addons: [],
  },
}

const FALLBACK_CLERK_USER = {
  id: "clerk_user_fallback",
  firstName: "Jane",
  lastName: "Student",
  hasImage: true,
  primaryEmailAddress: { emailAddress: "student@example.com" },
  primaryPhoneNumber: { phoneNumber: "+15551112222" },
}

const makeRequest = (body: Record<string, unknown>) =>
  new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const BASE_BODY = {
  phone: "5551112222",
  courseSlug: "salsa",
  date: "2026-06-01",
  time: "11:00",
  durationMinutes: 60,
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe("POST /api/checkin/phone/identify-and-bootstrap — Clerk lookup guards", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()

    mockAuthorizeStaffTerminalSession.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()
    mockIsTerminalBlocked.mockReset()
    mockClearTerminalMisses.mockReset()
    mockRecordTerminalMiss.mockReset()
    mockCreateKioskIdentificationSession.mockReset()
    mockUserFindFirst.mockReset()
    mockPackagePurchaseFindFirst.mockReset()
    mockPackagePurchaseFindMany.mockReset()
    mockPurchaseFindMany.mockReset()
    mockClassSessionFindUnique.mockReset()
    mockAttendanceFindUnique.mockReset()
    mockCourseLinkFindMany.mockReset()
    mockCourseCatalogFindMany.mockReset()
    mockGetCatalogCourseBySlug.mockReset()
    mockFindClerkUserByIdentifiers.mockReset()
    mockResolveAvatarState.mockReset()
    mockGetUser.mockReset()
    mockClerkClient.mockReset()

    // Happy defaults — full path (no active package/session)
    mockAuthorizeStaffTerminalSession.mockResolvedValue(TERMINAL_AUTH_OK)
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockIsTerminalBlocked.mockResolvedValue({ blocked: false })
    mockCreateKioskIdentificationSession.mockResolvedValue(KIOSK_SESSION)
    mockClearTerminalMisses.mockResolvedValue(undefined)
    mockUserFindFirst.mockResolvedValue(DB_USER_WITH_CLERK_ID)
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([])
    mockPurchaseFindMany.mockResolvedValue([])
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockAttendanceFindUnique.mockResolvedValue(null)
    mockCourseLinkFindMany.mockResolvedValue([])
    mockCourseCatalogFindMany.mockResolvedValue([])
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockResolveAvatarState.mockReturnValue({ hasAvatar: false, needsRefresh: false })
    mockClerkClient.mockResolvedValue({ users: { getUser: mockGetUser } })
  })

  // Scenario: Stale clerkId falls back cleanly (identify-and-bootstrap) — main lookup
  it("falls back to findClerkUserByIdentifiers when the main getUser(dbUser.clerkId) call throws, and does not 500", async () => {
    mockGetUser.mockRejectedValue(new Error("Clerk 404: not found on this instance"))
    mockFindClerkUserByIdentifiers.mockResolvedValue(FALLBACK_CLERK_USER)
    mockResolveAvatarState.mockReturnValue({ hasAvatar: true, needsRefresh: false })

    const { POST } = await import("@/app/api/checkin/phone/identify-and-bootstrap/route")
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("full")
    expect(data.customer.clerkUserId).toBe("clerk_user_fallback")
    expect(mockFindClerkUserByIdentifiers).toHaveBeenCalledWith({
      email: DB_USER_WITH_CLERK_ID.email,
      phone: DB_USER_WITH_CLERK_ID.phone,
    })
  })

  // Scenario: Fallback also finds nothing — continues with clerkUser = null, no throw
  it("continues with a null clerkUser (no 500) when both the main lookup and the fallback miss", async () => {
    mockGetUser.mockRejectedValue(new Error("Clerk 404: not found on this instance"))
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/phone/identify-and-bootstrap/route")
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("full")
    expect(data.customer.clerkUserId).toBe("")
  })

  // Scenario: Valid clerkId still resolves directly — no fallback triggered
  it("resolves directly via getUser(dbUser.clerkId) when it succeeds, without calling findClerkUserByIdentifiers", async () => {
    mockGetUser.mockResolvedValue(FALLBACK_CLERK_USER)
    mockResolveAvatarState.mockReturnValue({ hasAvatar: true, needsRefresh: false })

    const { POST } = await import("@/app/api/checkin/phone/identify-and-bootstrap/route")
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.customer.clerkUserId).toBe("clerk_user_fallback")
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
  })

  // Scenario: Avatar-refresh failure degrades gracefully — keeps clerkUser, skips refresh, no re-lookup
  it("keeps the resolved clerkUser and falls back to the pre-refresh avatar state when the avatar-refresh getUser call throws", async () => {
    // Main lookup succeeds without an image flag present (triggers avatar refresh attempt).
    mockGetUser.mockResolvedValueOnce({
      ...FALLBACK_CLERK_USER,
      hasImage: undefined,
    })
    // resolveAvatarState is called twice: once for the initial state (needsRefresh: true),
    // and — only if the refresh succeeds — again after refresh. Since the refresh call
    // throws, the second resolveAvatarState call must NOT happen.
    mockResolveAvatarState.mockReturnValueOnce({ hasAvatar: null, needsRefresh: true })
    // The avatar-refresh getUser call throws.
    mockGetUser.mockRejectedValueOnce(new Error("transient Clerk error"))

    const { POST } = await import("@/app/api/checkin/phone/identify-and-bootstrap/route")
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    // clerkUser kept (id still present), avatar refresh skipped, hasAvatar falls back to
    // the pre-refresh (null-ish) state, not re-derived.
    expect(data.customer.clerkUserId).toBe("clerk_user_fallback")
    expect(data.customer.hasAvatar).toBe(false)
    // findClerkUserByIdentifiers must NOT be re-invoked on avatar-refresh failure.
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    // resolveAvatarState should only be called once (no second call after a failed refresh).
    expect(mockResolveAvatarState).toHaveBeenCalledTimes(1)
  })
})
