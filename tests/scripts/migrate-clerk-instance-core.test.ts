import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import {
  logCanaryPhoneVerificationStatus,
  runMigration,
  withRateLimitRetry,
  type ClerkIdMigrationRow,
  type MigrateDeps,
  type MigratePrismaClient,
  type MigratePrismaStaffRow,
  type MigratePrismaUserRow,
  type MigrateTargetClient,
} from "@/scripts/migrate-clerk-instance"

const logger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  table: vi.fn(),
}

const makeUserRow = (overrides: Partial<MigratePrismaUserRow> = {}): MigratePrismaUserRow => ({
  id: "user_db_1",
  clerkId: "clerk_dev_1",
  email: "ana@example.com",
  name: "Ana Perez",
  phone: "2125551234",
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  ...overrides,
})

const makeStaffRow = (overrides: Partial<MigratePrismaStaffRow> = {}): MigratePrismaStaffRow => ({
  id: "staff_db_1",
  clerkUserId: "clerk_dev_staff_1",
  email: "staff@example.com",
  phone: "2125559999",
  firstName: "Beto",
  lastName: "Gomez",
  metadata: {
    publicMetadata: { schoolId: "school_1" },
    privateMetadata: { staffPinHash: "hash-abc" },
    unsafeMetadata: { onboardingComplete: true },
  },
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  ...overrides,
})

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

const emptyUserList = { data: [] as { id: string }[] }

const createPrismaClientFake = (overrides: Partial<MigratePrismaClient> = {}): MigratePrismaClient => {
  const clerkIdMigrationRows = new Map<string, ClerkIdMigrationRow>()

  return {
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    staffAccount: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    clerkIdMigration: {
      findUnique: vi.fn(async ({ where }) => clerkIdMigrationRows.get(`${where.entity_appId.entity}:${where.entity_appId.appId}`) ?? null),
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = `${where.entity_appId.entity}:${where.entity_appId.appId}`
        const existing = clerkIdMigrationRows.get(key)
        const next: ClerkIdMigrationRow = existing
          ? { ...existing, ...update }
          : { id: `map_${key}`, createdAt: new Date(), appliedAt: null, ...create }
        clerkIdMigrationRows.set(key, next)
        return next
      }),
      findMany: vi.fn(async () => Array.from(clerkIdMigrationRows.values())),
    },
    $transaction: vi.fn(async (fn) => fn({} as never)),
    ...overrides,
  }
}

const createDeps = (overrides: Partial<MigrateDeps> = {}): MigrateDeps => ({
  source: {
    users: {
      getUser: vi.fn().mockResolvedValue({ id: "clerk_dev_1" }),
    },
  } as never,
  target: {
    users: {
      getUserList: vi.fn().mockResolvedValue(emptyUserList),
      createUser: vi.fn().mockResolvedValue({ id: "clerk_prod_1" }),
      getUser: vi.fn().mockResolvedValue({ id: "clerk_prod_1", phoneNumbers: [], primaryPhoneNumberId: null }),
    },
    phoneNumbers: {
      createPhoneNumber: vi.fn().mockResolvedValue({ id: "phone_1" }),
    },
  } as never,
  prismaClient: createPrismaClientFake(),
  logger,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("runMigration — dry-run makes zero writes", () => {
  it("does not call createUser, createPhoneNumber, or persist a map row", async () => {
    const prismaClient = createPrismaClientFake({
      user: { findMany: vi.fn().mockResolvedValue([makeUserRow()]), findUnique: vi.fn() },
    })
    const deps = createDeps({ prismaClient })

    const result = await runMigration({ mode: "dry-run" }, deps)

    expect(deps.target.users.createUser).not.toHaveBeenCalled()
    expect(deps.target.phoneNumbers.createPhoneNumber).not.toHaveBeenCalled()
    expect(prismaClient.clerkIdMigration.upsert).not.toHaveBeenCalled()
    expect(result).toMatchObject({ mode: "dry-run", processed: 1, created: 1 })
  })
})

describe("runMigration — canary via --userId", () => {
  it("processes only the specified user, bypassing enumeration order/--limit", async () => {
    const prismaClient = createPrismaClientFake({
      user: {
        findMany: vi.fn().mockResolvedValue([
          makeUserRow({ id: "user_db_1", clerkId: "clerk_dev_1" }),
          makeUserRow({ id: "user_db_2", clerkId: "clerk_dev_2", email: "beto@example.com", phone: "2125550001" }),
        ]),
        findUnique: vi.fn(),
      },
    })
    const deps = createDeps({ prismaClient })

    const result = await runMigration({ mode: "write", userId: "clerk_dev_2" }, deps)

    expect(result.processed).toBe(1)
    expect(result.results[0]).toMatchObject({ appId: "user_db_2", oldClerkId: "clerk_dev_2" })
  })

  it("logs the observed phone verification.status as a recorded finding", async () => {
    const target = {
      users: {
        getUserList: vi.fn().mockResolvedValue(emptyUserList),
        createUser: vi.fn().mockResolvedValue({ id: "clerk_prod_1" }),
        getUser: vi.fn().mockResolvedValue({
          id: "clerk_prod_1",
          primaryPhoneNumberId: "phone_1",
          phoneNumbers: [{ id: "phone_1", verification: { status: "unverified" } }],
        }),
      },
      phoneNumbers: { createPhoneNumber: vi.fn().mockResolvedValue({ id: "phone_1" }) },
    } as never

    const status = await logCanaryPhoneVerificationStatus(target, "clerk_prod_1", logger)

    expect(status).toBe("unverified")
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("canary observed phone verification.status=unverified for userId=clerk_prod_1")
    )
  })

  it("calls logCanaryPhoneVerificationStatus after attachPhone in write mode when --userId is set (canary run)", async () => {
    const prismaClient = createPrismaClientFake({
      user: { findMany: vi.fn().mockResolvedValue([makeUserRow({ clerkId: "clerk_dev_1" })]), findUnique: vi.fn() },
    })
    const target = {
      users: {
        getUserList: vi.fn().mockResolvedValue(emptyUserList),
        createUser: vi.fn().mockResolvedValue({ id: "clerk_prod_1" }),
        getUser: vi.fn().mockResolvedValue({
          id: "clerk_prod_1",
          primaryPhoneNumberId: "phone_1",
          phoneNumbers: [{ id: "phone_1", verification: { status: "verified" } }],
        }),
      },
      phoneNumbers: { createPhoneNumber: vi.fn().mockResolvedValue({ id: "phone_1" }) },
    } as unknown as MigrateTargetClient
    const deps = createDeps({ prismaClient, target })

    await runMigration({ mode: "write", userId: "clerk_dev_1" }, deps)

    expect(target.users.getUser).toHaveBeenCalledWith("clerk_prod_1")
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining("canary observed phone verification.status=verified for userId=clerk_prod_1")
    )
  })

  it("does not call logCanaryPhoneVerificationStatus in a bulk run (no --userId)", async () => {
    const prismaClient = createPrismaClientFake({
      user: { findMany: vi.fn().mockResolvedValue([makeUserRow({ clerkId: "clerk_dev_1" })]), findUnique: vi.fn() },
    })
    const deps = createDeps({ prismaClient })

    await runMigration({ mode: "write" }, deps)

    // getUser is now called for every user (to verify the created phone), so the
    // bulk-vs-canary distinction is that the canary verification.status line is
    // only logged when --userId is set.
    expect(logger.log).not.toHaveBeenCalledWith(
      expect.stringContaining("canary observed phone verification.status")
    )
  })

  it("still processes the target user when --userId is combined with --delta, even if the row's updatedAt predates the delta watermark", async () => {
    const prismaClient = createPrismaClientFake({
      user: { findMany: vi.fn().mockResolvedValue([makeUserRow()]), findUnique: vi.fn() },
    })
    const deps = createDeps({ prismaClient })

    // First run: bulk write, populates the map with an appliedAt timestamp
    // that becomes the --delta watermark for the next run.
    await runMigration({ mode: "write" }, deps)
    vi.clearAllMocks()

    // Second run: the canary target row's updatedAt PREDATES the watermark
    // (it was not touched since the first run). A real Prisma `findMany`
    // applies the `updatedAt: { gt: watermark }` filter server-side, so the
    // stale row would never even be returned by the query — the fake below
    // mirrors that by honoring the where clause, unlike the default fake.
    const staleUserRow = makeUserRow({
      id: "user_db_2",
      clerkId: "clerk_dev_2",
      email: "beto@example.com",
      phone: "2125550001",
      updatedAt: new Date("2020-01-01T00:00:00.000Z"),
    })
    prismaClient.user.findMany = vi.fn(async ({ where }: { where?: { updatedAt?: { gt: Date } } } = {}) => {
      if (where?.updatedAt && staleUserRow.updatedAt <= where.updatedAt.gt) return []
      return [staleUserRow]
    })

    const result = await runMigration({ mode: "write", userId: "clerk_dev_2", delta: true }, deps)

    expect(result.processed).toBe(1)
    expect(result.results[0]).toMatchObject({ appId: "user_db_2", oldClerkId: "clerk_dev_2" })
  })
})

describe("runMigration — idempotent re-run", () => {
  it("does not create a duplicate prod user when a map row already has phase phone_attached", async () => {
    const prismaClient = createPrismaClientFake({
      user: { findMany: vi.fn().mockResolvedValue([makeUserRow()]), findUnique: vi.fn() },
    })
    // Pre-seed the map row via a first run.
    const deps = createDeps({ prismaClient })
    await runMigration({ mode: "write" }, deps)
    vi.clearAllMocks()

    const result = await runMigration({ mode: "write" }, deps)

    expect(deps.target.users.createUser).not.toHaveBeenCalled()
    expect(deps.target.phoneNumbers.createPhoneNumber).not.toHaveBeenCalled()
    expect(result.results[0].phase).toBe("reused")
  })
})

describe("runMigration — delta pass phone-changed reconcile", () => {
  it("reconciles against the existing prod user instead of creating a duplicate", async () => {
    const prismaClient = createPrismaClientFake({
      user: {
        findMany: vi.fn().mockResolvedValue([makeUserRow({ phone: "2125559000" })]),
        findUnique: vi.fn(),
      },
    })
    // Seed an existing map row referencing a DIFFERENT (old) phone.
    prismaClient.clerkIdMigration.upsert = vi.fn()
    const seeded: ClerkIdMigrationRow = makeMapRow({ phase: "phone_attached", newClerkId: "clerk_prod_existing" })
    prismaClient.clerkIdMigration.findUnique = vi.fn().mockResolvedValue(seeded)

    const deps = createDeps({ prismaClient })

    const result = await runMigration({ mode: "write", delta: true }, deps)

    expect(deps.target.users.createUser).not.toHaveBeenCalled()
    expect(result.results[0]).toMatchObject({ newClerkId: "clerk_prod_existing", phase: "reused" })
  })
})

describe("runMigration — delta pass sinceUpdatedAt derived from appliedAt", () => {
  it("passes updatedAt: { gt: <appliedAt of the last phone_attached row> } into user.findMany/staffAccount.findMany on the second --delta run", async () => {
    const prismaClient = createPrismaClientFake({
      user: { findMany: vi.fn().mockResolvedValue([makeUserRow()]), findUnique: vi.fn() },
    })
    const deps = createDeps({ prismaClient })

    // First run: bulk write, populates the map with an appliedAt timestamp.
    await runMigration({ mode: "write" }, deps)
    vi.clearAllMocks()

    // Second run: --delta must derive sinceUpdatedAt from the persisted
    // appliedAt and pass it through to both enumeration queries.
    await runMigration({ mode: "write", delta: true }, deps)

    const userFindManyCalls = (prismaClient.user.findMany as ReturnType<typeof vi.fn>).mock.calls
    const staffFindManyCalls = (prismaClient.staffAccount.findMany as ReturnType<typeof vi.fn>).mock.calls
    expect(userFindManyCalls[0][0].where.updatedAt).toEqual({ gt: expect.any(Date) })
    expect(staffFindManyCalls[0][0].where.updatedAt).toEqual({ gt: expect.any(Date) })
  })
})

describe("runMigration — User+StaffAccount same-person dedupe", () => {
  it("merges a User and a StaffAccount row sharing the same oldClerkId into exactly one createUser call, with two map rows pointing at the same newClerkId", async () => {
    const prismaClient = createPrismaClientFake({
      user: {
        findMany: vi
          .fn()
          .mockResolvedValue([makeUserRow({ id: "user_db_1", clerkId: "clerk_dev_shared" })]),
        findUnique: vi.fn(),
      },
      staffAccount: {
        findMany: vi
          .fn()
          .mockResolvedValue([makeStaffRow({ id: "staff_db_1", clerkUserId: "clerk_dev_shared" })]),
        findUnique: vi.fn(),
      },
    })
    const deps = createDeps({ prismaClient })

    const result = await runMigration({ mode: "write" }, deps)

    expect(deps.target.users.createUser).toHaveBeenCalledTimes(1)
    expect(result.processed).toBe(1)

    const mapRowCalls = (prismaClient.clerkIdMigration.upsert as ReturnType<typeof vi.fn>).mock.calls
    const newClerkIds = new Set(mapRowCalls.map(([args]) => args.create.newClerkId ?? args.update.newClerkId))
    expect(newClerkIds.size).toBe(1)

    const mapRows = await prismaClient.clerkIdMigration.findMany()
    expect(mapRows).toHaveLength(2)
    expect(mapRows.map((row) => row.entity).sort()).toEqual(["staff", "user"])
    expect(new Set(mapRows.map((row) => row.newClerkId)).size).toBe(1)
  })
})

describe("runMigration — different oldClerkId, matching phone (existing idempotency reuse)", () => {
  it("reuses the existing target user found by phone lookup instead of creating a duplicate, even when oldClerkId differs (e.g. a User row and a StaffAccount row that were never linked in Clerk)", async () => {
    const prismaClient = createPrismaClientFake({
      user: {
        findMany: vi
          .fn()
          .mockResolvedValue([makeUserRow({ id: "user_db_1", clerkId: "clerk_dev_user_only", phone: "2125551234" })]),
        findUnique: vi.fn(),
      },
      staffAccount: {
        findMany: vi.fn().mockResolvedValue([
          makeStaffRow({ id: "staff_db_1", clerkUserId: "clerk_dev_staff_only", phone: "2125551234" }),
        ]),
        findUnique: vi.fn(),
      },
    })
    const target = {
      users: {
        getUserList: vi.fn().mockResolvedValue({ data: [{ id: "clerk_prod_existing" }] }),
        createUser: vi.fn().mockResolvedValue({ id: "clerk_prod_should_not_be_used" }),
        getUser: vi.fn(),
      },
      phoneNumbers: { createPhoneNumber: vi.fn() },
    } as never
    const deps = createDeps({ prismaClient, target })

    const result = await runMigration({ mode: "write" }, deps)

    expect(deps.target.users.createUser).not.toHaveBeenCalled()
    expect(result.results.every((row) => row.phase === "reused" && row.newClerkId === "clerk_prod_existing")).toBe(true)
  })
})

describe("runMigration — invalid phone counted distinctly from created", () => {
  it("reports an invalid-phone outcome under invalidPhone, not under created", async () => {
    const prismaClient = createPrismaClientFake({
      user: {
        // digitsToE164 rejects a 9-digit bare number.
        findMany: vi.fn().mockResolvedValue([makeUserRow({ phone: "212555123" })]),
        findUnique: vi.fn(),
      },
    })
    const deps = createDeps({ prismaClient })

    const result = await runMigration({ mode: "write" }, deps)

    // The instance requires a phone at creation, so an invalid phone means the
    // user is NOT created at all — bailed before createUser.
    expect(deps.target.users.createUser).not.toHaveBeenCalled()
    expect(deps.target.phoneNumbers.createPhoneNumber).not.toHaveBeenCalled()
    expect(result.results[0].phase).toBe("invalid_phone")
    expect(result.created).toBe(0)
    expect(result.invalidPhone).toBe(1)
  })
})

describe("runMigration — phone supplied at creation and verified", () => {
  it("passes the E.164 phone to createUser and verifies an existing unverified phone", async () => {
    const prismaClient = createPrismaClientFake({
      user: {
        findMany: vi.fn().mockResolvedValue([makeUserRow({ clerkId: "clerk_dev_1", phone: "2125551234" })]),
        findUnique: vi.fn(),
      },
    })
    const target = {
      users: {
        getUserList: vi.fn().mockResolvedValue(emptyUserList),
        createUser: vi.fn().mockResolvedValue({ id: "clerk_prod_1" }),
        getUser: vi.fn().mockResolvedValue({
          id: "clerk_prod_1",
          phoneNumbers: [{ id: "phone_1", phoneNumber: "+12125551234", verification: { status: "unverified" } }],
        }),
      },
      phoneNumbers: {
        createPhoneNumber: vi.fn(),
        updatePhoneNumber: vi.fn().mockResolvedValue({ id: "phone_1" }),
      },
    } as unknown as MigrateTargetClient
    const deps = createDeps({ prismaClient, target })

    const result = await runMigration({ mode: "write" }, deps)

    expect(target.users.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ phoneNumber: ["+12125551234"] })
    )
    expect(target.phoneNumbers.updatePhoneNumber).toHaveBeenCalledWith("phone_1", {
      verified: true,
      primary: true,
    })
    expect(target.phoneNumbers.createPhoneNumber).not.toHaveBeenCalled()
    expect(result.results[0].phase).toBe("phone_attached")
    expect(result.phoneAttached).toBe(1)
  })
})

describe("runMigration — skipped_deleted", () => {
  it("marks the map row skipped_deleted and leaves the DB row untouched when the source getUser returns 404", async () => {
    const prismaClient = createPrismaClientFake({
      user: { findMany: vi.fn().mockResolvedValue([makeUserRow()]), findUnique: vi.fn() },
    })
    const source = { users: { getUser: vi.fn().mockRejectedValue({ status: 404 }) } } as never
    const deps = createDeps({ prismaClient, source })

    const result = await runMigration({ mode: "write" }, deps)

    expect(deps.target.users.createUser).not.toHaveBeenCalled()
    expect(result.results[0].phase).toBe("skipped_deleted")
    expect(result.skippedDeleted).toBe(1)
  })

  it("writes a skipped_deleted map row for BOTH linked entities of a merged User+StaffAccount candidate when the source getUser returns 404", async () => {
    const prismaClient = createPrismaClientFake({
      user: {
        findMany: vi.fn().mockResolvedValue([makeUserRow({ id: "user_db_1", clerkId: "clerk_dev_shared" })]),
        findUnique: vi.fn(),
      },
      staffAccount: {
        findMany: vi.fn().mockResolvedValue([makeStaffRow({ id: "staff_db_1", clerkUserId: "clerk_dev_shared" })]),
        findUnique: vi.fn(),
      },
    })
    const source = { users: { getUser: vi.fn().mockRejectedValue({ status: 404 }) } } as never
    const deps = createDeps({ prismaClient, source })

    const result = await runMigration({ mode: "write" }, deps)

    expect(deps.target.users.createUser).not.toHaveBeenCalled()
    expect(result.processed).toBe(1)
    expect(result.results[0].phase).toBe("skipped_deleted")

    const mapRows = await prismaClient.clerkIdMigration.findMany()
    expect(mapRows).toHaveLength(2)
    expect(mapRows.map((row) => row.entity).sort()).toEqual(["staff", "user"])
    expect(mapRows.every((row) => row.phase === "skipped_deleted")).toBe(true)
  })
})

describe("runMigration — placeholder email excluded", () => {
  it("calls createUser without emailAddress and skips email-fallback idempotency matching", async () => {
    const prismaClient = createPrismaClientFake({
      user: {
        findMany: vi.fn().mockResolvedValue([
          makeUserRow({ email: "phone-2125551234-1700000000000@placeholder.pli.local" }),
        ]),
        findUnique: vi.fn(),
      },
    })
    const deps = createDeps({ prismaClient })

    await runMigration({ mode: "write" }, deps)

    expect(deps.target.users.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ emailAddress: undefined })
    )
    // Idempotency lookup must not have used emailAddress for a placeholder email.
    const getUserListCalls = (deps.target.users.getUserList as ReturnType<typeof vi.fn>).mock.calls
    for (const [callArgs] of getUserListCalls) {
      expect(callArgs.emailAddress).toBeUndefined()
    }
  })
})

describe("runMigration — metadata verbatim buckets", () => {
  it("copies publicMetadata, privateMetadata, and unsafeMetadata verbatim without consolidation", async () => {
    const prismaClient = createPrismaClientFake({
      staffAccount: { findMany: vi.fn().mockResolvedValue([makeStaffRow()]), findUnique: vi.fn() },
    })
    const deps = createDeps({ prismaClient })

    await runMigration({ mode: "write" }, deps)

    expect(deps.target.users.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        publicMetadata: { schoolId: "school_1" },
        privateMetadata: { staffPinHash: "hash-abc" },
        unsafeMetadata: { onboardingComplete: true },
      })
    )
  })
})

describe("runMigration — skipPasswordRequirement present", () => {
  it("includes skipPasswordRequirement: true on every createUser call", async () => {
    const prismaClient = createPrismaClientFake({
      user: { findMany: vi.fn().mockResolvedValue([makeUserRow()]), findUnique: vi.fn() },
    })
    const deps = createDeps({ prismaClient })

    await runMigration({ mode: "write" }, deps)

    expect(deps.target.users.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ skipPasswordRequirement: true })
    )
  })
})

describe("withRateLimitRetry — 429 backoff", () => {
  it("retries on a 429 response and eventually succeeds without aborting", async () => {
    vi.useFakeTimers()
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 429 })
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce("ok")

    const promise = withRateLimitRetry(fn, logger)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toBe("ok")
    expect(fn).toHaveBeenCalledTimes(3)
    expect(logger.warn).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("does not retry and rethrows a non-429 error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"))

    await expect(withRateLimitRetry(fn, logger)).rejects.toThrow("boom")
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe("runMigration — resume from user_created", () => {
  it("does not call createUser again and only retries the phone-attachment call", async () => {
    const prismaClient = createPrismaClientFake({
      user: { findMany: vi.fn().mockResolvedValue([makeUserRow()]), findUnique: vi.fn() },
    })
    const seeded: ClerkIdMigrationRow = makeMapRow({ phase: "user_created", newClerkId: "clerk_prod_partial" })
    prismaClient.clerkIdMigration.findUnique = vi.fn().mockResolvedValue(seeded)

    const deps = createDeps({ prismaClient })

    const result = await runMigration({ mode: "write" }, deps)

    expect(deps.target.users.createUser).not.toHaveBeenCalled()
    expect(deps.target.phoneNumbers.createPhoneNumber).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "clerk_prod_partial", verified: true, primary: true })
    )
    expect(result.results[0]).toMatchObject({ newClerkId: "clerk_prod_partial", phase: "phone_attached" })
  })

  it("performs zero Clerk/DB writes when resuming a user_created row under --mode=dry-run", async () => {
    const prismaClient = createPrismaClientFake({
      user: { findMany: vi.fn().mockResolvedValue([makeUserRow()]), findUnique: vi.fn() },
    })
    const seeded: ClerkIdMigrationRow = makeMapRow({ phase: "user_created", newClerkId: "clerk_prod_partial" })
    prismaClient.clerkIdMigration.findUnique = vi.fn().mockResolvedValue(seeded)

    const deps = createDeps({ prismaClient })

    const result = await runMigration({ mode: "dry-run" }, deps)

    expect(deps.target.users.createUser).not.toHaveBeenCalled()
    expect(deps.target.phoneNumbers.createPhoneNumber).not.toHaveBeenCalled()
    expect(prismaClient.clerkIdMigration.upsert).not.toHaveBeenCalled()
    // A simulated "would attach phone" outcome — the row is reported as
    // phone_attached for dry-run reporting purposes, without any real write.
    expect(result.results[0]).toMatchObject({ newClerkId: "clerk_prod_partial", phase: "phone_attached" })
  })
})
