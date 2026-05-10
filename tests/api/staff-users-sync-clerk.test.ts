import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdminRequest = vi.fn()
const mockGetUserList = vi.fn()
const mockSyncDbUserFromClerkUser = vi.fn()
const mockPrismaUserFindMany = vi.fn()

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: () => mockAuthorizeOwnerOrAdminRequest(),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    users: {
      getUserList: (...args: unknown[]) => mockGetUserList(...args),
    },
  }),
}))

vi.mock("@/lib/clerk-user-sync", () => ({
  syncDbUserFromClerkUser: (...args: unknown[]) => mockSyncDbUserFromClerkUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockPrismaUserFindMany(...args),
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
    mockSyncDbUserFromClerkUser.mockReset()
    mockPrismaUserFindMany.mockReset()
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
    mockPrismaUserFindMany.mockResolvedValue([{ clerkId: "clerk_present" }])

    const { GET } = await import("@/app/api/staff/users/sync-clerk/health/route")
    const res = await GET()
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload).toEqual({
      clerkUsers: 2,
      dbUsersWithClerkId: 1,
      missingCount: 1,
      missingUsers: [{ clerkId: "clerk_missing", email: "missing@example.com" }],
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
})
