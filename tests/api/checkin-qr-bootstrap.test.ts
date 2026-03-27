import { beforeEach, describe, expect, it, vi } from "vitest"

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
})
