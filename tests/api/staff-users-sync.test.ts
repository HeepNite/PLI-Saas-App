import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthorizeOwnerOrAdminRequest = vi.fn()
const mockClerkClient = vi.fn()
const mockSyncDbUserFromClerkUser = vi.fn()
const mockFindUnique = vi.fn()

vi.mock("@/lib/security/staff-portal-auth", () => ({
  authorizeOwnerOrAdminRequest: (...args: unknown[]) => mockAuthorizeOwnerOrAdminRequest(...args),
}))

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/clerk-user-sync", () => ({
  syncDbUserFromClerkUser: (...args: unknown[]) => mockSyncDbUserFromClerkUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}))

describe("staff users sync route", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthorizeOwnerOrAdminRequest.mockReset()
    mockClerkClient.mockReset()
    mockSyncDbUserFromClerkUser.mockReset()
    mockFindUnique.mockReset()

    mockAuthorizeOwnerOrAdminRequest.mockResolvedValue({ ok: true, userId: "staff_1", role: "admin" })
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({ id: "clerk_1", firstName: "Ana", lastName: "Sync" }),
      },
    })
    mockSyncDbUserFromClerkUser.mockResolvedValue({
      id: "db_1",
      clerkId: "clerk_1",
      email: "ana@example.com",
      name: "Ana Sync",
      phone: "541199999999",
    })
  })

  it("returns 403 when authorization fails", async () => {
    mockAuthorizeOwnerOrAdminRequest.mockResolvedValue({ ok: false, status: 403, error: "Owner or Admin role required" })
    const { POST } = await import("@/app/api/staff/users/sync/route")
    const res = await POST(new Request("http://localhost/api/staff/users/sync", { method: "POST", body: "{}" }))
    expect(res.status).toBe(403)
  })

  it("syncs user immediately by clerkId", async () => {
    const { POST } = await import("@/app/api/staff/users/sync/route")
    const res = await POST(
      new Request("http://localhost/api/staff/users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId: "clerk_1" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockSyncDbUserFromClerkUser).toHaveBeenCalledTimes(1)
    const data = await res.json()
    expect(data.user).toMatchObject({ clerkId: "clerk_1", name: "Ana Sync" })
  })

  it("resolves clerkId from DB userId before syncing", async () => {
    mockFindUnique.mockResolvedValue({ clerkId: "clerk_2" })
    mockClerkClient.mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({ id: "clerk_2", firstName: "Pepe", lastName: "Two" }),
      },
    })

    const { POST } = await import("@/app/api/staff/users/sync/route")
    const res = await POST(
      new Request("http://localhost/api/staff/users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "db_2" }),
      })
    )

    expect(res.status).toBe(200)
    expect(mockFindUnique).toHaveBeenCalledTimes(1)
  })
})
