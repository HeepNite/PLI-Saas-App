import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma")
const migrationPath = resolve(process.cwd(), "prisma/migrations/20260812151500_add_native_fast_tap/migration.sql")

describe("native Fast Tap durable schema", () => {
  it("declares reader, job, anonymous result, reconciliation, and uniqueness contracts", async () => {
    const schema = await readFile(schemaPath, "utf8")

    expect(schema).toContain("model NativeReader")
    expect(schema).toMatch(/tokenHash\s+String\s+@unique/)
    expect(schema).toMatch(/revokedAt\s+DateTime\?/)

    expect(schema).toContain("model NativePaymentJob")
    expect(schema).toMatch(/readerId\s+String/)
    expect(schema).toMatch(/classSessionId\s+String/)
    expect(schema).toMatch(/courseSlugSnapshot\s+String/)
    expect(schema).toMatch(/courseTitleSnapshot\s+String\?/)
    expect(schema).toMatch(/amountCents\s+Int/)
    expect(schema).toMatch(/currency\s+String/)
    expect(schema).toMatch(/idempotencyKey\s+String\s+@unique/)
    expect(schema).toMatch(/reconcileAfter\s+DateTime\?/)
    expect(schema).toMatch(/reconcileAttempts\s+Int\s+@default\(0\)/)
    expect(schema).toMatch(/leaseOwner\s+String\?/)
    expect(schema).toMatch(/leaseExpiresAt\s+DateTime\?/)
    expect(schema).toMatch(/needsReview\s+Boolean\s+@default\(false\)/)
    expect(schema).toMatch(/reviewReason\s+String\?/)
    expect(schema).toContain("@@index([status, reconcileAfter])")
    expect(schema).toContain("@@index([leaseExpiresAt])")
    expect(schema).toContain("@@index([needsReview, reconcileAfter])")

    expect(schema).toContain("model AnonymousSale")
    expect(schema).toMatch(/paymentJobId\s+String\s+@unique/)
    expect(schema).toContain("model AnonymousAttendanceGrant")
    expect(schema).toMatch(/paymentJobId\s+String\s+@unique/)
    expect(schema).toMatch(/sessionId\s+String/)
    expect(schema).toContain("@relation(fields: [paymentJobId, sessionId], references: [id, classSessionId])")
    expect(schema).toContain("@@unique([id, classSessionId])")
    expect(schema).toContain("@@unique([paymentJobId, sessionId])")
    expect(schema).toContain("@@index([sessionId])")

    expect(schema).toMatch(/model Attendance \{[\s\S]*userId\s+String[\s\S]*user\s+User/)
  })

  it("creates the additive tables, unique keys, and reconciliation indexes", async () => {
    const migration = await readFile(migrationPath, "utf8")

    expect(migration).toContain('CREATE TABLE "NativeReader"')
    expect(migration).toContain('CREATE TABLE "NativePaymentJob"')
    expect(migration).toContain('CREATE TABLE "AnonymousSale"')
    expect(migration).toContain('CREATE TABLE "AnonymousAttendanceGrant"')
    expect(migration).toContain('CREATE UNIQUE INDEX "NativePaymentJob_idempotencyKey_key"')
    expect(migration).toContain('CREATE UNIQUE INDEX "AnonymousSale_paymentJobId_key"')
    expect(migration).toContain('CREATE UNIQUE INDEX "AnonymousAttendanceGrant_paymentJobId_key"')
    expect(migration).toContain('FOREIGN KEY ("paymentJobId", "sessionId") REFERENCES "NativePaymentJob"("id", "classSessionId")')
    expect(migration).toContain('CREATE INDEX "NativePaymentJob_status_reconcileAfter_idx"')
    expect(migration).toContain('CREATE INDEX "NativePaymentJob_leaseExpiresAt_idx"')
    expect(migration).toContain('CREATE INDEX "NativePaymentJob_needsReview_reconcileAfter_idx"')
  })
})
