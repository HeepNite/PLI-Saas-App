import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.fn()
const mockClerkClient = vi.fn()
const mockPrisma = {
  staffAccount: {
    findUnique: vi.fn(),
  },
}

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  clerkClient: (...args: unknown[]) => mockClerkClient(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

describe("staff portal authorization", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuth.mockReset()
    mockClerkClient.mockReset()
    mockPrisma.staffAccount.findUnique.mockReset()

    // Default: authenticated owner user
    mockAuth.mockResolvedValue({ userId: "user_owner_1", sessionClaims: { iat: 1000 } })
    mockClerkClient.mockReturnValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "user_owner_1",
          publicMetadata: { role: "owner" },
          privateMetadata: {},
        }),
      },
    })
    mockPrisma.staffAccount.findUnique.mockResolvedValue(null)
  })

  it("allows owner role", async () => {
    const { authorizeOwnerOrAdminRequest } = await import("@/lib/security/staff-portal-auth")

    const result = await authorizeOwnerOrAdminRequest()

    expect(result).toEqual({
      ok: true,
      userId: "user_owner_1",
      role: "owner",
      category: null,
      subCategory: null,
      staffName: null,
    })
  })

  it("allows admin role", async () => {
    mockClerkClient.mockReturnValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "user_admin_1",
          publicMetadata: { role: "admin" },
          privateMetadata: {},
        }),
      },
    })
    mockAuth.mockResolvedValue({ userId: "user_admin_1", sessionClaims: { iat: 1000 } })

    const { authorizeOwnerOrAdminRequest } = await import("@/lib/security/staff-portal-auth")

    const result = await authorizeOwnerOrAdminRequest()

    expect(result).toEqual({
      ok: true,
      userId: "user_admin_1",
      role: "admin",
      category: null,
      subCategory: null,
      staffName: null,
    })
  })

  it("allows a non-teacher staff member to grant cash packages", async () => {
    mockClerkClient.mockReturnValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "user_front_desk_1",
          publicMetadata: { role: "staff", staffCategory: "front_desk" },
          privateMetadata: {},
        }),
      },
    })
    mockAuth.mockResolvedValue({ userId: "user_front_desk_1", sessionClaims: { iat: 1000 } })

    const { authorizeCashPackageGrantRequest } = await import("@/lib/security/staff-portal-auth")

    await expect(authorizeCashPackageGrantRequest()).resolves.toMatchObject({
      ok: true,
      userId: "user_front_desk_1",
      role: "staff",
      category: "front_desk",
    })
  })

  it("denies both Clerk and mirrored teacher classifications for cash package grants", async () => {
    mockClerkClient.mockReturnValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "user_teacher_1",
          publicMetadata: { role: "staff", staffCategory: "guest", staffSubCategory: "teacher" },
          privateMetadata: {},
        }),
      },
    })
    mockAuth.mockResolvedValue({ userId: "user_teacher_1", sessionClaims: { iat: 1000 } })

    const { authorizeCashPackageGrantRequest } = await import("@/lib/security/staff-portal-auth")

    await expect(authorizeCashPackageGrantRequest()).resolves.toEqual({
      ok: false,
      status: 403,
      error: "Insufficient role",
    })
  })

  it("uses the mirror sub-category fallback and denies a teacher when Clerk metadata is absent", async () => {
    mockClerkClient.mockReturnValue({
      users: {
        getUser: vi.fn().mockResolvedValue({ id: "user_mirror_teacher", publicMetadata: {}, privateMetadata: {} }),
      },
    })
    mockAuth.mockResolvedValue({ userId: "user_mirror_teacher", sessionClaims: { iat: 1000 } })
    mockPrisma.staffAccount.findUnique.mockResolvedValue({ role: "staff", category: "guest", subCategory: "teacher" })

    const { authorizeCashPackageGrantRequest } = await import("@/lib/security/staff-portal-auth")

    await expect(authorizeCashPackageGrantRequest()).resolves.toEqual({
      ok: false,
      status: 403,
      error: "Insufficient role",
    })
  })

  it("denies unauthenticated cash package grant requests", async () => {
    mockAuth.mockResolvedValue({ userId: null })
    const { authorizeCashPackageGrantRequest } = await import("@/lib/security/staff-portal-auth")

    await expect(authorizeCashPackageGrantRequest()).resolves.toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    })
  })

  it("denies staff role with 403", async () => {
    mockClerkClient.mockReturnValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "user_staff_1",
          publicMetadata: { role: "staff" },
          privateMetadata: {},
        }),
      },
    })
    mockAuth.mockResolvedValue({ userId: "user_staff_1", sessionClaims: { iat: 1000 } })

    const { authorizeOwnerOrAdminRequest } = await import("@/lib/security/staff-portal-auth")

    const result = await authorizeOwnerOrAdminRequest()

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: "Owner or Admin role required",
    })
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null })

    const { authorizeOwnerOrAdminRequest } = await import("@/lib/security/staff-portal-auth")

    const result = await authorizeOwnerOrAdminRequest()

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Unauthorized",
    })
  })

  it("falls back to DB mirror when Clerk metadata lacks role", async () => {
    mockClerkClient.mockReturnValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "user_mirror_1",
          publicMetadata: {},
          privateMetadata: {},
        }),
      },
    })
    mockAuth.mockResolvedValue({ userId: "user_mirror_1", sessionClaims: { iat: 1000 } })
    mockPrisma.staffAccount.findUnique.mockResolvedValue({ role: "admin", category: "manager" })

    const { authorizeOwnerOrAdminRequest } = await import("@/lib/security/staff-portal-auth")

    const result = await authorizeOwnerOrAdminRequest()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.role).toBe("admin")
    }
  })

  it("returns 401 when session is expired due to forced logout", async () => {
    mockClerkClient.mockReturnValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "user_expired_1",
          publicMetadata: { role: "owner" },
          privateMetadata: { staffForceLogoutAt: 2000000 },
        }),
      },
    })
    mockAuth.mockResolvedValue({ userId: "user_expired_1", sessionClaims: { iat: 1000 } })

    const { authorizeOwnerOrAdminRequest } = await import("@/lib/security/staff-portal-auth")

    const result = await authorizeOwnerOrAdminRequest()

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Staff session expired",
    })
  })

  it("allows admin with manager category", async () => {
    mockClerkClient.mockReturnValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: "user_admin_mgr",
          publicMetadata: { role: "admin" },
          privateMetadata: {},
        }),
      },
    })
    mockAuth.mockResolvedValue({ userId: "user_admin_mgr", sessionClaims: { iat: 1000 } })

    const { authorizeOwnerOrAdminRequest } = await import("@/lib/security/staff-portal-auth")

    const result = await authorizeOwnerOrAdminRequest()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.role).toBe("admin")
    }
  })

  describe("Clerk error handling", () => {
    it("returns 503 with retryAfterSec when Clerk returns 429", async () => {
      const clerkError = Object.assign(new Error("Too Many Requests"), {
        status: 429,
        headers: { "retry-after": "15" },
      })
      mockClerkClient.mockReturnValue({
        users: {
          getUser: vi.fn().mockRejectedValue(clerkError),
        },
      })
      mockAuth.mockResolvedValue({ userId: "user_ratelimited", sessionClaims: { iat: 1000 } })

      const { authorizeOwnerOrAdminRequest } = await import("@/lib/security/staff-portal-auth")

      const result = await authorizeOwnerOrAdminRequest()

      expect(result).toEqual({
        ok: false,
        status: 503,
        error: expect.stringContaining("temporarily busy"),
        retryAfterSec: 15,
      })
    })

    it("returns 503 with default retryAfterSec when Clerk returns 429 without header", async () => {
      const clerkError = Object.assign(new Error("Too Many Requests"), { status: 429 })
      mockClerkClient.mockReturnValue({
        users: {
          getUser: vi.fn().mockRejectedValue(clerkError),
        },
      })
      mockAuth.mockResolvedValue({ userId: "user_ratelimited2", sessionClaims: { iat: 1000 } })

      const { authorizeOwnerOrAdminRequest } = await import("@/lib/security/staff-portal-auth")

      const result = await authorizeOwnerOrAdminRequest()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(503)
        expect(result.retryAfterSec).toBe(5)
      }
    })

    it("returns 503 when Clerk returns 500", async () => {
      const clerkError = Object.assign(new Error("Internal Server Error"), { status: 500 })
      mockClerkClient.mockReturnValue({
        users: {
          getUser: vi.fn().mockRejectedValue(clerkError),
        },
      })
      mockAuth.mockResolvedValue({ userId: "user_500", sessionClaims: { iat: 1000 } })

      const { authorizeOwnerOrAdminRequest } = await import("@/lib/security/staff-portal-auth")

      const result = await authorizeOwnerOrAdminRequest()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(503)
        expect(result.retryAfterSec).toBe(5)
      }
    })
  })
})
