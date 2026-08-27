import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { setupMigratedIntegrationDb } from "./db-test-utils"

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
