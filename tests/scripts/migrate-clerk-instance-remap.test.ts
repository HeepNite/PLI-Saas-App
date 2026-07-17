import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import {
  runCoverageDiff,
  runRemap,
  runRollback,
  type ClerkIdMigrationRow,
  type MigratePrismaClient,
  type MigrateTransactionClient,
} from "@/scripts/migrate-clerk-instance"

const logger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  table: vi.fn(),
}

const makeMapRow = (overrides: Partial<ClerkIdMigrationRow> = {}): ClerkIdMigrationRow => ({
  id: "map_1",
  entity: "user",
  appId: "user_db_1",
  oldClerkId: "clerk_dev_1",
  newClerkId: "clerk_prod_1",
  phone: "2125551234",
  email: "ana@example.com",
  phase: "phone_attached",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  appliedAt: new Date("2026-07-01T00:00:00.000Z"),
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("runRemap — single transaction", () => {
  it("updates User.clerkId and StaffAccount.clerkUserId for all mapped rows inside one transaction", async () => {
    const mapRows = [
      makeMapRow({ entity: "user", appId: "user_db_1", newClerkId: "clerk_prod_1" }),
      makeMapRow({ entity: "staff", appId: "staff_db_1", oldClerkId: "clerk_dev_staff_1", newClerkId: "clerk_prod_staff_1" }),
    ]

    const txClient: MigrateTransactionClient = {
      user: {
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      staffAccount: {
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    }

    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn() },
      staffAccount: { findMany: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(mapRows),
      },
      $transaction: vi.fn(async (fn) => fn(txClient)),
    }

    const result = await runRemap(prismaClient, logger)

    expect(txClient.user.update).toHaveBeenCalledWith({ where: { id: "user_db_1" }, data: { clerkId: "clerk_prod_1" } })
    expect(txClient.staffAccount.update).toHaveBeenCalledWith({
      where: { id: "staff_db_1" },
      data: { clerkUserId: "clerk_prod_staff_1" },
    })
    expect(result.remapped).toBe(2)
  })

  it("aborts before opening the transaction when map newClerkId values are not unique", async () => {
    const mapRows = [
      makeMapRow({ entity: "user", appId: "user_db_1", newClerkId: "clerk_prod_dup" }),
      makeMapRow({ entity: "user", appId: "user_db_2", newClerkId: "clerk_prod_dup" }),
    ]

    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn() },
      staffAccount: { findMany: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(mapRows),
      },
      $transaction: vi.fn(),
    }

    await expect(runRemap(prismaClient, logger)).rejects.toThrow("duplicate newClerkId")
    expect(prismaClient.$transaction).not.toHaveBeenCalled()
  })
})

describe("runRemap — pre-remap assertion (design step 9)", () => {
  it("stops and does not commit any updates when a StaffAccount row already holds a map newClerkId", async () => {
    const mapRows = [makeMapRow({ entity: "staff", appId: "staff_db_1", newClerkId: "clerk_prod_staff_1" })]

    const txClient: MigrateTransactionClient = {
      user: { update: vi.fn(), findFirst: vi.fn() },
      staffAccount: {
        update: vi.fn(),
        // A DIFFERENT row already holds this newClerkId — imperfect freeze scenario.
        findFirst: vi.fn().mockResolvedValue({ id: "staff_db_OTHER" }),
      },
    }

    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn() },
      staffAccount: { findMany: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(mapRows),
      },
      $transaction: vi.fn(async (fn) => fn(txClient)),
    }

    await expect(runRemap(prismaClient, logger)).rejects.toThrow(/already holds newClerkId/)
    expect(txClient.staffAccount.update).not.toHaveBeenCalled()
    expect(txClient.user.update).not.toHaveBeenCalled()
  })

  it("proceeds when the colliding row IS the expected target row (not a collision)", async () => {
    const mapRows = [makeMapRow({ entity: "staff", appId: "staff_db_1", newClerkId: "clerk_prod_staff_1" })]

    const txClient: MigrateTransactionClient = {
      user: { update: vi.fn(), findFirst: vi.fn() },
      staffAccount: {
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ id: "staff_db_1" }),
      },
    }

    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn() },
      staffAccount: { findMany: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(mapRows),
      },
      $transaction: vi.fn(async (fn) => fn(txClient)),
    }

    const result = await runRemap(prismaClient, logger)

    expect(txClient.staffAccount.update).toHaveBeenCalledWith({
      where: { id: "staff_db_1" },
      data: { clerkUserId: "clerk_prod_staff_1" },
    })
    expect(result.remapped).toBe(1)
  })
})

describe("runRollback — guarded WHERE current === newClerkId", () => {
  it("restores oldClerkId only for rows whose current clerkUserId still equals the map newClerkId", async () => {
    const mapRows = [
      makeMapRow({ entity: "staff", appId: "staff_db_1", oldClerkId: "clerk_dev_staff_1", newClerkId: "clerk_prod_staff_1" }),
      makeMapRow({ entity: "staff", appId: "staff_db_2", oldClerkId: "clerk_dev_staff_2", newClerkId: "clerk_prod_staff_2" }),
    ]

    const txClient: MigrateTransactionClient = {
      user: { update: vi.fn(), findFirst: vi.fn() },
      staffAccount: {
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn(async ({ where }) => {
          // staff_db_1 still holds its mapped newClerkId — safe to restore.
          if (where.clerkUserId === "clerk_prod_staff_1") return { id: "staff_db_1" }
          // staff_db_2 diverged post-cutover — was re-synced to a different id.
          return null
        }),
      },
    }

    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn() },
      staffAccount: { findMany: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(mapRows),
      },
      $transaction: vi.fn(async (fn) => fn(txClient)),
    }

    const result = await runRollback(prismaClient, logger)

    expect(txClient.staffAccount.update).toHaveBeenCalledTimes(1)
    expect(txClient.staffAccount.update).toHaveBeenCalledWith({
      where: { id: "staff_db_1" },
      data: { clerkUserId: "clerk_dev_staff_1" },
    })
    expect(result).toMatchObject({ restored: 1 })
    expect(result.skipped).toEqual([{ entity: "staff", appId: "staff_db_2", reason: "diverged post-cutover" }])
  })

  it("applies the same WHERE guard to User.clerkId rows, skipping rows that diverged post-cutover", async () => {
    const mapRows = [makeMapRow({ entity: "user", appId: "user_db_1", oldClerkId: "clerk_dev_1", newClerkId: "clerk_prod_1" })]

    const txClient: MigrateTransactionClient = {
      user: {
        update: vi.fn().mockResolvedValue({}),
        // The row's current clerkId no longer equals the map's newClerkId — it
        // was re-synced (e.g. via webhook) to something else post-cutover.
        findFirst: vi.fn().mockResolvedValue(null),
      },
      staffAccount: { update: vi.fn(), findFirst: vi.fn() },
    }

    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn() },
      staffAccount: { findMany: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(mapRows),
      },
      $transaction: vi.fn(async (fn) => fn(txClient)),
    }

    const result = await runRollback(prismaClient, logger)

    expect(txClient.user.update).not.toHaveBeenCalled()
    expect(result).toMatchObject({ restored: 0 })
    expect(result.skipped).toEqual([{ entity: "user", appId: "user_db_1", reason: "diverged post-cutover" }])
  })
})

describe("runCoverageDiff — script-local coverage gate", () => {
  it("reports zero missing when every mapped newClerkId resolves against the target client", async () => {
    const mapRows = [makeMapRow({ newClerkId: "clerk_prod_1" })]
    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn() },
      staffAccount: { findMany: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(mapRows),
      },
      $transaction: vi.fn(),
    }
    const target = { users: { getUser: vi.fn().mockResolvedValue({ id: "clerk_prod_1" }) } } as never

    const report = await runCoverageDiff(prismaClient, target, logger)

    expect(report).toMatchObject({ totalMapped: 1, missingInTarget: 0, gatePassed: true })
  })

  it("flags a gate failure when a mapped user is missing on the target instance", async () => {
    const mapRows = [makeMapRow({ newClerkId: "clerk_prod_missing" })]
    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn() },
      staffAccount: { findMany: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(mapRows),
      },
      $transaction: vi.fn(),
    }
    const target = { users: { getUser: vi.fn().mockRejectedValue({ status: 404 }) } } as never

    const report = await runCoverageDiff(prismaClient, target, logger)

    expect(report).toMatchObject({ totalMapped: 1, missingInTarget: 1, gatePassed: false })
  })
})
