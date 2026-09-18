import { beforeEach, describe, expect, it, vi } from "vitest"

// In-memory fake standing in for the `staffAccount` Postgres table — same
// convention as tests/security/staff-enrollment-challenge.test.ts.
type FakeRow = Record<string, unknown> & { id: string; clerkUserId: string; email: string }
let rows: FakeRow[] = []

const mockFindUnique = vi.fn(async ({ where }: { where: { clerkUserId: string } }) => {
  const row = rows.find((r) => r.clerkUserId === where.clerkUserId)
  return row ? { id: row.id, hourlyRate: null, paydayWeekday: null, paymentModelId: null } : null
})

const mockFindMany = vi.fn(async ({ where }: { where: { email: { equals: string } } }) => {
  const target = where.email.equals.toLowerCase()
  return rows.filter((r) => (r.email as string).toLowerCase() === target).map((r) => ({ id: r.id }))
})

const mockUpdate = vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
  const row = rows.find((r) => r.id === where.id)
  if (!row) throw new Error("not found")
  Object.assign(row, data)
  return { ...row }
})

const mockUpsert = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    staffAccount: {
      findUnique: (...args: unknown[]) => (mockFindUnique as (...a: unknown[]) => unknown)(...args),
      findMany: (...args: unknown[]) => (mockFindMany as (...a: unknown[]) => unknown)(...args),
      update: (...args: unknown[]) => (mockUpdate as (...a: unknown[]) => unknown)(...args),
      upsert: (...args: unknown[]) => (mockUpsert as (...a: unknown[]) => unknown)(...args),
    },
    staffRoleAudit: { create: vi.fn() },
  },
}))

describe("lib/security/staff-account-sync: clerk id rebind by email", () => {
  beforeEach(() => {
    vi.resetModules()
    rows = [{ id: "staff_existing", clerkUserId: "clerk_dev_old_id", email: "owner@example.com", role: "owner" }]
    mockFindUnique.mockClear()
    mockFindMany.mockClear()
    mockUpdate.mockClear()
    mockUpsert.mockClear()
  })

  it("rebinds an existing account with the same email to the new clerkUserId instead of creating a second row", async () => {
    const originalNodeEnv = process.env.NODE_ENV
    vi.stubEnv("NODE_ENV", "production")
    try {
      const { syncStaffAccountFromClerkUser } = await import("@/lib/security/staff-account-sync")
      const result = await syncStaffAccountFromClerkUser({
        id: "clerk_prod_new_id",
        firstName: "Owner",
        lastName: "Person",
        publicMetadata: { role: "owner" },
        // Different casing than the stored row exercises the case-insensitive match.
        primaryEmailAddress: { emailAddress: "Owner@Example.com" },
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
})
