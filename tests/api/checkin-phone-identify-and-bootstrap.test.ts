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
const mockGetCatalogCourseBySlug = vi.fn()
const mockFindClerkUserByIdentifiers = vi.fn()
const mockResolveAvatarState = vi.fn()
const mockClerkClient = vi.fn()
const mockResolveConsecutiveOffer = vi.fn()

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
  resolveConsecutiveOffer: (...args: unknown[]) => mockResolveConsecutiveOffer(...args),
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
    mockGetCatalogCourseBySlug.mockReset()
    mockFindClerkUserByIdentifiers.mockReset()
    mockResolveAvatarState.mockReset()
    mockClerkClient.mockReset()
    mockResolveConsecutiveOffer.mockReset()

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
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    mockFindClerkUserByIdentifiers.mockResolvedValue(null)
    mockResolveAvatarState.mockReturnValue({ hasAvatar: false, needsRefresh: false })
    mockResolveConsecutiveOffer.mockResolvedValue(null)
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

  // Scenario: blocked terminal → 423
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

  // Scenario: unknown phone → 404 (new-user flow, unaffected by the port)
  it("returns 404 when phone number is not found — routes to new-user flow", async () => {
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

  // Scenario: valid phone + active package + class session, no linked class → fast path
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
    // No linkedFromCourseSlug in the request → no consecutive offer resolution.
    expect(data.consecutiveOffer).toBeNull()
    expect(data.quickCheckout).toBeNull()
    expect(data.hasAnyActivePackage).toBe(true)
    expect(data.package.id).toBe("pkg_purchase_1")
    // On fast path, Clerk should NOT be called
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
    // No linkedFromCourseSlug means resolveConsecutiveOffer should not run.
    expect(mockResolveConsecutiveOffer).not.toHaveBeenCalled()
  })

  // Scenario (spec R1): linked consecutive class exists → promo populated in fast path.
  it("R1: populates consecutiveOffer in fast path when a linked consecutive class exists", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
    mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
    mockAttendanceFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    const CONSECUTIVE_OFFER = {
      linkedCourseSlug: "bachata",
      linkedCourseTitle: "Bachata",
      linkedCourseTime: "12:00",
      dropInConsecutiveCents: 1000,
      packageHolderConsecutiveCents: 500,
      regularDropInCents: 2000,
      discountPercent: 50,
      hasAttendedFirstClass: false,
    }
    mockResolveConsecutiveOffer.mockResolvedValue(CONSECUTIVE_OFFER)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(
      makeRequest({ ...BASE_BODY, linkedFromCourseSlug: "salsa" })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("fast")
    expect(data.consecutiveOffer).toEqual(CONSECUTIVE_OFFER)
    expect(mockResolveConsecutiveOffer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: DB_USER.id,
        linkedFromCourseSlug: "salsa",
      })
    )
  })

  // Scenario (spec R1): no linked consecutive class → no promo, package check-in completes normally.
  it("R1: consecutiveOffer stays null in fast path when there is no linked consecutive class", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
    mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
    mockAttendanceFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    mockResolveConsecutiveOffer.mockResolvedValue(null)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(
      makeRequest({ ...BASE_BODY, linkedFromCourseSlug: "salsa" })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("fast")
    expect(data.consecutiveOffer).toBeNull()
    expect(data.hasAnyActivePackage).toBe(true)
    expect(data.package.id).toBe("pkg_purchase_1")
  })

  // Scenario: active package for different course → full path
  it("returns full path when active package is for a different course", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
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
    expect(data.package).toBeNull()
  })

  // Scenario: package holder with no linked class → parity baseline (spec 1.12)
  it("returns full path with consecutiveOffer null when no active package and no linked class", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([])
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    mockResolveConsecutiveOffer.mockResolvedValue(null)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(
      makeRequest({ ...BASE_BODY, linkedFromCourseSlug: "salsa" })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("full")
    expect(data.hasAnyActivePackage).toBe(false)
    expect(data.package).toBeNull()
    expect(data.consecutiveOffer).toBeNull()
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

  // Scenario: window state — terminal check-in stays open for the whole class day (rule #170).
  it("reports isWindowOpen=true earlier on the same class day before startsAt", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-01T10:00:00.000Z"))
    try {
      mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
      mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
      mockAttendanceFindUnique.mockResolvedValue(null)
      mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

      const { POST } = await import(
        "@/app/api/checkin/phone/identify-and-bootstrap/route"
      )
      // 2026-06-01T10:00:00Z is 06:00 in New York, so the class-day gate is open
      // even though the class itself starts later at 11:00.
      const res = await POST(makeRequest(BASE_BODY))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.context.checkInWindow.isOpen).toBe(true)
    } finally {
      vi.useRealTimers()
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
    }
  })

  // Scenario: window state — truly past the class's NY day is closed
  it("reports isWindowOpen=false once the class's NY day has passed", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"))
    try {
      mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
      mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
      mockAttendanceFindUnique.mockResolvedValue(null)
      mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

      const { POST } = await import(
        "@/app/api/checkin/phone/identify-and-bootstrap/route"
      )
      const res = await POST(makeRequest({ ...BASE_BODY, date: "2020-01-01" }))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.context.checkInWindow.isOpen).toBe(false)
    } finally {
      vi.useRealTimers()
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

  // ─── R2: quick-repeat fast path (no active package) ────────────────────

  const SUCCESSFUL_PURCHASE = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: "purchase_1",
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    status: "paid",
    courseSlug: "salsa",
    metadata: { serviceId: "dropin" },
    addonsCsv: null,
    participants: 1,
    coupon: null,
    ...overrides,
  })

  // Scenario (spec): exactly 3 successful purchases, no package → quick-repeat fast path.
  it("R2: offers quick-repeat fast path at exactly 3 successful purchases", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([])
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    mockPurchaseFindMany.mockResolvedValue([
      SUCCESSFUL_PURCHASE({ id: "p3" }),
      SUCCESSFUL_PURCHASE({ id: "p2" }),
      SUCCESSFUL_PURCHASE({ id: "p1" }),
    ])

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("fast")
    expect(data.hasAnyActivePackage).toBe(false)
    expect(data.package).toBeNull()
    expect(data.quickCheckout).not.toBeNull()
    expect(data.quickCheckout.sourcePurchaseId).toBe("p3")
    expect(mockFindClerkUserByIdentifiers).not.toHaveBeenCalled()
  })

  // Scenario (spec): below threshold (2 successful purchases) → full path.
  it("R2: routes to full path with 2 successful purchases (below threshold)", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([])
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    mockPurchaseFindMany.mockResolvedValue([
      SUCCESSFUL_PURCHASE({ id: "p2" }),
      SUCCESSFUL_PURCHASE({ id: "p1" }),
    ])

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("full")
  })

  // Scenario (spec): above threshold (4 successful purchases) → quick-repeat fast path.
  it("R2: offers quick-repeat fast path with 4 successful purchases (above threshold)", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([])
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    mockPurchaseFindMany.mockResolvedValue([
      SUCCESSFUL_PURCHASE({ id: "p4" }),
      SUCCESSFUL_PURCHASE({ id: "p3" }),
      SUCCESSFUL_PURCHASE({ id: "p2" }),
      SUCCESSFUL_PURCHASE({ id: "p1" }),
    ])

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("fast")
    expect(data.quickCheckout).not.toBeNull()
  })

  // Scenario (spec): purchase count excludes non-successful statuses (pending/refunded).
  it("R2: excludes pending/refunded purchases from the quick-repeat threshold", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([])
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    // The route's DB query for R2 filters by status in SUCCESSFUL_PURCHASE_STATUSES,
    // so only the 2 "paid" rows would ever be returned by Prisma in production —
    // simulate that filtering here (pending/refunded rows never reach the app).
    mockPurchaseFindMany.mockImplementation(async () => [
      SUCCESSFUL_PURCHASE({ id: "p2" }),
      SUCCESSFUL_PURCHASE({ id: "p1" }),
    ])

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("full")
    expect(mockPurchaseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["paid", "succeeded", "completed"] },
        }),
      })
    )
  })

  // Scenario (spec): stale-template fallback → routes to full path, no stale quick-repeat.
  it("R2: falls back to full path when the last purchase's service is no longer offered", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([])
    mockClassSessionFindUnique.mockResolvedValue(null)
    // Course catalog no longer has any matching service/package for the stale purchase.
    mockGetCatalogCourseBySlug.mockResolvedValue({
      slug: "salsa",
      title: "Salsa",
      enrollment: { services: [], packages: [], addons: [] },
    })
    mockPurchaseFindMany.mockResolvedValue([
      SUCCESSFUL_PURCHASE({ id: "p3", metadata: { serviceId: "discontinued-service" } }),
      SUCCESSFUL_PURCHASE({ id: "p2" }),
      SUCCESSFUL_PURCHASE({ id: "p1" }),
    ])

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("full")
    expect(data.quickCheckout).toBeNull()
  })

  // Scenario (spec): package-vs-quick-repeat precedence → PACKAGE fast path wins.
  it("Precedence: package fast path wins over quick-repeat when both are eligible", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
    mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
    mockAttendanceFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)
    // Even though this customer also has >= 3 successful purchases, the
    // findMany for R2 purchases must never be reached because the package
    // branch returns first.
    mockPurchaseFindMany.mockResolvedValue([
      SUCCESSFUL_PURCHASE({ id: "p3" }),
      SUCCESSFUL_PURCHASE({ id: "p2" }),
      SUCCESSFUL_PURCHASE({ id: "p1" }),
    ])

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const res = await POST(makeRequest(BASE_BODY))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.path).toBe("fast")
    expect(data.hasAnyActivePackage).toBe(true)
    expect(data.package.id).toBe("pkg_purchase_1")
    expect(data.quickCheckout).toBeNull()
    expect(mockPurchaseFindMany).not.toHaveBeenCalled()
  })

  // Scenario: SMS verification is never bypassed by fast/full path logic (spec 1.11).
  // Neither response envelope (fast, full, or the unknown-phone new-user
  // envelope) carries any field that could let a client skip SMS
  // verification — this endpoint never touches Clerk phone verification at
  // all, it only reads the already-verified DB `user.phone` column.
  it("never exposes an SMS-verification bypass in fast or full path envelopes", async () => {
    mockPackagePurchaseFindFirst.mockResolvedValue(ACTIVE_PACKAGE)
    mockClassSessionFindUnique.mockResolvedValue(CLASS_SESSION)
    mockAttendanceFindUnique.mockResolvedValue(null)
    mockGetCatalogCourseBySlug.mockResolvedValue(COURSE_DATA)

    const { POST } = await import(
      "@/app/api/checkin/phone/identify-and-bootstrap/route"
    )
    const fastRes = await POST(makeRequest(BASE_BODY))
    const fastData = await fastRes.json()
    expect(fastData).not.toHaveProperty("skipSmsVerification")
    expect(fastData).not.toHaveProperty("smsVerified")

    mockPackagePurchaseFindFirst.mockResolvedValue(null)
    mockPackagePurchaseFindMany.mockResolvedValue([])
    mockClassSessionFindUnique.mockResolvedValue(null)
    const fullRes = await POST(makeRequest(BASE_BODY))
    const fullData = await fullRes.json()
    expect(fullData).not.toHaveProperty("skipSmsVerification")
    expect(fullData).not.toHaveProperty("smsVerified")
  })
})
