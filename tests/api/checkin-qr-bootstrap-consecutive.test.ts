import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockResolveTerminalKioskSession = vi.fn()
const mockGetCatalogCourseBySlug = vi.fn()
const mockPackageFindMany = vi.fn()
const mockPurchaseFindMany = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockCreatePreparedCheckoutContext = vi.fn()
const mockCourseLinkFindMany = vi.fn()
const mockAttendanceFindFirst = vi.fn()
const mockPurchaseFindFirstConsecutive = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    packagePurchase: {
      findMany: (...args: unknown[]) => mockPackageFindMany(...args),
    },
    purchase: {
      findMany: (...args: unknown[]) => mockPurchaseFindMany(...args),
      findFirst: (...args: unknown[]) => mockPurchaseFindFirstConsecutive(...args),
    },
    courseLink: {
      findMany: (...args: unknown[]) => mockCourseLinkFindMany(...args),
    },
    attendance: {
      findFirst: (...args: unknown[]) => mockAttendanceFindFirst(...args),
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

describe("bootstrap consecutive offer", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-24T16:00:00.000Z"))

    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockResolveTerminalKioskSession.mockReset()
    mockGetCatalogCourseBySlug.mockReset()
    mockPackageFindMany.mockReset()
    mockPurchaseFindMany.mockReset()
    mockPurchaseFindFirstConsecutive.mockReset()
    mockUpsertUserByIdentifiers.mockReset()
    mockConsumeRateLimit.mockReset()
    mockBuildRateLimitKey.mockReset()
    mockGetClientIp.mockReset()
    mockCreatePreparedCheckoutContext.mockReset()
    mockCourseLinkFindMany.mockReset()
    mockAttendanceFindFirst.mockReset()
    mockPurchaseFindFirstConsecutive.mockReset()

    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "clerk_user_1",
          firstName: "Jane",
          lastName: "Student",
          hasImage: true,
          primaryEmailAddress: { emailAddress: "student@example.com" },
          primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
        }),
        getUserList: vi.fn().mockResolvedValue({ data: [] }),
      },
    })
    mockUpsertUserByIdentifiers.mockResolvedValue({
      id: "db_user_1",
      name: "Jane Student",
      email: "student@example.com",
      phone: "15551112222",
    })
    mockPackageFindMany.mockResolvedValue([])
    mockPurchaseFindMany.mockResolvedValue([])
    mockPurchaseFindFirstConsecutive.mockResolvedValue(null)
  })

  const setupKioskSession = () => {
    mockAuth.mockResolvedValue({ userId: null })
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: true,
      terminalAuth: {
        ok: true,
        sessionId: "terminal_session_1",
        terminal: {
          id: "terminal_1",
          slug: "terminal-1",
          name: "Terminal 1",
          location: null,
          defaultCourseSlug: null,
          active: true,
        },
      },
      session: {
        id: "kiosk_session_1",
        user: {
          id: "db_user_1",
          clerkId: "clerk_user_1",
          email: "student@example.com",
          name: "Jane Student",
          phone: "15551112222",
        },
      },
    })
  }

  it("returns consecutiveOffer when link exists and student attended Class A", async () => {
    setupKioskSession()
    mockGetCatalogCourseBySlug.mockImplementation(async (slug: string) => {
      if (slug === "salsa") {
        return {
          slug: "salsa",
          title: "Salsa Basics",
          enrollment: {
            services: [{ id: "dropin", label: "Drop-in", price: 20 }],
            packages: [],
            addons: [],
          },
        }
      }
      if (slug === "bachata") {
        return {
          slug: "bachata",
          title: "Bachata Basics",
          enrollment: {
            services: [{ id: "dropin", label: "Drop-in", price: 15 }],
            packages: [],
            addons: [],
          },
        }
      }
      return null
    })
    mockCourseLinkFindMany.mockResolvedValue([
      {
        id: "link_1",
        courseSlugA: "salsa",
        courseSlugB: "bachata",
        dropInConsecutiveCents: 900,
        packageHolderConsecutiveCents: 500,
        active: true,
      },
    ])
    mockAttendanceFindFirst.mockResolvedValue({ id: "att_1", status: "checked_in" })
    mockPurchaseFindFirstConsecutive.mockResolvedValue(null) // no purchase for Class B

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-24",
          time: "20:00",
          durationMinutes: 60,
          flowContext: "kiosk_terminal",
          kioskSessionToken: "kiosk_session_1",
          linkedFromCourseSlug: "salsa",
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.consecutiveOffer).not.toBeNull()
    expect(data.consecutiveOffer.linkedCourseSlug).toBe("bachata")
    expect(data.consecutiveOffer.linkedCourseTitle).toBe("Bachata Basics")
    expect(data.consecutiveOffer.dropInConsecutiveCents).toBe(900)
    expect(data.consecutiveOffer.regularDropInCents).toBe(1500)
    expect(data.consecutiveOffer.discountPercent).toBe(40) // (1 - 900/1500) * 100
    expect(data.consecutiveOffer.hasAttendedFirstClass).toBe(true)
  })

  it("returns no offer when no link exists", async () => {
    setupKioskSession()
    mockGetCatalogCourseBySlug.mockResolvedValue({
      slug: "salsa",
      title: "Salsa Basics",
      enrollment: {
        services: [{ id: "dropin", label: "Drop-in", price: 20 }],
        packages: [],
        addons: [],
      },
    })
    mockCourseLinkFindMany.mockResolvedValue([]) // no links

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "salsa",
          date: "2026-03-24",
          time: "10:00",
          durationMinutes: 60,
          flowContext: "kiosk_terminal",
          kioskSessionToken: "kiosk_session_1",
          linkedFromCourseSlug: "salsa",
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.consecutiveOffer).toBeNull()
  })

  it("returns no offer when student hasn't attended Class A today", async () => {
    setupKioskSession()
    mockGetCatalogCourseBySlug.mockImplementation(async (slug: string) => {
      if (slug === "salsa") {
        return {
          slug: "salsa",
          title: "Salsa Basics",
          enrollment: {
            services: [{ id: "dropin", label: "Drop-in", price: 20 }],
            packages: [],
            addons: [],
          },
        }
      }
      if (slug === "bachata") {
        return {
          slug: "bachata",
          title: "Bachata Basics",
          enrollment: {
            services: [{ id: "dropin", label: "Drop-in", price: 15 }],
            packages: [],
            addons: [],
          },
        }
      }
      return null
    })
    mockCourseLinkFindMany.mockResolvedValue([
      {
        id: "link_1",
        courseSlugA: "salsa",
        courseSlugB: "bachata",
        dropInConsecutiveCents: 900,
        packageHolderConsecutiveCents: 500,
        active: true,
      },
    ])
    mockAttendanceFindFirst.mockResolvedValue(null) // no attendance for Class A
    mockPurchaseFindFirstConsecutive.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-24",
          time: "20:00",
          durationMinutes: 60,
          flowContext: "kiosk_terminal",
          kioskSessionToken: "kiosk_session_1",
          linkedFromCourseSlug: "salsa",
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.consecutiveOffer).toBeNull()
  })

  it("returns no offer when student already purchased Class B today", async () => {
    setupKioskSession()
    mockGetCatalogCourseBySlug.mockImplementation(async (slug: string) => {
      if (slug === "salsa") {
        return {
          slug: "salsa",
          title: "Salsa Basics",
          enrollment: {
            services: [{ id: "dropin", label: "Drop-in", price: 20 }],
            packages: [],
            addons: [],
          },
        }
      }
      if (slug === "bachata") {
        return {
          slug: "bachata",
          title: "Bachata Basics",
          enrollment: {
            services: [{ id: "dropin", label: "Drop-in", price: 15 }],
            packages: [],
            addons: [],
          },
        }
      }
      return null
    })
    mockCourseLinkFindMany.mockResolvedValue([
      {
        id: "link_1",
        courseSlugA: "salsa",
        courseSlugB: "bachata",
        dropInConsecutiveCents: 900,
        packageHolderConsecutiveCents: 500,
        active: true,
      },
    ])
    mockAttendanceFindFirst.mockResolvedValue({ id: "att_1", status: "checked_in" })
    mockPurchaseFindFirstConsecutive.mockResolvedValue({ id: "purchase_1" }) // already purchased Class B

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "bachata",
          date: "2026-03-24",
          time: "20:00",
          durationMinutes: 60,
          flowContext: "kiosk_terminal",
          kioskSessionToken: "kiosk_session_1",
          linkedFromCourseSlug: "salsa",
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.consecutiveOffer).toBeNull()
  })

  it("returns no offer when linkedFromCourseSlug is not provided", async () => {
    setupKioskSession()
    mockGetCatalogCourseBySlug.mockResolvedValue({
      slug: "salsa",
      title: "Salsa Basics",
      enrollment: {
        services: [{ id: "dropin", label: "Drop-in", price: 20 }],
        packages: [],
        addons: [],
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "salsa",
          date: "2026-03-24",
          time: "10:00",
          durationMinutes: 60,
          flowContext: "kiosk_terminal",
          kioskSessionToken: "kiosk_session_1",
          // no linkedFromCourseSlug
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.consecutiveOffer).toBeNull()
    // Should not query courseLink at all
    expect(mockCourseLinkFindMany).not.toHaveBeenCalled()
  })

  it("returns no offer when course B has day-specific rules and is NOT scheduled today (Mon Beginner → Fri-only Rueda)", async () => {
    // Force Monday 2026-05-18 NY (weekday 1)
    vi.setSystemTime(new Date("2026-05-18T22:00:00.000Z"))
    setupKioskSession()
    mockGetCatalogCourseBySlug.mockImplementation(async (slug: string) => {
      if (slug === "salsa-night-beginner") {
        return {
          slug: "salsa-night-beginner",
          title: "Salsa Beginner / Open Level",
          enrollment: { services: [{ id: "dropin", label: "Drop-in", price: 20 }], packages: [], addons: [] },
          scheduleRules: {
            mode: "regular",
            rules: [
              { weekday: 1, times: ["21:10"] },
              { weekday: 5, times: ["20:10"] },
            ],
          },
        }
      }
      if (slug === "salsa-night-advance-beginner-rueda") {
        return {
          slug: "salsa-night-advance-beginner-rueda",
          title: "Advance Beginner Rueda",
          enrollment: { services: [{ id: "dropin", label: "Drop-in", price: 20 }], packages: [], addons: [] },
          scheduleRules: { mode: "regular", rules: [{ weekday: 5, times: ["21:10"] }] },
        }
      }
      return null
    })
    mockCourseLinkFindMany.mockResolvedValue([
      {
        id: "link_rueda",
        courseSlugA: "salsa-night-beginner",
        courseSlugB: "salsa-night-advance-beginner-rueda",
        dropInConsecutiveCents: 1000,
        packageHolderConsecutiveCents: 1000,
        active: true,
      },
    ])
    mockAttendanceFindFirst.mockResolvedValue({ id: "att_1", status: "checked_in" })
    mockPurchaseFindFirstConsecutive.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "salsa-night-advance-beginner-rueda",
          date: "2026-05-18",
          time: "21:10",
          durationMinutes: 60,
          flowContext: "kiosk_terminal",
          kioskSessionToken: "kiosk_session_1",
          linkedFromCourseSlug: "salsa-night-beginner",
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.consecutiveOffer).toBeNull()
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})
