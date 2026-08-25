import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import {
  runCoverageDiff,
  runRemap,
  runRemapAndGate,
  runRollback,
  type ClerkIdMigrationRow,
  type MigratePrismaClient,
  type MigrateTargetClient,
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
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
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
    // The bulk transaction must carry a generous timeout — the default 5s is too
    // tight for ~100 guarded row updates over a remote proxied connection.
    expect(prismaClient.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: expect.any(Number) })
    )
  })

  it("aborts before opening the transaction when the SAME newClerkId is shared across DIFFERENT oldClerkId values (genuine collision)", async () => {
    const mapRows = [
      makeMapRow({ entity: "user", appId: "user_db_1", oldClerkId: "clerk_dev_1", newClerkId: "clerk_prod_dup" }),
      makeMapRow({ entity: "user", appId: "user_db_2", oldClerkId: "clerk_dev_2", newClerkId: "clerk_prod_dup" }),
    ]

    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
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

  it("succeeds for a merged User+StaffAccount pair sharing the SAME oldClerkId and the SAME newClerkId (legitimate merge from round-1's dedupe fix)", async () => {
    const mapRows = [
      makeMapRow({ entity: "user", appId: "user_db_1", oldClerkId: "clerk_dev_shared", newClerkId: "clerk_prod_shared" }),
      makeMapRow({ entity: "staff", appId: "staff_db_1", oldClerkId: "clerk_dev_shared", newClerkId: "clerk_prod_shared" }),
    ]

    const txClient: MigrateTransactionClient = {
      user: {
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      staffAccount: {
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ id: "staff_db_1" }),
      },
    }

    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(mapRows),
      },
      $transaction: vi.fn(async (fn) => fn(txClient)),
    }

    const result = await runRemap(prismaClient, logger)

    expect(txClient.user.update).toHaveBeenCalledWith({ where: { id: "user_db_1" }, data: { clerkId: "clerk_prod_shared" } })
    expect(txClient.staffAccount.update).toHaveBeenCalledWith({
      where: { id: "staff_db_1" },
      data: { clerkUserId: "clerk_prod_shared" },
    })
    expect(result.remapped).toBe(2)
  })

  it("still aborts when the SAME entity+oldClerkId has a duplicated newClerkId within its own group", async () => {
    const mapRows = [
      makeMapRow({ id: "map_1", entity: "user", appId: "user_db_1", oldClerkId: "clerk_dev_1", newClerkId: "clerk_prod_1" }),
      makeMapRow({ id: "map_2", entity: "user", appId: "user_db_1", oldClerkId: "clerk_dev_1", newClerkId: "clerk_prod_1" }),
    ]

    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
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
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
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
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
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
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
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
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
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

  it("restores BOTH rows of a merged User+StaffAccount pair sharing the SAME newClerkId, with no cross-table interference", async () => {
    // Mirrors runRemap's legitimate-merge fixture (same oldClerkId + newClerkId,
    // distinct entity+appId) — confirms rollback restores each table's row
    // independently via its own WHERE guard, without one table's lookup or
    // update leaking into the other's.
    const mapRows = [
      makeMapRow({ entity: "user", appId: "user_db_1", oldClerkId: "clerk_dev_shared", newClerkId: "clerk_prod_shared" }),
      makeMapRow({ entity: "staff", appId: "staff_db_1", oldClerkId: "clerk_dev_shared", newClerkId: "clerk_prod_shared" }),
    ]

    const txClient: MigrateTransactionClient = {
      user: {
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ id: "user_db_1" }),
      },
      staffAccount: {
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn().mockResolvedValue({ id: "staff_db_1" }),
      },
    }

    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue(mapRows),
      },
      $transaction: vi.fn(async (fn) => fn(txClient)),
    }

    const result = await runRollback(prismaClient, logger)

    expect(txClient.user.findFirst).toHaveBeenCalledWith({ where: { clerkId: "clerk_prod_shared" } })
    expect(txClient.staffAccount.findFirst).toHaveBeenCalledWith({ where: { clerkUserId: "clerk_prod_shared" } })
    expect(txClient.user.update).toHaveBeenCalledTimes(1)
    expect(txClient.user.update).toHaveBeenCalledWith({
      where: { id: "user_db_1" },
      data: { clerkId: "clerk_dev_shared" },
    })
    expect(txClient.staffAccount.update).toHaveBeenCalledTimes(1)
    expect(txClient.staffAccount.update).toHaveBeenCalledWith({
      where: { id: "staff_db_1" },
      data: { clerkUserId: "clerk_dev_shared" },
    })
    expect(result).toMatchObject({ restored: 2, skipped: [] })
  })
})

describe("runCoverageDiff — script-local coverage gate", () => {
  it("reports zero missing when every mapped newClerkId resolves against the target client", async () => {
    const mapRows = [makeMapRow({ entity: "user", appId: "user_db_1", newClerkId: "clerk_prod_1" })]
    const prismaClient: MigratePrismaClient = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: "user_db_1", clerkId: "clerk_prod_1" }),
      },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(async ({ where } = {}) => (where?.phase === "phone_attached" ? mapRows : [])),
      },
      $transaction: vi.fn(),
    }
    const target = { users: { getUser: vi.fn().mockResolvedValue({ id: "clerk_prod_1" }) } } as never

    const report = await runCoverageDiff(prismaClient, target, logger)

    expect(report).toMatchObject({ totalMapped: 1, missingInTarget: 0, mismatched: 0, incomplete: 0, gatePassed: true })
  })

  it("flags a gate failure when a mapped user is missing on the target instance", async () => {
    const mapRows = [makeMapRow({ entity: "user", appId: "user_db_1", newClerkId: "clerk_prod_missing" })]
    const prismaClient: MigratePrismaClient = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: "user_db_1", clerkId: "clerk_prod_missing" }),
      },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(async ({ where } = {}) => (where?.phase === "phone_attached" ? mapRows : [])),
      },
      $transaction: vi.fn(),
    }
    const target = { users: { getUser: vi.fn().mockRejectedValue({ status: 404 }) } } as never

    const report = await runCoverageDiff(prismaClient, target, logger)

    expect(report).toMatchObject({ totalMapped: 1, missingInTarget: 1, mismatched: 0, gatePassed: false })
  })

  it("flags a mismatch (not a miss) when the target user resolves but the DB row's current clerkId diverged from the map's newClerkId", async () => {
    const mapRows = [makeMapRow({ entity: "user", appId: "user_db_1", newClerkId: "clerk_prod_1" })]
    const prismaClient: MigratePrismaClient = {
      user: {
        findMany: vi.fn(),
        // Row was re-synced post-remap (e.g. via webhook) to a different clerkId.
        findUnique: vi.fn().mockResolvedValue({ id: "user_db_1", clerkId: "clerk_prod_DIFFERENT" }),
      },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(async ({ where } = {}) => (where?.phase === "phone_attached" ? mapRows : [])),
      },
      $transaction: vi.fn(),
    }
    const target = { users: { getUser: vi.fn().mockResolvedValue({ id: "clerk_prod_1" }) } } as never

    const report = await runCoverageDiff(prismaClient, target, logger)

    expect(report).toMatchObject({ totalMapped: 1, missingInTarget: 0, mismatched: 1, gatePassed: false })
  })

  it("flags a mismatch for a StaffAccount row whose current clerkUserId diverged from the map's newClerkId", async () => {
    const mapRows = [makeMapRow({ entity: "staff", appId: "staff_db_1", newClerkId: "clerk_prod_staff_1" })]
    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: {
        findMany: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: "staff_db_1", clerkUserId: "clerk_prod_DIFFERENT" }),
      },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(async ({ where } = {}) => (where?.phase === "phone_attached" ? mapRows : [])),
      },
      $transaction: vi.fn(),
    }
    const target = { users: { getUser: vi.fn().mockResolvedValue({ id: "clerk_prod_staff_1" }) } } as never

    const report = await runCoverageDiff(prismaClient, target, logger)

    expect(report).toMatchObject({ totalMapped: 1, missingInTarget: 0, mismatched: 1, gatePassed: false })
  })

  it("fails the gate and reports incomplete when a row is stuck at phase=user_created", async () => {
    const mapRows = [makeMapRow({ entity: "user", appId: "user_db_1", phase: "user_created" })]
    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        // Called twice: once for phone_attached rows (empty), once for
        // non-terminal (user_created) rows.
        findMany: vi.fn(async ({ where } = {}) => (where?.phase === "user_created" ? mapRows : [])),
      },
      $transaction: vi.fn(),
    }
    const target = { users: { getUser: vi.fn() } } as unknown as MigrateTargetClient

    const report = await runCoverageDiff(prismaClient, target, logger)

    expect(report).toMatchObject({ totalMapped: 0, missingInTarget: 0, mismatched: 0, incomplete: 1, gatePassed: false })
    expect(target.users.getUser).not.toHaveBeenCalled()
  })

  it("treats a DB row that no longer exists at all as missing, not mismatched", async () => {
    const mapRows = [makeMapRow({ entity: "user", appId: "user_db_1", newClerkId: "clerk_prod_1" })]
    const prismaClient: MigratePrismaClient = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(async ({ where } = {}) => (where?.phase === "phone_attached" ? mapRows : [])),
      },
      $transaction: vi.fn(),
    }
    const target = { users: { getUser: vi.fn().mockResolvedValue({ id: "clerk_prod_1" }) } } as never

    const report = await runCoverageDiff(prismaClient, target, logger)

    expect(report).toMatchObject({ totalMapped: 1, missingInTarget: 1, mismatched: 0, gatePassed: false })
  })

  it("fails the gate on a vacuous pass — zero phone_attached AND zero user_created rows (e.g. --remap run before any migration)", async () => {
    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn(), findUnique: vi.fn() },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(),
    }
    const target = { users: { getUser: vi.fn() } } as unknown as MigrateTargetClient

    const report = await runCoverageDiff(prismaClient, target, logger)

    expect(report).toMatchObject({ totalMapped: 0, missingInTarget: 0, mismatched: 0, incomplete: 0, gatePassed: false })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("totalMapped=0"))
  })
})

describe("runRemapAndGate — remap + coverage gate, exit code reflects gate result", () => {
  it("does not set process.exitCode when the coverage gate passes", async () => {
    const mapRows = [makeMapRow({ entity: "user", appId: "user_db_1", newClerkId: "clerk_prod_1" })]
    const txClient: MigrateTransactionClient = {
      user: { update: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
      staffAccount: { update: vi.fn(), findFirst: vi.fn() },
    }
    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn(), findUnique: vi.fn().mockResolvedValue({ id: "user_db_1", clerkId: "clerk_prod_1" }) },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(async ({ where } = {}) => (where?.phase === "phone_attached" ? mapRows : [])),
      },
      $transaction: vi.fn(async (fn) => fn(txClient)),
    }
    const target = { users: { getUser: vi.fn().mockResolvedValue({ id: "clerk_prod_1" }) } } as never

    const originalExitCode = process.exitCode
    process.exitCode = undefined
    try {
      const report = await runRemapAndGate(prismaClient, target, logger)
      expect(report.gatePassed).toBe(true)
      expect(process.exitCode).toBeUndefined()
    } finally {
      process.exitCode = originalExitCode
    }
  })

  it("sets process.exitCode = 1 (without throwing) when the coverage gate fails", async () => {
    const mapRows = [makeMapRow({ entity: "user", appId: "user_db_1", newClerkId: "clerk_prod_missing" })]
    const txClient: MigrateTransactionClient = {
      user: { update: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
      staffAccount: { update: vi.fn(), findFirst: vi.fn() },
    }
    const prismaClient: MigratePrismaClient = {
      user: { findMany: vi.fn(), findUnique: vi.fn().mockResolvedValue({ id: "user_db_1", clerkId: "clerk_prod_missing" }) },
      staffAccount: { findMany: vi.fn(), findUnique: vi.fn() },
      clerkIdMigration: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        findMany: vi.fn(async ({ where } = {}) => (where?.phase === "phone_attached" ? mapRows : [])),
      },
      $transaction: vi.fn(async (fn) => fn(txClient)),
    }
    const target = { users: { getUser: vi.fn().mockRejectedValue({ status: 404 }) } } as never

    const originalExitCode = process.exitCode
    process.exitCode = undefined
    try {
      const report = await runRemapAndGate(prismaClient, target, logger)
      expect(report.gatePassed).toBe(false)
      expect(process.exitCode).toBe(1)
    } finally {
      process.exitCode = originalExitCode
    }
  })
})
