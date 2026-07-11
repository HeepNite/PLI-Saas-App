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
const mockPurchaseFindMany2 = vi.fn()
const mockGetCatalogCourseBySlug = vi.fn()
const mockFindClerkUserByIdentifiers = vi.fn()
const mockResolveAvatarState = vi.fn()
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

const DB_USER = {
  id: "db_user_1",
  name: "Jane Student",
  email: "student@example.com",
  phone: "15551112222",
  clerkId: null,
}

const KIOSK_SESSION = {
  id: "kiosk_session_abc",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
}

const ACTIVE_PACKAGE = {
  id: "pkg_purchase_1",
  packageId: "pkg_1",
  packageLabel: "Starter",
  courseSlug: "salsa",
  isUnlimited: false,
  remainingCredits: 4,
  expiresAt: new Date("2099-03-01T00:00:00.000Z"),
  status: "active",
  packagePlan: null,
}

const CLASS_SESSION = { id: "class_session_1" }

const COURSE_DATA = {
  slug: "salsa",
  title: "Salsa",
  enrollment: {
    services: [{ id: "dropin", label: "Drop-in", price: 20 }],
    packages: [],
    addons: [],
  },
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

describe("POST /api/checkin/phone/identify-and-bootstrap", () => {
  beforeEach(() => {
    vi.resetModules()

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
    mockClerkClient.mockReset()

    // Happy defaults
    mockAuthorizeStaffTerminalSession.mockResolvedValue(TERMINAL_AUTH_OK)
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockIsTerminalBlocked.mockResolvedValue({ blocked: false })
    mockCreateKioskIdentificationSession.mockResolvedValue(KIOSK_SESSION)
    mockClearTerminalMisses.mockResolvedValue(undefined)
    mockUserFindFirst.mockResolvedValue(DB_USER)
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
  })

  // Scenario: invalid terminal token → 401
  it("returns 401 when terminal session is invalid", async () => {
    mockAuthorizeStaffTerminalSession.mockResolvedValue({ ok: false, reason: "expired" })

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toMatch(/terminal session/i)
  })

  // Scenario: blocked terminal → 403 / 429
  it("returns 423 when terminal is user-blocked", async () => {
    mockIsTerminalBlocked.mockResolvedValue({
      blocked: true,
      terminalBlocked: false,
      missCount: 5,
      blockedUntil: new Date(Date.now() + 60_000),
      attemptsRemaining: 0,
    })

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(423)
    const data = await res.json()
    expect(data.identified).toBe(false)
  })

  // Scenario: unknown phone → 404
  it("returns 404 when phone number is not found", async () => {
    mockUserFindFirst.mockResolvedValue(null)
    mockRecordTerminalMiss.mockResolvedValue({
      terminalBlocked: false,
      cooldownActive: false,
      missCount: 1,
      blockedUntil: null,
      attemptsRemaining: 4,
    })

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.identified).toBe(false)
  })

  // Scenario: valid phone + active package + class session → fast path
  it("returns fast path when student has active package and class session exists", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
    mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
    mockAttendanceFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("fast")
    expect(data.identified).toBe(true)
    expect(data.sessionToken).toBe("kiosk_session_abc")
    expect(data.consecutiveOffer).toBeNull()
    expect(data.quickCheckout).toBeNull()
    expect(data.hasAnyActivePackage).toBe(true)
    expect(data.package.id).toBe("pkg_purchase_1")
    // On fast path, Clerk should NOT be called
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
  })

  // Scenario: active package for different course → full path
  it("returns full path when active package is for a different course", async () => {
    // packagePurchaseFindFirst returns null (no package for this specific course)
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    // But findMany returns a package for another course
    mockPackagePurchaseFindMany.mockResolvedValue([
      {
        ...ACTIVE_PACKAGE,
        courseSlug: "bachata",
      },
    ])
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("full")
    expect(data.identified).toBe(true)
    expect(data.hasAnyActivePackage).toBe(true)
    expect(data.package).toBeNull() // no package for current course
  })

  // Scenario: no active package at all → full path
  it("returns full path when student has no active package", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([])
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("full")
    expect(data.hasAnyActivePackage).toBe(false)
    expect(data.package).toBeNull()
  })

  // Scenario: active package but no class session → full path
  it("returns full path when there is no class session at current time", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
    // No class session found
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([ACTIVE_PACKAGE])
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("full")
  })

  // Scenario: fast path with already-attended session
  it("sets hasExistingPurchaseForSession=true on fast path when attendance exists", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
    mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
    mockAttendanceFindUnique.mockResolvedValue({ id: "att_1" })
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("fast")
    expect(data.hasExistingPurchaseForSession).toBe(true)
  })

  // Scenario: multiple active packages for same course → uses earliest-expiry
  it("selects the earliest-expiry package on fast path when multiple exist", async () => {
    const earlierPackage = {
      ...ACTIVE_PACKAGE,
      id: "pkg_purchase_early",
      expiresAt: new Date("2026-07-01T00:00:00.000Z"),
    }
    // findFirst returns the earliest by our query ordering
    mockPackagePurchaseFindFirst.mockResolvedValue(earlierPackage)
    mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
    mockAttendanceFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("fast")
    expect(data.package.id).toBe("pkg_purchase_early")
  })

  // Scenario: authorizeStaffTerminalSession called exactly once
  it("calls authorizeStaffTerminalSession exactly once per request", async () => {
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    await POST(makeRequest(BASE_BODY))

    expect(mockAuthorizeStaffTerminalSession).toHaveBeenCalledTimes(1)
  })

  // Scenario: window state — far before startsAt now allowed (pre-window)
  it("reports isWindowOpen=true far before startsAt (pre-window, previously blocked by opensAt)", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    try {
      mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
      mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
      mockAttendanceFindUnique.mockResolvedValue(null)
      mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

      const { POST } = await import(
        "@/app/api/checkin/phone/identify-and-bootstrap/route"
      )
      // Far-future date/time keeps "now" (real Date.now()) well before
      // startsAt, i.e. before the old opensAt lower bound.
      const res = await POST(makeRequest({ ...BASE_BODY, date: "2099-01-01" }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.context.checkInWindow.isOpen).toBe(true)
    } finally {
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
    }
  })

  // Scenario: window state — truly past closesAt is closed
  it("reports isWindowOpen=false once truly past closesAt", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    try {
      mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
      mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
      mockAttendanceFindUnique.mockResolvedValue(null)
      mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

      const { POST } = await import(
        "@/app/api/checkin/phone/identify-and-bootstrap/route"
      )
      // Far-past date/time keeps "now" (real Date.now()) well after closesAt.
      const res = await POST(makeRequest({ ...BASE_BODY, date: "2020-01-01" }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.context.checkInWindow.isOpen).toBe(false)
    } finally {
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
    }
  })

  // Scenario: full path hydrates customer with Clerk data
  it("includes Clerk user data in full path response", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([])
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    mockFindClerkUserByIdentifiers.mockResolvedValue({
      id: "clerk_user_1",
      firstName: "Jane",
      lastName: "Student",
      hasImage: true,
      primaryEmailAddress: { emailAddress: "student@example.com" },
      primaryPhoneNumber: { phoneNumber: "+15551112222" },
    })
    mockResolveAvatarState.mockReturnValue({ hasAvatar: true, needsRefresh: false })

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("full")
    expect(data.customer.firstName).toBe("Jane")
    expect(data.customer.lastName).toBe("Student")
    expect(data.customer.hasAvatar).toBe(true)
    expect(data.customer.clerkUserId).toBe("clerk_user_1")
  })
})
