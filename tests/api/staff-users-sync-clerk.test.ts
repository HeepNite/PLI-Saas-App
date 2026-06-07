import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdminRequest = vi.fn()
const mockGetUserList = vi.fn()
const mockGetUser = vi.fn()
const mockSyncDbUserFromClerkUser = vi.fn()
const mockPrismaUserFindMany = vi.fn()
const mockPrismaUserFindUnique = vi.fn()

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: () => mockAuthorizeOwnerOrAdminRequest(),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUserList: (...args: unknown[]) => mockGetUserList(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  }),
}))

vi.mock("@/lib/clerk-user-sync", () => ({
  syncDbUserFromClerkUser: (...args: unknown[]) => mockSyncDbUserFromClerkUser(...args),
  extractClerkIdentity: (user: { primaryEmailAddress?: { emailAddress?: string | null } | null; emailAddresses?: Array<{ emailAddress?: string | null }> }) => ({
    name: null,
    email:
      user.primaryEmailAddress?.emailAddress || user.emailAddresses?.find((email) => Boolean(email.emailAddress))?.emailAddress || null,
    phone: null,
  }),
  resolveCanonicalClerkName: () => null,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockPrismaUserFindMany(...args),
      findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args),
    },
  },
}))

const clerkUser = (id: string, email: string) => ({
  id,
  primaryEmailAddress: { emailAddress: email },
  emailAddresses: [{ emailAddress: email }],
})

describe("staff Clerk user reconciliation", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeOwnerOrAdminRequest.mockReset()
    mockGetUserList.mockReset()
    mockGetUser.mockReset()
    mockSyncDbUserFromClerkUser.mockReset()
    mockPrismaUserFindMany.mockReset()
    mockPrismaUserFindUnique.mockReset()
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    mockAuthorizeOwnerOrAdminRequest.mockResolvedValue({ ok: true, userId: "owner_1", role: "owner" })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("bulk syncs Clerk users and reports skipped, failed, and missing users", async () => {
    const users = [
      clerkUser("clerk_synced", "synced@example.com"),
      clerkUser("clerk_skipped", "skipped@example.com"),
      clerkUser("clerk_failed", "failed@example.com"),
    ]
    mockGetUserList.mockResolvedValueOnce({ data: users })
    mockSyncDbUserFromClerkUser
      .mockResolvedValueOnce({ id: "db_synced" })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("db down"))
    mockPrismaUserFindMany.mockResolvedValue([{ clerkId: "clerk_synced" }])

    const { POST } = await import("@/app/api/staff/users/sync-clerk/route")
    const res = await POST()
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload).toMatchObject({
      totalClerkUsers: 3,
      synced: 1,
      skipped: 1,
      failed: 1,
      missingAfterSync: 2,
    })
    expect(payload.skippedUsers).toEqual([
      { clerkId: "clerk_skipped", email: "skipped@example.com", reason: "sync returned no db user" },
    ])
    expect(payload.failedUsers).toEqual([
      { clerkId: "clerk_failed", email: "failed@example.com", reason: "sync failed" },
    ])
    expect(payload.missingUsers).toEqual([
      { clerkId: "clerk_skipped", email: "skipped@example.com", reason: "missing after sync" },
      { clerkId: "clerk_failed", email: "failed@example.com", reason: "missing after sync" },
    ])
  })

  it("returns read-only Clerk vs DB health", async () => {
    mockGetUserList.mockResolvedValueOnce({
      data: [clerkUser("clerk_present", "present@example.com"), clerkUser("clerk_missing", "missing@example.com")],
    })
    mockPrismaUserFindMany.mockResolvedValue([{ id: "db_present", clerkId: "clerk_present", email: "present@example.com", name: null, phone: null }])

    const { GET } = await import("@/app/api/staff/users/sync-clerk/health/route")
    const res = await GET()
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload).toEqual({
      clerkUsers: 2,
      dbUsersWithClerkId: 1,
      missingCount: 1,
      missingUsers: [{ clerkId: "clerk_missing", email: "missing@example.com" }],
      mismatchedCount: 0,
      mismatchedUsers: [],
    })
    expect(mockSyncDbUserFromClerkUser).not.toHaveBeenCalled()
  })

  it("requires owner or admin access", async () => {
    mockAuthorizeOwnerOrAdminRequest.mockResolvedValue({ ok: false, status: 403, error: "Owner or Admin role required" })

    const { POST } = await import("@/app/api/staff/users/sync-clerk/route")
    const res = await POST()
    const payload = await res.json()

    expect(res.status).toBe(403)
    expect(payload).toEqual({ error: "Owner or Admin role required" })
    expect(mockGetUserList).not.toHaveBeenCalled()
  })

  it("paginates Clerk users until the first short page", async () => {
    const page1 = Array.from({ length: 100 }, (_, index) => clerkUser(`clerk_${index + 1}`, `user${index + 1}@example.com`))
    const page2 = [clerkUser("clerk_101", "user101@example.com")]
    mockGetUserList.mockResolvedValueOnce({ data: page1 }).mockResolvedValueOnce({ data: page2 })

    const { listAllClerkUsers } = await import("@/app/api/staff/users/sync-clerk/shared")
    const users = await listAllClerkUsers()

    expect(users).toHaveLength(101)
    expect(users[0]?.id).toBe("clerk_1")
    expect(users[100]?.id).toBe("clerk_101")
    expect(mockGetUserList).toHaveBeenNthCalledWith(1, { limit: 100, offset: 0 })
    expect(mockGetUserList).toHaveBeenNthCalledWith(2, { limit: 100, offset: 100 })
    expect(mockGetUserList).toHaveBeenCalledTimes(2)
  })

  it("caps Clerk pagination at 10k users when pages never end", async () => {
    const fullPage = Array.from({ length: 100 }, (_, index) => clerkUser(`clerk_page_${index + 1}`, `page${index + 1}@example.com`))
    mockGetUserList.mockResolvedValue({ data: fullPage })

    const { listAllClerkUsers } = await import("@/app/api/staff/users/sync-clerk/shared")
    const users = await listAllClerkUsers()

    expect(users).toHaveLength(10000)
    expect(mockGetUserList).toHaveBeenCalledTimes(100)
    expect(mockGetUserList).toHaveBeenLastCalledWith({ limit: 100, offset: 9900 })
  })

  it("returns empty coverage without DB reads when Clerk list is empty", async () => {
    const { getClerkCoverage, findMissingClerkUsers } = await import("@/app/api/staff/users/sync-clerk/shared")

    const coverage = await getClerkCoverage([])
    const missing = await findMissingClerkUsers([])

    expect(coverage).toEqual({ dbUsersWithClerkId: 0, missingUsers: [], mismatchedUsers: [] })
    expect(missing).toEqual([])
    expect(mockPrismaUserFindMany).not.toHaveBeenCalled()
  })

  it("prefers primary email and falls back to first non-empty secondary email", async () => {
    const { primaryEmail } = await import("@/app/api/staff/users/sync-clerk/shared")

    const withPrimary = {
      ...clerkUser("clerk_primary", "secondary@example.com"),
      primaryEmailAddress: { emailAddress: "primary@example.com" },
    }
    const withSecondaryOnly = {
      id: "clerk_secondary",
      primaryEmailAddress: null,
      emailAddresses: [{ emailAddress: "" }, { emailAddress: "fallback@example.com" }],
    }
    const withNoEmail = {
      id: "clerk_none",
      primaryEmailAddress: null,
      emailAddresses: [{ emailAddress: "" }],
    }

    expect(primaryEmail(withPrimary as never)).toBe("primary@example.com")
    expect(primaryEmail(withSecondaryOnly as never)).toBe("fallback@example.com")
    expect(primaryEmail(withNoEmail as never)).toBeNull()
  })

  it("returns 400 when userId route param is missing in per-user sync", async () => {
    const { POST } = await import("@/app/api/staff/users/sync-clerk/[userId]/route")
    const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ userId: "" }) })
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload).toEqual({ error: "Missing userId" })
    expect(mockPrismaUserFindUnique).not.toHaveBeenCalled()
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it("returns 404 when per-user sync target is not found", async () => {
    mockPrismaUserFindUnique.mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/staff/users/sync-clerk/[userId]/route")
    const res = await POST(new Request("http://localhost"), { params: Promise.resolve({ userId: "db_missing" }) })
    const payload = await res.json()

    expect(res.status).toBe(404)
    expect(payload).toEqual({ error: "User not found" })
    expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
      where: { id: "db_missing" },
      select: { id: true, clerkId: true, name: true, email: true, phone: true },
    })
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockSyncDbUserFromClerkUser).not.toHaveBeenCalled()
  })
})
