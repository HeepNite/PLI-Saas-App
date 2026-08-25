import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { admitSpecialClassReservation } from "@/lib/checkout/special-class-reservation"
import { SPECIAL_SALSA_CLASS, getSpecialClassHoldCutoff } from "@/lib/special-salsa-class/config"
import { setupIntegrationDb } from "./db-test-utils"

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
const describeWithPostgres = hasDatabaseUrl ? describe : describe.skip

let prisma: PrismaClient
let cleanupDb: (() => Promise<void>) | null = null

describeWithPostgres("special salsa class PostgreSQL capacity race (skipped when DATABASE_URL is unavailable)", () => {
  beforeAll(async () => {
    const context = await setupIntegrationDb()
    prisma = context.prisma
    cleanupDb = context.cleanup
  }, 120_000)

  afterAll(async () => {
    if (cleanupDb) await cleanupDb()
  }, 120_000)

  it("admits exactly one of two concurrent attempts for the final spot", async () => {
    const now = new Date("2026-08-23T20:00:00.000Z")
    const holdExpiresAt = new Date("2026-08-23T20:30:00.000Z")
    const users = await Promise.all(
      Array.from({ length: 41 }, (_, index) => prisma.user.create({
        data: {
          email: `special-capacity-${index}@example.com`,
          name: `Capacity User ${index}`,
        },
      })),
    )

    await prisma.purchase.createMany({
      data: users.slice(0, 39).map((user, index) => ({
        userId: user.id,
        courseSlug: SPECIAL_SALSA_CLASS.courseSlug,
        courseTitle: SPECIAL_SALSA_CLASS.title,
        amount: SPECIAL_SALSA_CLASS.amountCents,
        currency: SPECIAL_SALSA_CLASS.currency,
        status: "pending",
        email: user.email,
        name: user.name,
        phone: `1201555${String(index).padStart(4, "0")}`,
        participants: 1,
        serviceId: SPECIAL_SALSA_CLASS.checkoutKind,
        idempotencyKey: `${SPECIAL_SALSA_CLASS.key}:seed-${index}`,
        createdAt: now,
        metadata: {
          specialEventKey: SPECIAL_SALSA_CLASS.key,
          holdExpiresAt: holdExpiresAt.toISOString(),
        },
      })),
    })

    const reserve = (userIndex: number, attemptId: string) => admitSpecialClassReservation({
      attemptId,
      dbUserId: users[userIndex].id,
      email: users[userIndex].email || `special-capacity-${userIndex}@example.com`,
      name: users[userIndex].name || `Capacity User ${userIndex}`,
      phone: `+1201555${String(userIndex).padStart(4, "0")}`,
      holdExpiresAt,
    }, {
      db: prisma as never,
      now: () => now,
    })

    const results = await Promise.all([
      reserve(39, "c6c05f53-2cc6-4a78-a35e-61daf6f13cb2"),
      reserve(40, "6f4fdf3c-a910-4f72-b8f0-f5637a101d65"),
    ])

    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results).toContainEqual({ ok: false, code: "SOLD_OUT" })
    await expect(prisma.purchase.count({
      where: {
        courseSlug: SPECIAL_SALSA_CLASS.courseSlug,
        status: "pending",
        createdAt: { gt: getSpecialClassHoldCutoff(now) },
      },
    })).resolves.toBe(40)
  }, 120_000)
})
