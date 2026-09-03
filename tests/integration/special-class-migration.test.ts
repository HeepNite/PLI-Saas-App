import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { setupMigratedIntegrationDb, setupMigrationRehearsalDb } from "./db-test-utils"

const LATEST_MIGRATION = "20260903160000_school_builder_special_class_authoring"

let prisma: PrismaClient
let cleanup: (() => Promise<void>) | null = null

describe("special class migration on an isolated PostgreSQL schema", () => {
  beforeAll(async () => {
    const context = await setupMigratedIntegrationDb()
    prisma = context.prisma
    cleanup = context.cleanup
  }, 120_000)

  afterAll(async () => { if (cleanup) await cleanup() }, 120_000)

  it("creates canonical special class, purchase hold, and audit storage", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name IN ('SpecialClass', 'SpecialClassAuditLog', 'Purchase', 'ClassSession')
    `
    expect(new Set(tables.map((row) => row.table_name))).toEqual(new Set(["SpecialClass", "SpecialClassAuditLog", "Purchase", "ClassSession"]))
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'Purchase'
        AND column_name IN ('specialClassId', 'classSessionId', 'holdExpiresAt')
    `
    expect(new Set(columns.map((row) => row.column_name))).toEqual(new Set(["specialClassId", "classSessionId", "holdExpiresAt"]))
    const auditColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'SpecialClassAuditLog'
        AND column_name IN ('correlationId', 'idempotencyKey')
    `
    expect(new Set(auditColumns.map((row) => row.column_name))).toEqual(new Set(["correlationId", "idempotencyKey"]))
  })

  it("creates stable authoring identity with database uniqueness", async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN ('CourseCatalogSpecialClassSlot', 'CourseCatalogAuthoringOperation')
    `
    expect(new Set(tables.map(({ table_name }) => table_name))).toEqual(new Set([
      "CourseCatalogSpecialClassSlot", "CourseCatalogAuthoringOperation",
    ]))
    const course = await prisma.courseCatalog.create({ data: {
      slug: "identity-course", title: "Identity Course", availableWeekdays: [], availableTimes: [],
    } })
    expect(course.specialClassOperationsEnabled).toBe(false)
    expect(course.specialClassCapacity).toBeNull()
    await expect(prisma.courseCatalog.create({ data: { slug: "invalid-capacity", title: "Invalid", availableWeekdays: [], availableTimes: [], specialClassCapacity: 0 } })).rejects.toThrow()
    const startsAt = new Date("2026-10-01T18:00:00.000Z")
    const slot = await prisma.courseCatalogSpecialClassSlot.create({ data: { courseCatalogId: course.id, startsAt } })
    expect(slot.id).toMatch(/^[0-9a-f-]{36}$/)
    await expect(prisma.courseCatalogSpecialClassSlot.create({ data: { courseCatalogId: course.id, startsAt } })).rejects.toThrow()

    const firstSession = await prisma.classSession.create({ data: { courseSlug: "identity-1", startsAt, capacity: 10 } })
    const secondSession = await prisma.classSession.create({ data: { courseSlug: "identity-2", startsAt, capacity: 10 } })
    const specialData = { status: "draft", title: "Identity", description: "Identity", currency: "usd", priceCents: 1000, createdBy: "migration-test", authoringSlotId: slot.id }
    await prisma.specialClass.create({ data: { ...specialData, slug: "identity-1", classSessionId: firstSession.id } })
    await expect(prisma.specialClass.create({ data: { ...specialData, slug: "identity-2", classSessionId: secondSession.id } })).rejects.toThrow()
    const operation = { operationId: "5d647c42-387b-48bf-b1a0-19075fd7f57e", courseCatalogId: course.id, payloadHash: "hash", resultSummary: {} }
    await prisma.courseCatalogAuthoringOperation.create({ data: operation })
    await expect(prisma.courseCatalogAuthoringOperation.create({ data: operation })).rejects.toThrow()
  })

  it("enforces lifecycle, money, canonical-link, and one-attendee constraints", async () => {
    const session = await prisma.classSession.create({ data: { courseSlug: "migration-constraints", startsAt: new Date("2026-09-01T20:00:00.000Z"), capacity: 10 } })
    await expect(prisma.specialClass.create({ data: {
      slug: "invalid-status", status: "hidden", classSessionId: session.id, title: "Invalid", description: "Invalid",
      currency: "usd", priceCents: 1000, createdBy: "migration-test",
    } })).rejects.toThrow()
    const specialClass = await prisma.specialClass.create({ data: {
      slug: "valid-special", status: "draft", classSessionId: session.id, title: "Valid", description: "Valid",
      currency: "usd", priceCents: 1000, createdBy: "migration-test",
    } })
    const user = await prisma.user.create({ data: { email: "migration-constraint@example.com" } })
    await expect(prisma.purchase.create({ data: {
      userId: user.id, courseSlug: session.courseSlug, amount: 1000, currency: "usd", status: "pending",
      participants: 2, specialClassId: specialClass.id, classSessionId: session.id, holdExpiresAt: new Date("2026-09-01T19:00:00.000Z"),
    } })).rejects.toThrow()
  })
})

describe("special class migration with representative legacy rows", () => {
  it("preserves disabled courses and standalone special classes without inferred links", async () => {
    const context = await setupMigrationRehearsalDb(LATEST_MIGRATION)
    try {
      const fixtures = [
        `INSERT INTO "CourseCatalog" ("id", "slug", "title", "kind", "availableWeekdays", "availableTimes", "active", "createdAt", "updatedAt") VALUES ('legacy-course', 'special-salsa-class', 'Salsa Special', 'workshop', ARRAY[]::INTEGER[], ARRAY[]::TEXT[], true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `INSERT INTO "User" ("id", "email", "createdAt", "updatedAt") VALUES ('legacy-user', 'legacy-migration@example.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `INSERT INTO "ClassSession" ("id", "courseSlug", "startsAt", "capacity", "createdAt", "updatedAt") VALUES ('legacy-session', 'special-salsa-class', '2026-10-03T18:00:00Z', 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `INSERT INTO "SpecialClass" ("id", "slug", "status", "classSessionId", "title", "description", "currency", "priceCents", "createdBy", "createdAt", "updatedAt") VALUES ('legacy-special', 'special-salsa-class', 'published', 'legacy-session', 'Salsa Special', 'Legacy', 'usd', 3000, 'migration-test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `INSERT INTO "Purchase" ("id", "userId", "courseSlug", "amount", "currency", "status", "participants", "specialClassId", "classSessionId", "createdAt", "updatedAt") VALUES ('legacy-purchase', 'legacy-user', 'special-salsa-class', 3000, 'usd', 'paid', 1, 'legacy-special', 'legacy-session', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        `INSERT INTO "Attendance" ("id", "userId", "sessionId", "status", "checkedInAt") VALUES ('legacy-attendance', 'legacy-user', 'legacy-session', 'checked_in', '2026-10-03T18:05:00Z')`,
      ]
      for (const fixture of fixtures) await context.prisma.$executeRawUnsafe(fixture)
      const snapshot = () => context.prisma.$queryRaw<Array<{ purchase: unknown; attendance: unknown; specialClass: unknown }>>`
        SELECT to_jsonb(p) - 'createdAt' - 'updatedAt' AS purchase, to_jsonb(a) AS attendance,
          jsonb_build_object('priceCents', s."priceCents", 'currency', s."currency", 'classSessionId', s."classSessionId") AS "specialClass"
        FROM "Purchase" p JOIN "Attendance" a ON a."userId" = p."userId" JOIN "SpecialClass" s ON s."id" = p."specialClassId"
        WHERE p."id" = 'legacy-purchase' AND a."id" = 'legacy-attendance'
      `
      const before = await snapshot()
      expect(before).toHaveLength(1)
      context.deployLatest()
      const [migration] = await context.prisma.$queryRaw<Array<{ enabled: boolean; capacity: number | null; authoringSlotId: string | null; slots: number; operations: number }>>`
        SELECT c."specialClassOperationsEnabled" AS enabled, c."specialClassCapacity" AS capacity,
          s."authoringSlotId", (SELECT COUNT(*)::int FROM "CourseCatalogSpecialClassSlot") AS slots,
          (SELECT COUNT(*)::int FROM "CourseCatalogAuthoringOperation") AS operations
        FROM "CourseCatalog" c JOIN "SpecialClass" s ON s."id" = 'legacy-special' WHERE c."id" = 'legacy-course'
      `
      expect(migration).toEqual({ enabled: false, capacity: null, authoringSlotId: null, slots: 0, operations: 0 })
      expect(await snapshot()).toEqual(before)
    } finally {
      await context.cleanup()
    }
  }, 120_000)
})
