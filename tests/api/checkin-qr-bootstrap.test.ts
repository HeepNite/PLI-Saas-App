import { beforeEach, describe, expect, it, vi } from "vitest"
import { STAFF_TERMINAL_LATENCY_TARGETS_MS } from "@/lib/checkin/kiosk-qr-payment"

const BOOTSTRAP_URL = "http://localhost/api/checkin/qr/bootstrap"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
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

describe("qr check-in bootstrap route", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useRealTimers()
    mockAuth.mockReset()
    mockClerkClient.mockReset()
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
    mockDayOfWeekFindUnique.mockReset()
    mockDayOfWeekFindUnique.mockResolvedValue(null)
    mockClassSessionFindUnique.mockReset()
    mockClassSessionFindUnique.mockResolvedValue(null)
    mockAttendanceFindUnique.mockReset()
    mockAttendanceFindUnique.mockResolvedValue(null)
    resetNestGatewayEnv()

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
    vi.unstubAllGlobals()
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    mockResolveTerminalKioskSession.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    })
    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "salsa-femenina-matutina", date: "2026-02-24", time: "11:00" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid payload", async () => {
    mockAuth.mockResolvedValue({ userId: "user_123" })
    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseSlug: "", date: "2026-02-24", time: "11:00" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("hydrates kiosk identification sessions with Clerk names and avatar state", async () => {
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
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        kioskSessionToken: "session_1",
      }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      customer: {
        firstName: "Jane",
        lastName: "Student",
        email: "student@example.com",
        phone: "15551112222",
        hasAvatar: true,
      },
    })
  })

  it("finds the Clerk profile by session identifiers when the kiosk session has no clerk id", async () => {
    const getUser = vi.fn().mockResolvedValue({
      id: "clerk_user_2",
      firstName: "Jane",
      lastName: "Student",
      hasImage: true,
      primaryEmailAddress: { emailAddress: "student@example.com" },
      primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
    })
    const getUserList = vi.fn().mockResolvedValue({
      data: [
        {
          id: "clerk_user_2",
          firstName: "Jane",
          lastName: "Student",
          hasImage: true,
          primaryEmailAddress: { emailAddress: "student@example.com" },
          primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
          phoneNumbers: [{ phoneNumber: "+1 555 111 2222" }],
        },
      ],
    })

    mockClerkClient.mockResolvedValue({
      users: {
        getUser,
        getUserList,
      },
    })
    mockAuth.mockResolvedValue({ userId: null })
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
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        kioskSessionToken: "session_1",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      customer: {
        firstName: "Jane",
        lastName: "Student",
        email: "student@example.com",
        phone: "15551112222",
        hasAvatar: true,
      },
    })
    expect(getUserList).toHaveBeenCalledWith({
      emailAddress: ["student@example.com"],
      limit: 1,
    })
    expect(getUser).not.toHaveBeenCalled()
  })

  it("ignores owner or staff Clerk auth in kiosk flow and hydrates the kiosk customer instead", async () => {
    const getUser = vi.fn().mockImplementation(async (userId: string) => {
      if (userId === "staff_user_1") {
        return {
          id: "staff_user_1",
          firstName: "Owner",
          lastName: "Account",
          hasImage: true,
          publicMetadata: { role: "owner" },
          privateMetadata: {},
          unsafeMetadata: {},
          primaryEmailAddress: { emailAddress: "owner@example.com" },
          primaryPhoneNumber: { phoneNumber: "+1 555 999 0000" },
        }
      }

      return {
        id: "customer_clerk_1",
        firstName: "Jane",
        lastName: "Student",
        hasImage: true,
        primaryEmailAddress: { emailAddress: "student@example.com" },
        primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
      }
    })

    mockClerkClient.mockResolvedValue({
      users: {
        getUser,
      },
    })
    mockAuth.mockResolvedValue({ userId: "staff_user_1" })
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
        user: {
          id: "db_user_kiosk_1",
          clerkId: "customer_clerk_1",
          email: "student@example.com",
          name: "Jane Student",
          phone: "+1 555 111 2222",
        },
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        flowContext: "kiosk_terminal",
        kioskSessionToken: "session_1",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      customer: {
        userId: "db_user_kiosk_1",
        clerkUserId: "customer_clerk_1",
        firstName: "Jane",
        lastName: "Student",
        email: "student@example.com",
        phone: "15551112222",
      },
    })
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
    expect(getUser).toHaveBeenNthCalledWith(1, "staff_user_1")
    expect(getUser).toHaveBeenNthCalledWith(2, "customer_clerk_1")
  })

  it("prefers kiosk session identity over an active customer Clerk session in terminal flow", async () => {
    const getUser = vi.fn(async (userId: string) => {
      if (userId === "melanie_clerk_1") {
        return {
          id: "melanie_clerk_1",
          firstName: "Melanie",
          lastName: "Padilla",
          hasImage: true,
          primaryEmailAddress: { emailAddress: "melanie@example.com" },
          primaryPhoneNumber: { phoneNumber: "+1 555 000 9999" },
        }
      }

      return {
        id: "jhon_clerk_1",
        firstName: "Jhon",
        lastName: "Doe",
        hasImage: true,
        primaryEmailAddress: { emailAddress: "jhon@doe.com" },
        primaryPhoneNumber: { phoneNumber: "+1 555 666 6666" },
      }
    })
    mockClerkClient.mockResolvedValue({
      users: {
        getUser,
        getUserList: vi.fn().mockResolvedValue({ data: [] }),
      },
    })
    mockAuth.mockResolvedValue({ userId: "melanie_clerk_1" })
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
        id: "jhon_kiosk_session",
        user: {
          id: "jhon_db_1",
          clerkId: "jhon_clerk_1",
          email: "jhon@doe.com",
          name: "Jhon Doe",
          phone: "+1 555 666 6666",
        },
      },
    })

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        flowContext: "kiosk_terminal",
        kioskSessionToken: "jhon_kiosk_session",
      }),
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      customer: {
        userId: "jhon_db_1",
        clerkUserId: "jhon_clerk_1",
        firstName: "Jhon",
        lastName: "Doe",
        email: "jhon@doe.com",
        phone: "15556666666",
      },
    })
    expect(mockResolveTerminalKioskSession).toHaveBeenCalledWith("jhon_kiosk_session")
    expect(mockUpsertUserByIdentifiers).not.toHaveBeenCalled()
    expect(getUser).toHaveBeenNthCalledWith(1, "melanie_clerk_1")
    expect(getUser).toHaveBeenNthCalledWith(2, "jhon_clerk_1")
  })

  it("creates prepared checkout context and slims terminal-only bootstrap payload", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
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
    mockPackageFindMany.mockResolvedValue([
      {
        id: "pkg_purchase_1",
        packageId: "pkg_1",
        packageLabel: "Starter",
        courseSlug: "salsa-femenina-matutina",
        isUnlimited: false,
        remainingCredits: 4,
        expiresAt: new Date("2026-03-01T00:00:00.000Z"),
        status: "active",
      },
    ])
    mockPurchaseFindMany.mockResolvedValue([])
    mockPurchaseFindFirst.mockResolvedValue(null)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const req = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        durationMinutes: 60,
        flowContext: "kiosk_terminal",
        kioskSessionToken: "kiosk_session_1",
      }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(mockCreatePreparedCheckoutContext).toHaveBeenCalledWith(
      expect.objectContaining({
        terminalId: "terminal_1",
        kioskSessionId: "kiosk_session_1",
      })
    )
    // Stripped for privacy: the full packages list, purchase history, and
    // prior-purchase flags.
    expect(data.packages).toBeUndefined()
    expect(data.purchaseHistory).toBeUndefined()
    expect(data.hasPreviousPurchase).toBeUndefined()
    expect(data.hasAnyCompletedPurchase).toBeUndefined()
    expect(data.dayOfWeekPurchaseCount).toBeUndefined()
    // Retained on the terminal (the current customer's operational fields).
    // package + hasAnyActivePackage are needed so the post-check-in consecutive
    // promo lookup fires for package holders; Quick Repeat needs the last two.
    expect("package" in data).toBe(true)
    expect("quickCheckout" in data).toBe(true)
    expect("hasExistingPurchaseForSession" in data).toBe(true)
    expect("hasAnyActivePackage" in data).toBe(true)
    expect("quickRepeatEligible" in data).toBe(true)
    expect("lastPurchasePattern" in data).toBe(true)
    expect(data.context).toMatchObject({ courseSlug: "salsa-femenina-matutina" })
    expect(data.customer).toMatchObject({ userId: "db_user_1" })
    expect(consoleInfo).not.toHaveBeenCalledWith(
      "[QuickRepeat debug]",
      expect.anything()
    )

    consoleInfo.mockRestore()
  })

  it("does not leak prior purchase existence in the terminal-safe Nest bootstrap response", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

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

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          context: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Salsa Femenina Matutina",
            date: "2026-02-24",
            time: "11:00",
            durationMinutes: 60,
            startsAt: "2026-02-24T16:00:00.000Z",
            endsAt: "2026-02-24T17:00:00.000Z",
            checkInWindow: {
              isOpen: true,
              opensAt: "2026-02-24T14:00:00.000Z",
              closesAt: "2026-02-24T17:15:00.000Z",
            },
          },
          customer: {
            userId: "db_user_1",
            clerkUserId: "clerk_user_1",
            firstName: "Jane",
            lastName: "Student",
            name: "Jane Student",
            email: "student@example.com",
            phone: "15551112222",
            hasAvatar: true,
          },
          package: null,
          packages: [],
          quickCheckout: null,
          purchaseHistory: [],
          hasPreviousPurchase: true,
          hasAnyCompletedPurchase: true,
          hasExistingPurchaseForSession: false,
          hasAnyActivePackage: false,
          dayOfWeekPurchaseCount: 3,
          quickRepeatEligible: true,
          lastPurchasePattern: {
            paymentChannel: "cash",
            courseSlug: "salsa-femenina-matutina",
            amount: 2000,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "salsa-femenina-matutina",
          date: "2026-02-24",
          time: "11:00",
          durationMinutes: 60,
          flowContext: "kiosk_terminal",
          kioskSessionToken: "kiosk_session_1",
        }),
      })
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toMatchObject({
      context: {
        courseSlug: "salsa-femenina-matutina",
      },
      customer: {
        userId: "db_user_1",
      },
    })
    // Prior-purchase existence stays stripped (the leak this guards against).
    expect(data.hasPreviousPurchase).toBeUndefined()
    expect(data.hasAnyCompletedPurchase).toBeUndefined()
    expect(data.packages).toBeUndefined()
    expect(data.purchaseHistory).toBeUndefined()
    expect(data.dayOfWeekPurchaseCount).toBeUndefined()
    // Current-session operational fields are retained (needed by the terminal
    // overlays: package-holder consecutive promo + Quick Repeat).
    expect("package" in data).toBe(true)
    expect("quickCheckout" in data).toBe(true)
    expect("hasAnyActivePackage" in data).toBe(true)
    expect("quickRepeatEligible" in data).toBe(true)
    expect("lastPurchasePattern" in data).toBe(true)
    expect(consoleInfo).not.toHaveBeenCalledWith(
      "[QuickRepeat debug]",
      expect.anything()
    )

    consoleInfo.mockRestore()
  })

  it("keeps the legacy 404 course-not-found response when the Nest QR fallback runs", async () => {
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockAuth.mockResolvedValue({ userId: "clerk_user_1" })
    mockGetCatalogCourseBySlug.mockResolvedValue(null)

    const fetchMock = vi.fn().mockRejectedValue(new Error("socket hang up"))
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "unknown-course",
        date: "2026-02-24",
        time: "11:00",
      })
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: "Course not found" })
  })

  it("reports checkInWindow.isOpen=true earlier on the same class day before startsAt", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-24T10:00:00.000Z"))
    try {
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
      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "salsa-femenina-matutina",
          // 2026-02-24T10:00:00Z is 05:00 in New York, so terminal/QR check-in
          // remains open earlier on the class day even before the class starts.
          date: "2026-02-24",
          time: "11:00",
          kioskSessionToken: "session_1",
        }),
      })
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.context.checkInWindow.isOpen).toBe(true)
    } finally {
      vi.useRealTimers()
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
    }
  })

  it("reports checkInWindow.isOpen=false once truly past closesAt", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"))
    try {
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
      const req = new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "salsa-femenina-matutina",
          // Far-past date/time keeps "now" (real Date.now()) well after closesAt.
          date: "2020-01-01",
          time: "11:00",
          kioskSessionToken: "session_1",
        }),
      })
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.context.checkInWindow.isOpen).toBe(false)
    } finally {
      vi.useRealTimers()
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
    }
  })

  it("logs PIN-ready latency within the terminal target", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    // The route calls Date.now() for startedAt and again when it logs latency,
    // with an unspecified number of intermediate calls. Pin the first call
    // (startedAt) to 1000 and every later call to 2800 so the measured
    // durationMs is a deterministic 1800 regardless of intermediate calls.
    let dateNowCall = 0
    const dateNow = vi.spyOn(Date, "now").mockImplementation(() => {
      dateNowCall += 1
      return dateNowCall === 1 ? 1_000 : 2_800
    })

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

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug: "salsa-femenina-matutina",
          date: "2026-02-24",
          time: "11:00",
          durationMinutes: 60,
          flowContext: "kiosk_terminal",
          kioskSessionToken: "kiosk_session_1",
        }),
      })
    )

    expect(res.status).toBe(200)
    expect(consoleInfo).toHaveBeenCalledWith(
      "[staff-terminal-checkout-latency] bootstrap",
      expect.objectContaining({
        flowContext: "kiosk_terminal",
        durationMs: 1_800,
      })
    )
    const [, latencyPayload] = consoleInfo.mock.lastCall ?? []
    ;[
      "hasQuickCheckout",
      "package",
      "packages",
      "quickCheckout",
      "purchaseHistory",
      "hasPreviousPurchase",
      "hasAnyCompletedPurchase",
      "hasExistingPurchaseForSession",
      "hasAnyActivePackage",
      "dayOfWeekPurchaseCount",
      "quickRepeatEligible",
      "lastPurchasePattern",
    ].forEach((field) => {
      expect(latencyPayload).not.toHaveProperty(field)
    })
    expect(1_800).toBeLessThanOrEqual(STAFF_TERMINAL_LATENCY_TARGETS_MS.pinReady)

    consoleInfo.mockRestore()
    dateNow.mockRestore()
  })

  it("delegates authenticated QR decisions to Nest and strips internal fields from the public response", async () => {
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockAuth.mockResolvedValue({ userId: "clerk_user_1" })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          context: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Salsa Femenina Matutina",
            date: "2026-02-24",
            time: "11:00",
            durationMinutes: 60,
            startsAt: "2026-02-24T16:00:00.000Z",
            endsAt: "2026-02-24T17:00:00.000Z",
            checkInWindow: {
              isOpen: true,
              opensAt: "2026-02-24T14:00:00.000Z",
              closesAt: "2026-02-24T17:15:00.000Z",
            },
          },
          customer: {
            userId: "db_user_1",
            clerkUserId: "clerk_user_1",
            firstName: "Jane",
            lastName: "Student",
            name: "Jane Student",
            email: "student@example.com",
            phone: "15551112222",
            hasAvatar: true,
            internalNotes: "do not leak",
          },
          package: {
            id: "pkg_purchase_1",
            packageId: "pkg_1",
            packageLabel: "Starter",
            isUnlimited: false,
            remainingCredits: 4,
            expiresAt: "2026-03-01T00:00:00.000Z",
            status: "active",
          },
          packages: [],
          quickCheckout: null,
          purchaseHistory: [],
          hasPreviousPurchase: false,
          hasAnyCompletedPurchase: false,
          hasExistingPurchaseForSession: false,
          hasAnyActivePackage: true,
          traceId: "nest-trace-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      context: {
        courseSlug: "salsa-femenina-matutina",
        courseTitle: "Salsa Femenina Matutina",
        date: "2026-02-24",
        time: "11:00",
        durationMinutes: 60,
        startsAt: "2026-02-24T16:00:00.000Z",
        endsAt: "2026-02-24T17:00:00.000Z",
        checkInWindow: {
          isOpen: true,
          opensAt: "2026-02-24T14:00:00.000Z",
          closesAt: "2026-02-24T17:15:00.000Z",
        },
      },
      customer: {
        userId: "db_user_1",
        clerkUserId: "clerk_user_1",
        firstName: "Jane",
        lastName: "Student",
        name: "Jane Student",
        email: "student@example.com",
        phone: "15551112222",
        hasAvatar: true,
      },
      package: {
        id: "pkg_purchase_1",
        packageId: "pkg_1",
        packageLabel: "Starter",
        isUnlimited: false,
        remainingCredits: 4,
        expiresAt: "2026-03-01T00:00:00.000Z",
        status: "active",
      },
      packages: [],
      quickCheckout: null,
      purchaseHistory: [],
      hasPreviousPurchase: false,
      hasAnyCompletedPurchase: false,
      hasExistingPurchaseForSession: false,
      hasAnyActivePackage: true,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "http://nest.internal/internal/checkin/qr/decision",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-internal-service-secret": "shared-secret",
        }),
        body: expect.any(String),
      })
    )

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      courseSlug: "salsa-femenina-matutina",
      date: "2026-02-24",
      time: "11:00",
      customer: {
        userId: "db_user_1",
        clerkUserId: "clerk_user_1",
      },
    })
  })

  it("keeps stale QR parity when Nest returns a closed check-in window", async () => {
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockAuth.mockResolvedValue({ userId: "clerk_user_1" })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          context: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Salsa Femenina Matutina",
            date: "2020-01-01",
            time: "11:00",
            durationMinutes: 60,
            startsAt: "2020-01-01T16:00:00.000Z",
            endsAt: "2020-01-01T17:00:00.000Z",
            checkInWindow: {
              isOpen: false,
              opensAt: "2020-01-01T14:00:00.000Z",
              closesAt: "2020-01-01T17:15:00.000Z",
            },
          },
          customer: {
            userId: "db_user_1",
            clerkUserId: "clerk_user_1",
            firstName: "Jane",
            lastName: "Student",
            name: "Jane Student",
            email: "student@example.com",
            phone: "15551112222",
            hasAvatar: true,
          },
          package: null,
          packages: [],
          quickCheckout: null,
          purchaseHistory: [],
          hasPreviousPurchase: false,
          hasAnyCompletedPurchase: false,
          hasExistingPurchaseForSession: false,
          hasAnyActivePackage: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2020-01-01",
        time: "11:00",
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      context: {
        checkInWindow: {
          isOpen: false,
        },
      },
    })
  })

  it("keeps the drop-in decision branch when Nest reports no eligible package credit", async () => {
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockAuth.mockResolvedValue({ userId: "clerk_user_1" })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          context: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Salsa Femenina Matutina",
            date: "2026-02-24",
            time: "11:00",
            durationMinutes: 60,
            startsAt: "2026-02-24T16:00:00.000Z",
            endsAt: "2026-02-24T17:00:00.000Z",
            checkInWindow: {
              isOpen: true,
              opensAt: "2026-02-24T14:00:00.000Z",
              closesAt: "2026-02-24T17:15:00.000Z",
            },
          },
          customer: {
            userId: "db_user_1",
            clerkUserId: "clerk_user_1",
            firstName: "Jane",
            lastName: "Student",
            name: "Jane Student",
            email: "student@example.com",
            phone: "15551112222",
            hasAvatar: true,
          },
          package: null,
          packages: [],
          quickCheckout: {
            serviceId: "dropin",
            packageId: "",
            addons: [],
            participants: 1,
            coupon: "",
            amountCents: 2000,
            currency: "usd",
            sourcePurchaseId: "purchase_1",
            sourcePurchaseAt: "2026-02-10T16:00:00.000Z",
          },
          purchaseHistory: [
            {
              id: "purchase_1",
              createdAt: "2026-02-10T16:00:00.000Z",
              amount: 20,
              currency: "usd",
              status: "completed",
              participants: 1,
              serviceId: "dropin",
              packageId: "",
              addons: [],
              date: "2026-02-10",
              time: "11:00",
            },
          ],
          hasPreviousPurchase: true,
          hasAnyCompletedPurchase: true,
          hasExistingPurchaseForSession: false,
          hasAnyActivePackage: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
      })
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      package: null,
      quickCheckout: expect.objectContaining({
        serviceId: "dropin",
        amountCents: 2000,
      }),
      hasAnyActivePackage: false,
    })
  })

  it("falls back to the legacy QR bootstrap when Nest returns a mismatched success payload", async () => {
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockAuth.mockResolvedValue({ userId: "clerk_user_1" })
    mockPackageFindMany.mockResolvedValue([])
    mockPurchaseFindMany.mockResolvedValue([])
    mockPurchaseFindFirst.mockResolvedValue(null)

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          context: {
            courseSlug: "wrong-course",
            courseTitle: "Wrong Course",
            date: "2026-02-24",
            time: "12:00",
            durationMinutes: 60,
            startsAt: "2026-02-24T17:00:00.000Z",
            endsAt: "2026-02-24T18:00:00.000Z",
            checkInWindow: {
              isOpen: true,
              opensAt: "2026-02-24T15:00:00.000Z",
              closesAt: "2026-02-24T18:15:00.000Z",
            },
          },
          customer: {
            userId: "other-user",
            clerkUserId: "clerk_user_1",
            firstName: "Jane",
            lastName: "Student",
            name: "Jane Student",
            email: "student@example.com",
            phone: "15551112222",
            hasAvatar: true,
          },
          package: null,
          packages: [],
          quickCheckout: null,
          purchaseHistory: [],
          hasPreviousPurchase: false,
          hasAnyCompletedPurchase: false,
          hasExistingPurchaseForSession: false,
          hasAnyActivePackage: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
      })
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      context: {
        courseSlug: "salsa-femenina-matutina",
        time: "11:00",
      },
      customer: {
        userId: "db_user_1",
      },
      hasAnyActivePackage: false,
    })
  })

  it("falls back to the current Next bootstrap implementation when the Nest QR decision request fails", async () => {
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockAuth.mockResolvedValue({ userId: "clerk_user_1" })
    mockPackageFindMany.mockResolvedValue([])
    mockPurchaseFindMany.mockResolvedValue([])
    mockPurchaseFindFirst.mockResolvedValue(null)

    const fetchMock = vi.fn().mockRejectedValue(new Error("socket hang up"))
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
      })
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      context: {
        courseSlug: "salsa-femenina-matutina",
        courseTitle: "Salsa Femenina Matutina",
      },
      customer: {
        userId: "db_user_1",
        clerkUserId: "clerk_user_1",
      },
      package: null,
      hasAnyActivePackage: false,
    })
  })

  it("falls back to the legacy QR bootstrap when Nest returns a mismatched duration in a success payload", async () => {
    process.env.NEST_GATEWAY_ENABLED = "true"
    process.env.NEST_GATEWAY_ROUTE_QR_DECISION_ENABLED = "true"
    process.env.NEST_BACKEND_INTERNAL_URL = "http://nest.internal"
    process.env.NEST_GATEWAY_SHARED_SECRET = "shared-secret"

    mockAuth.mockResolvedValue({ userId: "clerk_user_1" })
    mockPackageFindMany.mockResolvedValue([])
    mockPurchaseFindMany.mockResolvedValue([])
    mockPurchaseFindFirst.mockResolvedValue(null)

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          context: {
            courseSlug: "salsa-femenina-matutina",
            courseTitle: "Salsa Femenina Matutina",
            date: "2026-02-24",
            time: "11:00",
            durationMinutes: 45,
            startsAt: "2026-02-24T16:00:00.000Z",
            endsAt: "2026-02-24T16:45:00.000Z",
            checkInWindow: {
              isOpen: true,
              opensAt: "2026-02-24T14:00:00.000Z",
              closesAt: "2026-02-24T17:15:00.000Z",
            },
          },
          customer: {
            userId: "db_user_1",
            clerkUserId: "clerk_user_1",
            firstName: "Jane",
            lastName: "Student",
            name: "Jane Student",
            email: "student@example.com",
            phone: "15551112222",
            hasAvatar: true,
          },
          package: null,
          packages: [],
          quickCheckout: null,
          purchaseHistory: [],
          hasPreviousPurchase: false,
          hasAnyCompletedPurchase: false,
          hasExistingPurchaseForSession: false,
          hasAnyActivePackage: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const { POST } = await import("@/app/api/checkin/qr/bootstrap/route")
    const res = await POST(
      createRequest({
        courseSlug: "salsa-femenina-matutina",
        date: "2026-02-24",
        time: "11:00",
        durationMinutes: 60,
      })
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      context: {
        courseSlug: "salsa-femenina-matutina",
        time: "11:00",
        durationMinutes: 60,
      },
      customer: {
        userId: "db_user_1",
      },
      hasAnyActivePackage: false,
    })
  })


})
