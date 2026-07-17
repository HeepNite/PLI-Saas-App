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
})
