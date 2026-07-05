import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizePortal = vi.fn()
const mockClerkClient = vi.fn()

const usersApi = {
  getUserList: vi.fn(),
  updateUser: vi.fn(),
  updateUserMetadata: vi.fn(),
  getUser: vi.fn(),
  lockUser: vi.fn(),
  unlockUser: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
}

const invitationsApi = {
  createInvitation: vi.fn(),
}

const sessionsApi = {
  getSessionList: vi.fn(),
}

const mockPrisma = {
  staffAccount: {
    findMany: vi.fn(),
  },
}

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeStaffPortalRequest: (...args: unknown[]) => mockAuthorizePortal(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff users routes", () => {
  beforeEach(() => {
    mockAuthorizePortal.mockReset()
    mockClerkClient.mockReset()
    usersApi.getUserList.mockReset()
    usersApi.updateUser.mockReset()
    usersApi.updateUserMetadata.mockReset()
    usersApi.getUser.mockReset()
    usersApi.lockUser.mockReset()
    usersApi.unlockUser.mockReset()
    usersApi.banUser.mockReset()
    usersApi.unbanUser.mockReset()
    invitationsApi.createInvitation.mockReset()
    sessionsApi.getSessionList.mockReset()
    mockPrisma.staffAccount.findMany.mockReset()

    mockClerkClient.mockResolvedValue({ users: usersApi, invitations: invitationsApi, sessions: sessionsApi })
    mockAuthorizePortal.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockPrisma.staffAccount.findMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("GET returns 401 when portal auth fails", async () => {
    mockAuthorizePortal.mockResolvedValue({ ok: false, status: 401, error: "Invalid key" })
    const { GET } = await import("@/app/api/staff/users/route")
    const res = await GET(new Request("http://localhost/api/staff/users"))
    expect(res.status).toBe(401)
  })

  it("GET returns staff users only", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [
        {
          id: "u_staff",
          firstName: "Ana",
          lastName: "Staff",
          emailAddresses: [{ emailAddress: "ana@example.com" }],
          publicMetadata: { role: "staff" },
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
        {
          id: "u_member",
          firstName: "Pepe",
          lastName: "Member",
          emailAddresses: [{ emailAddress: "pepe@example.com" }],
          publicMetadata: { role: "member" },
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
      ],
    })

    const { GET } = await import("@/app/api/staff/users/route")
    const res = await GET(new Request("http://localhost/api/staff/users"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toHaveLength(1)
    expect(data.items[0].id).toBe("u_staff")
    expect(data.items[0].category).toBe("guest")
  })

  it("GET can filter by category", async () => {
    usersApi.getUserList.mockResolvedValue({
      data: [
        {
          id: "u_front",
          firstName: "Ana",
          lastName: "Desk",
          emailAddresses: [{ emailAddress: "ana@example.com" }],
          publicMetadata: { role: "staff", staffCategory: "front_desk" },
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
        {
          id: "u_teacher",
          firstName: "Profe",
          lastName: "One",
          emailAddresses: [{ emailAddress: "profe@example.com" }],
          publicMetadata: { role: "staff", staffCategory: "teacher" },
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
      ],
    })

    const { GET } = await import("@/app/api/staff/users/route")
    const res = await GET(new Request("http://localhost/api/staff/users?category=teacher"))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toHaveLength(1)
    expect(data.items[0].id).toBe("u_teacher")
  })

  it("GET trims q before forwarding query to Clerk", async () => {
    usersApi.getUserList.mockResolvedValue({ data: [] })

    const { GET } = await import("@/app/api/staff/users/route")
    const res = await GET(new Request("http://localhost/api/staff/users?q=%20%20ana%20%20"))

    expect(res.status).toBe(200)
    expect(usersApi.getUserList).toHaveBeenCalledWith(
      expect.objectContaining({ query: "ana" })
    )
  })

  it("GET requires auth before returning a cached staff users response", async () => {
    vi.stubEnv("STAFF_USERS_CACHE_TEST_ENABLED", "true")
    usersApi.getUserList.mockResolvedValue({
      data: [
        {
          id: "u_cached_staff",
          firstName: "Cached",
          lastName: "Staff",
          emailAddresses: [{ emailAddress: "cached@example.com" }],
          publicMetadata: { role: "staff" },
          banned: false,
          locked: false,
          createdAt: Date.now(),
          lastSignInAt: Date.now(),
        },
      ],
    })

    const { GET } = await import("@/app/api/staff/users/route")

    const first = await GET(new Request("http://localhost/api/staff/users?q=cached"))
    expect(first.status).toBe(200)
    expect((await first.json()).items[0].id).toBe("u_cached_staff")

    const second = await GET(new Request("http://localhost/api/staff/users?q=cached"))
    expect(second.status).toBe(200)
    expect((await second.json()).items[0].id).toBe("u_cached_staff")
    expect(usersApi.getUserList).toHaveBeenCalledTimes(1)

    mockAuthorizePortal.mockResolvedValueOnce({ ok: false, status: 401, error: "Invalid key" })
    const unauthorized = await GET(new Request("http://localhost/api/staff/users?q=cached"))
    expect(unauthorized.status).toBe(401)
    expect(await unauthorized.json()).toEqual({ error: "Invalid key" })
    expect(mockAuthorizePortal).toHaveBeenCalledTimes(3)
    expect(usersApi.getUserList).toHaveBeenCalledTimes(1)
  })

  it("normalizes q before building cache key", async () => {
    const { buildStaffUsersCacheKeyFromRequestUrl } = await import("@/app/api/staff/users/get-filters")

    const withSpaces = buildStaffUsersCacheKeyFromRequestUrl(
      new URL("http://localhost/api/staff/users?q=%20John%20")
    )
    const normalized = buildStaffUsersCacheKeyFromRequestUrl(
      new URL("http://localhost/api/staff/users?q=John")
    )

    expect(withSpaces).toBe(normalized)
  })

  it("POST promotes existing user", async () => {
    usersApi.getUserList.mockResolvedValueOnce({
      data: [
        {
          id: "u_existing",
          firstName: "Ana",
          lastName: "Old",
          publicMetadata: {},
        },
      ],
    })
    usersApi.updateUser.mockResolvedValue({
      id: "u_existing",
      firstName: "Ana",
      lastName: "New",
      emailAddresses: [{ emailAddress: "ana@example.com" }],
      publicMetadata: { role: "staff" },
      banned: false,
      locked: false,
      createdAt: Date.now(),
      lastSignInAt: null,
    })

    const { POST } = await import("@/app/api/staff/users/route")
    const req = new Request("http://localhost/api/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ana@example.com", role: "staff", lastName: "New" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.mode).toBe("promoted_existing")
    expect(usersApi.updateUser).toHaveBeenCalled()
  })

  it("POST creates invitation when user does not exist", async () => {
    usersApi.getUserList.mockResolvedValueOnce({ data: [] })
    invitationsApi.createInvitation.mockResolvedValue({
      id: "inv_1",
      emailAddress: "newstaff@example.com",
      status: "pending",
      createdAt: Date.now(),
    })

    const { POST } = await import("@/app/api/staff/users/route")
    const req = new Request("http://localhost/api/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "newstaff@example.com", role: "staff" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.mode).toBe("invited")
    expect(invitationsApi.createInvitation).toHaveBeenCalled()
  })

  it("POST stores teacher guest sub-category metadata on invitations", async () => {
    usersApi.getUserList.mockResolvedValueOnce({ data: [] })
    invitationsApi.createInvitation.mockResolvedValue({
      id: "inv_teacher",
      emailAddress: "teacher@example.com",
      status: "pending",
      createdAt: Date.now(),
    })

    const { POST } = await import("@/app/api/staff/users/route")
    const req = new Request("http://localhost/api/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "teacher@example.com", role: "staff", category: "guest", subCategory: "teacher" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(invitationsApi.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        publicMetadata: expect.objectContaining({
          role: "staff",
          staffCategory: "guest",
          staffSubCategory: "teacher",
        }),
      })
    )
  })

  it("POST stores front-desk guest sub-category metadata and uses the log-in redirect", async () => {
    usersApi.getUserList.mockResolvedValueOnce({ data: [] })
    invitationsApi.createInvitation.mockResolvedValue({
      id: "inv_front_desk",
      emailAddress: "frontdesk@example.com",
      status: "pending",
      createdAt: Date.now(),
    })

    const { POST } = await import("@/app/api/staff/users/route")
    const req = new Request("http://localhost/api/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "frontdesk@example.com", role: "staff", category: "guest", subCategory: "front_desk" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(invitationsApi.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        publicMetadata: expect.objectContaining({
          role: "staff",
          staffCategory: "guest",
          staffSubCategory: "front_desk",
        }),
        redirectUrl: "http://localhost/staff/log-in",
      })
    )
  })

  it("POST invitations always redirect to /staff/log-in", async () => {
    usersApi.getUserList.mockResolvedValueOnce({ data: [] })
    invitationsApi.createInvitation.mockResolvedValue({
      id: "inv_redirect",
      emailAddress: "redirect@example.com",
      status: "pending",
      createdAt: Date.now(),
    })

    const { POST } = await import("@/app/api/staff/users/route")
    const req = new Request("http://localhost/api/staff/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "redirect@example.com", role: "staff" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(invitationsApi.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ redirectUrl: "http://localhost/staff/log-in" })
    )
  })

  it("PATCH set_role updates metadata", async () => {
    usersApi.getUser.mockResolvedValue({ id: "u_1", publicMetadata: {} })
    usersApi.updateUserMetadata.mockResolvedValue({
      id: "u_1",
      publicMetadata: { role: "admin" },
      banned: false,
      locked: false,
    })

    const { PATCH } = await import("@/app/api/staff/users/[userId]/route")
    const req = new Request("http://localhost/api/staff/users/u_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_role", role: "admin" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ userId: "u_1" }) })
    expect(res.status).toBe(200)
    expect(usersApi.updateUserMetadata).toHaveBeenCalled()
  })

  it("PATCH set_category updates metadata", async () => {
    usersApi.getUser.mockResolvedValue({ id: "u_1", publicMetadata: { role: "staff" } })
    usersApi.updateUserMetadata.mockResolvedValue({
      id: "u_1",
      publicMetadata: { role: "staff", staffCategory: "manager" },
      banned: false,
      locked: false,
    })

    const { PATCH } = await import("@/app/api/staff/users/[userId]/route")
    const req = new Request("http://localhost/api/staff/users/u_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_category", category: "manager" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ userId: "u_1" }) })
    expect(res.status).toBe(200)
    expect(usersApi.updateUserMetadata).toHaveBeenCalled()
  })

  it("DELETE blocks self staff removal", async () => {
    const { DELETE } = await import("@/app/api/staff/users/[userId]/route")
    const req = new Request("http://localhost/api/staff/users/staff_1", { method: "DELETE" })
    const res = await DELETE(req, { params: Promise.resolve({ userId: "staff_1" }) })
    expect(res.status).toBe(400)
  })

  describe("online vs authOnline semantics", () => {
    it("active session without check-in returns online=false authOnline=true", async () => {
      const now = Date.now()
      usersApi.getUserList.mockResolvedValue({
        data: [
          {
            id: "u_login_only",
            firstName: "Login",
            lastName: "Only",
            emailAddresses: [{ emailAddress: "login@example.com" }],
            publicMetadata: { role: "staff" },
            privateMetadata: { lastActiveAt: new Date(now).toISOString() },
            banned: false,
            locked: false,
            createdAt: now,
            lastSignInAt: now,
            lastActiveAt: now,
          },
        ],
      })
      sessionsApi.getSessionList
        .mockRejectedValueOnce(new Error("global sessions unavailable"))
        .mockResolvedValueOnce({ data: [{ id: "sess_1" }] })

      const { GET } = await import("@/app/api/staff/users/route")
      const res = await GET(new Request("http://localhost/api/staff/users"))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.items).toHaveLength(1)
      expect(data.items[0].online).toBe(false)
      expect(data.items[0].authOnline).toBe(true)
    })

    it("active session with recent check-in returns online=true authOnline=true", async () => {
      const now = Date.now()
      usersApi.getUserList.mockResolvedValue({
        data: [
          {
            id: "u_checked_in",
            firstName: "Checked",
            lastName: "In",
            emailAddresses: [{ emailAddress: "checkin@example.com" }],
            publicMetadata: { role: "staff" },
            privateMetadata: {
              staffLastCheckInAt: new Date(now - 5 * 60 * 1000).toISOString(),
            },
            banned: false,
            locked: false,
            createdAt: now,
            lastSignInAt: now,
            lastActiveAt: now,
          },
        ],
      })
      sessionsApi.getSessionList
        .mockRejectedValueOnce(new Error("global sessions unavailable"))
        .mockResolvedValueOnce({ data: [{ id: "sess_2" }] })

      const { GET } = await import("@/app/api/staff/users/route")
      const res = await GET(new Request("http://localhost/api/staff/users"))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.items).toHaveLength(1)
      expect(data.items[0].online).toBe(true)
      expect(data.items[0].authOnline).toBe(true)
    })

    it("no active session without check-in returns online=false authOnline=false", async () => {
      const now = Date.now()
      usersApi.getUserList.mockResolvedValue({
        data: [
          {
            id: "u_offline",
            firstName: "Offline",
            lastName: "User",
            emailAddresses: [{ emailAddress: "offline@example.com" }],
            publicMetadata: { role: "staff" },
            privateMetadata: {},
            banned: false,
            locked: false,
            createdAt: now,
            lastSignInAt: now - 7 * 24 * 60 * 60 * 1000,
            lastActiveAt: now - 7 * 24 * 60 * 60 * 1000,
          },
        ],
      })
      sessionsApi.getSessionList.mockRejectedValueOnce(new Error("global sessions unavailable"))

      const { GET } = await import("@/app/api/staff/users/route")
      const res = await GET(new Request("http://localhost/api/staff/users"))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.items).toHaveLength(1)
      expect(data.items[0].online).toBe(false)
      expect(data.items[0].authOnline).toBe(false)
    })

    it("presence metadata online with active session returns online=true authOnline=true", async () => {
      const now = Date.now()
      usersApi.getUserList.mockResolvedValue({
        data: [
          {
            id: "u_presence",
            firstName: "Presence",
            lastName: "User",
            emailAddresses: [{ emailAddress: "presence@example.com" }],
            publicMetadata: { role: "staff" },
            privateMetadata: {
              staffPresenceStatus: "online",
              staffPresenceUpdatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
            },
            banned: false,
            locked: false,
            createdAt: now,
            lastSignInAt: now,
            lastActiveAt: now,
          },
        ],
      })
      sessionsApi.getSessionList
        .mockRejectedValueOnce(new Error("global sessions unavailable"))
        .mockResolvedValueOnce({ data: [{ id: "sess_3" }] })

      const { GET } = await import("@/app/api/staff/users/route")
      const res = await GET(new Request("http://localhost/api/staff/users"))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.items).toHaveLength(1)
      expect(data.items[0].online).toBe(true)
      expect(data.items[0].authOnline).toBe(true)
    })

    it("presence metadata offline with active session returns online=false authOnline=true", async () => {
      const now = Date.now()
      usersApi.getUserList.mockResolvedValue({
        data: [
          {
            id: "u_forced_offline",
            firstName: "Forced",
            lastName: "Offline",
            emailAddresses: [{ emailAddress: "forced@example.com" }],
            publicMetadata: { role: "staff" },
            privateMetadata: {
              staffPresenceStatus: "offline",
              staffPresenceUpdatedAt: new Date(now - 5 * 60 * 1000).toISOString(),
            },
            banned: false,
            locked: false,
            createdAt: now,
            lastSignInAt: now,
            lastActiveAt: now,
          },
        ],
      })
      sessionsApi.getSessionList
        .mockRejectedValueOnce(new Error("global sessions unavailable"))
        .mockResolvedValueOnce({ data: [{ id: "sess_4" }] })

      const { GET } = await import("@/app/api/staff/users/route")
      const res = await GET(new Request("http://localhost/api/staff/users"))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.items).toHaveLength(1)
      // forcedOffline is only true when hasActiveSession=false, so with active session
      // the offline presence is ignored and online falls back to check-in/presence check
      expect(data.items[0].authOnline).toBe(true)
    })
  })

  describe("Clerk error handling", () => {
    it("GET returns saved staff rows as degraded 200 when optional Clerk list is rate limited", async () => {
      const clerkError = Object.assign(new Error("Too Many Requests"), { status: 429, headers: { "retry-after": "10" } })
      usersApi.getUserList.mockRejectedValue(clerkError)
      sessionsApi.getSessionList.mockResolvedValue({ data: [] })
      mockPrisma.staffAccount.findMany.mockResolvedValueOnce([
        {
          clerkUserId: "u_saved",
          email: "saved@example.com",
          firstName: "Saved",
          lastName: "Staff",
          role: "staff",
          category: "teacher",
          banned: false,
          locked: false,
          hasPin: true,
          paymentModelId: "model_1",
          createdAt: new Date("2026-07-01T00:00:00.000Z"),
        },
      ])

      const { GET } = await import("@/app/api/staff/users/route")
      const res = await GET(new Request("http://localhost/api/staff/users"))
      expect(res.status).toBe(200)
      expect(res.headers.get("Retry-After")).toBe("10")
      expect(res.headers.get("X-Staff-Service-Status")).toBe("degraded")
      const data = await res.json()
      expect(data).toMatchObject({ status: "degraded", presenceUnavailable: true })
      expect(data.items).toHaveLength(1)
      expect(data.items[0]).toMatchObject({ id: "u_saved", email: "saved@example.com", paymentModelId: "model_1" })
    })

    it("GET returns degraded 200 with Retry-After when optional Clerk list returns 500", async () => {
      const clerkError = Object.assign(new Error("Internal Server Error"), { status: 500 })
      usersApi.getUserList.mockRejectedValue(clerkError)
      sessionsApi.getSessionList.mockResolvedValue({ data: [] })

      const { GET } = await import("@/app/api/staff/users/route")
      const res = await GET(new Request("http://localhost/api/staff/users"))
      expect(res.status).toBe(200)
      expect(res.headers.get("Retry-After")).toBe("5")
      expect(res.headers.get("X-Staff-Service-Status")).toBe("degraded")
      const data = await res.json()
      expect(data).toMatchObject({ status: "degraded", items: [] })
    })

    it("GET returns degraded 200 with default Retry-After when Clerk 429 has no retry-after header", async () => {
      const clerkError = Object.assign(new Error("Too Many Requests"), { status: 429 })
      usersApi.getUserList.mockRejectedValue(clerkError)
      sessionsApi.getSessionList.mockResolvedValue({ data: [] })

      const { GET } = await import("@/app/api/staff/users/route")
      const res = await GET(new Request("http://localhost/api/staff/users"))
      expect(res.status).toBe(200)
      expect(res.headers.get("Retry-After")).toBe("5")
    })

    it("GET returns degraded 200 with Retry-After when per-user Clerk session lookup is rate limited", async () => {
      const now = Date.now()
      const clerkError = Object.assign(new Error("Too Many Requests"), { status: 429, headers: { "retry-after": "12" } })
      usersApi.getUserList.mockResolvedValue({
        data: [
          {
            id: "u_presence_rate_limited",
            firstName: "Presence",
            lastName: "Limited",
            emailAddresses: [{ emailAddress: "presence-limited@example.com" }],
            publicMetadata: { role: "staff" },
            privateMetadata: { staffPresenceStatus: "online", staffPresenceUpdatedAt: new Date(now).toISOString() },
            banned: false,
            locked: false,
            createdAt: now,
            lastSignInAt: now,
            lastActiveAt: now,
          },
        ],
      })
      sessionsApi.getSessionList.mockResolvedValueOnce({ data: [] }).mockRejectedValueOnce(clerkError)
      mockPrisma.staffAccount.findMany.mockResolvedValueOnce([
        {
          clerkUserId: "u_presence_rate_limited",
          email: "presence-limited@example.com",
          role: "staff",
          category: "teacher",
          paymentModelId: "model_presence",
        },
      ])

      const { GET } = await import("@/app/api/staff/users/route")
      const res = await GET(new Request("http://localhost/api/staff/users"))
      expect(res.status).toBe(200)
      expect(res.headers.get("Retry-After")).toBe("12")
      expect(res.headers.get("X-Staff-Service-Status")).toBe("degraded")
      const data = await res.json()
      expect(data).toMatchObject({ status: "degraded", presenceUnavailable: true, retryAfterSec: 12 })
      expect(data.items).toHaveLength(1)
      expect(data.items[0]).toMatchObject({
        id: "u_presence_rate_limited",
        email: "presence-limited@example.com",
        authOnline: false,
        paymentModelId: "model_presence",
      })
    })

    it("GET caps per-user session lookups and returns a degraded presence flag", async () => {
      const now = Date.now()
      usersApi.getUserList.mockResolvedValue({
        data: Array.from({ length: 12 }, (_, index) => ({
          id: `u_presence_${index}`,
          firstName: "Presence",
          lastName: String(index),
          emailAddresses: [{ emailAddress: `presence-${index}@example.com` }],
          publicMetadata: { role: "staff" },
          privateMetadata: { staffPresenceStatus: "online", staffPresenceUpdatedAt: new Date(now).toISOString() },
          banned: false,
          locked: false,
          createdAt: now - index,
          lastSignInAt: now,
          lastActiveAt: now,
        })),
      })
      sessionsApi.getSessionList.mockResolvedValue({ data: [] })

      const { GET } = await import("@/app/api/staff/users/route")
      const res = await GET(new Request("http://localhost/api/staff/users"))
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(res.headers.get("X-Staff-Service-Status")).toBe("degraded")
      expect(data).toMatchObject({ status: "degraded", presenceUnavailable: true })
      expect(data.items).toHaveLength(12)
      expect(sessionsApi.getSessionList).toHaveBeenCalledTimes(11)
    })
  })
})
