import { beforeEach, describe, expect, it, vi } from "vitest"
import { STAFF_TERMINAL_LATENCY_TARGETS_MS } from "@/lib/checkin/kiosk-qr-payment"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockResolveTerminalKioskSession = vi.fn()
const mockGetCatalogCourseBySlug = vi.fn()
const mockPackageFindMany = vi.fn()
const mockPurchaseFindMany = vi.fn()
const mockPurchaseFindFirst = vi.fn()
const mockUpsertUserByIdentifiers = vi.fn()
const mockConsumeRateLimit = vi.fn()
const mockBuildRateLimitKey = vi.fn()
const mockGetClientIp = vi.fn()
const mockCreatePreparedCheckoutContext = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    packagePurchase: {
      findMany: (...args: unknown[]) => mockPackageFindMany(...args),
    },
    purchase: {
      findMany: (...args: unknown[]) => mockPurchaseFindMany(...args),
      findFirst: (...args: unknown[]) => mockPurchaseFindFirst(...args),
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
    mockUpsertUserByIdentifiers.mockResolvedValue({
      id: "db_user_1",
      name: "Jane Student",
      email: "student@example.com",
      phone: "15551112222",
    })
    mockConsumeRateLimit.mockReturnValue({ ok: true })
    mockBuildRateLimitKey.mockReturnValue("rate-limit-key")
    mockGetClientIp.mockReturnValue("127.0.0.1")
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

  it("refreshes the Clerk user before avatar gating when the first payload is incomplete", async () => {
    const getUser = vi
      .fn()
      .mockResolvedValueOnce({
        id: "clerk_user_1",
        firstName: "Jane",
        lastName: "Student",
        primaryEmailAddress: { emailAddress: "student@example.com" },
        primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
      })
      .mockResolvedValueOnce({
        id: "clerk_user_1",
        firstName: "Jane",
        lastName: "Student",
        hasImage: true,
        primaryEmailAddress: { emailAddress: "student@example.com" },
        primaryPhoneNumber: { phoneNumber: "+1 555 111 2222" },
      })

    mockClerkClient.mockResolvedValue({
      users: {
        getUser,
      },
    })
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
        hasAvatar: true,
      },
    })
    expect(getUser).toHaveBeenCalledTimes(2)
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

  it("creates prepared checkout context and slims terminal-only bootstrap payload", async () => {
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
    expect(data.packages).toBeUndefined()
    expect(data.purchaseHistory).toBeUndefined()
    expect(data.quickCheckout).toBeNull()
    expect(data.context).toMatchObject({ courseSlug: "salsa-femenina-matutina" })
    expect(data.customer).toMatchObject({ userId: "db_user_1" })
  })

  it("logs PIN-ready latency within the terminal target", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {})
    const dateNow = vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(2_800)

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
    expect(1_800).toBeLessThanOrEqual(STAFF_TERMINAL_LATENCY_TARGETS_MS.pinReady)

    consoleInfo.mockRestore()
    dateNow.mockRestore()
  })
})
