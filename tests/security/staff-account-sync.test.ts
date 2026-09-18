import { beforeEach, describe, expect, it, vi } from "vitest"

// In-memory fake standing in for the `staffAccount` Postgres table — same
// convention as tests/security/staff-enrollment-challenge.test.ts.
type FakeRow = Record<string, unknown> & { id: string; clerkUserId: string; email: string }
let rows: FakeRow[] = []

type MigrationRow = { entity: string; oldClerkId: string; newClerkId: string }
let migrationRows: MigrationRow[] = []

type FindUniqueArgs = { where: { clerkUserId: string }; select?: Record<string, boolean> }
const mockFindUnique = vi.fn(async ({ where, select }: FindUniqueArgs) => {
  const row = rows.find((r) => r.clerkUserId === where.clerkUserId)
  if (!row) return null
  const projected = { id: row.id, hourlyRate: null, paydayWeekday: null, paymentModelId: null }
  return select ? projected : { ...row, ...projected }
})

const mockUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
  const row = rows.find((r) => r.id === where.id)
  if (!row) throw new Error("not found")
  Object.assign(row, data)
  return { ...row }
})

const mockUpsert = vi.fn()

const mockMigrationFindFirst = vi.fn(
  async ({ where }: { where: { entity: string; oldClerkId?: string; newClerkId?: string } }) => {
    return (
      migrationRows.find(
        (row) =>
          row.entity === where.entity &&
          (where.oldClerkId === undefined || row.oldClerkId === where.oldClerkId) &&
          (where.newClerkId === undefined || row.newClerkId === where.newClerkId)
      ) || null
    )
  }
)

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffAccount: {
      findUnique: (...args: unknown[]) => (mockFindUnique as (...a: unknown[]) => unknown)(...args),
      update: (...args: unknown[]) => (mockUpdate as (...a: unknown[]) => unknown)(...args),
      upsert: (...args: unknown[]) => (mockUpsert as (...a: unknown[]) => unknown)(...args),
    },
    staffRoleAudit: { create: vi.fn() },
    clerkIdMigration: {
      findFirst: (...args: unknown[]) => (mockMigrationFindFirst as (...a: unknown[]) => unknown)(...args),
    },
  },
}))

describe("lib/security/staff-account-sync: clerk id migration rebind", () => {
  beforeEach(() => {
    vi.resetModules()
    rows = [{ id: "staff_existing", clerkUserId: "clerk_dev_old_id", email: "owner@example.com", role: "owner" }]
    migrationRows = []
    mockFindUnique.mockClear()
    mockUpdate.mockClear()
    mockUpsert.mockClear()
    mockMigrationFindFirst.mockClear()
  })

  it("rejects a stale clerk id superseded by a migration instead of creating or updating any row", async () => {
    migrationRows = [{ entity: "staff", oldClerkId: "clerk_dev_old_id", newClerkId: "clerk_prod_new_id" }]
    rows = [{ id: "staff_existing", clerkUserId: "clerk_prod_new_id", email: "owner@example.com", role: "owner" }]
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    try {
      const { syncStaffAccountFromClerkUser } = await import("@/lib/security/staff-account-sync")
      const result = await syncStaffAccountFromClerkUser({
        id: "clerk_dev_old_id",
        firstName: "Owner",
        lastName: "Person",
        publicMetadata: { role: "owner" },
        primaryEmailAddress: { emailAddress: "owner@example.com" },
      })

      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockUpsert).not.toHaveBeenCalled()
      expect(rows).toHaveLength(1)
      expect(rows[0].clerkUserId).toBe("clerk_prod_new_id")
      expect(result).toMatchObject({ id: "staff_existing", clerkUserId: "clerk_prod_new_id" })
    } finally {
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
    }
  })

  it("rejects a stale clerk id with no successor row without creating or updating any row", async () => {
    migrationRows = [{ entity: "staff", oldClerkId: "clerk_dev_old_id", newClerkId: "clerk_prod_new_id" }]
    rows = []
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    try {
      const { syncStaffAccountFromClerkUser } = await import("@/lib/security/staff-account-sync")
      const result = await syncStaffAccountFromClerkUser({
        id: "clerk_dev_old_id",
        firstName: "Owner",
        lastName: "Person",
        publicMetadata: { role: "owner" },
        primaryEmailAddress: { emailAddress: "owner@example.com" },
      })

      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockUpsert).not.toHaveBeenCalled()
      expect(result).toBeNull()
    } finally {
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
    }
  })

  it("still upserts the mirror when the Prisma client has no ClerkIdMigration model", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    try {
      const prismaModule = (await import("@/lib/prisma")) as unknown as { prisma: Record<string, unknown> }
      const originalMigration = prismaModule.prisma.clerkIdMigration
      delete prismaModule.prisma.clerkIdMigration
      const { syncStaffAccountFromClerkUser } = await import("@/lib/security/staff-account-sync")
      mockUpsert.mockResolvedValueOnce({ id: "staff_new", clerkUserId: "clerk_unseen_id" })

      const result = await syncStaffAccountFromClerkUser({
        id: "clerk_unseen_id",
        firstName: "New",
        lastName: "Hire",
        publicMetadata: { role: "staff" },
        primaryEmailAddress: { emailAddress: "new-hire@example.com" },
      })

      expect(mockMigrationFindFirst).not.toHaveBeenCalled()
      expect(mockUpsert).toHaveBeenCalledTimes(1)
      expect(result).toMatchObject({ id: "staff_new" })
      prismaModule.prisma.clerkIdMigration = originalMigration
    } finally {
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
    }
  })

  it("rebinds the row named by the migration's oldClerkId when the new clerk id has no row yet", async () => {
    migrationRows = [{ entity: "staff", oldClerkId: "clerk_dev_old_id", newClerkId: "clerk_prod_new_id" }]
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    try {
      const { syncStaffAccountFromClerkUser } = await import("@/lib/security/staff-account-sync")
      const result = await syncStaffAccountFromClerkUser({
        id: "clerk_prod_new_id",
        firstName: "Owner",
        lastName: "Person",
        publicMetadata: { role: "owner" },
        primaryEmailAddress: { emailAddress: "owner@example.com" },
      })

      expect(mockUpdate).toHaveBeenCalledTimes(1)
      expect(mockUpsert).not.toHaveBeenCalled()
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe("staff_existing")
      expect(rows[0].clerkUserId).toBe("clerk_prod_new_id")
      expect(result).toMatchObject({ id: "staff_existing", clerkUserId: "clerk_prod_new_id" })
    } finally {
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
    }
  })

  it("upserts as before when there is no clerk id migration evidence", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    try {
      const { syncStaffAccountFromClerkUser } = await import("@/lib/security/staff-account-sync")
      mockUpsert.mockResolvedValueOnce({ id: "staff_new", clerkUserId: "clerk_unseen_id" })

      const result = await syncStaffAccountFromClerkUser({
        id: "clerk_unseen_id",
        firstName: "New",
        lastName: "Hire",
        publicMetadata: { role: "staff" },
        primaryEmailAddress: { emailAddress: "new-hire@example.com" },
      })

      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockUpsert).toHaveBeenCalledTimes(1)
      expect(mockUpsert.mock.calls[0][0]).toMatchObject({ where: { clerkUserId: "clerk_unseen_id" } })
      expect(result).toMatchObject({ id: "staff_new" })
    } finally {
      vi.stubEnv("NODE_ENV", originalNodeEnv ?? "test")
    }
  })
})
