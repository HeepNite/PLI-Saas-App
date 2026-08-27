import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { admitSpecialClassReservation } from "@/lib/checkout/special-class-reservation"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"
import { setupIntegrationDb } from "./db-test-utils"
import { updatePublishedSpecialClassCapacity } from "@/lib/special-classes/management"

let prisma: PrismaClient
let cleanupDb: (() => Promise<void>) | null = null

describe("special class PostgreSQL capacity invariants", () => {
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
    const holdExpiresAt = new Date("2026-08-23T20:03:00.000Z")
    const users = await Promise.all(
      Array.from({ length: 41 }, (_, index) => prisma.user.create({
        data: {
          email: `special-capacity-${index}@example.com`,
          name: `Capacity User ${index}`,
        },
      })),
    )

    const session = await prisma.classSession.create({ data: { courseSlug: SPECIAL_SALSA_CLASS.courseSlug, title: SPECIAL_SALSA_CLASS.title, startsAt: SPECIAL_SALSA_CLASS.startsAt, capacity: 40 } })
    const specialClass = await prisma.specialClass.create({ data: { slug: SPECIAL_SALSA_CLASS.key, status: "published", classSessionId: session.id, title: SPECIAL_SALSA_CLASS.title, description: "Capacity race", currency: "usd", priceCents: 2500, createdBy: "test" } })
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
        specialClassId: specialClass.id,
        classSessionId: session.id,
        holdExpiresAt,
      })),
    })

    const reserve = (userIndex: number, attemptId: string) => admitSpecialClassReservation({
      attemptId,
      specialClassSlug: SPECIAL_SALSA_CLASS.key,
      dbUserId: users[userIndex].id,
      email: users[userIndex].email || `special-capacity-${userIndex}@example.com`,
      name: users[userIndex].name || `Capacity User ${userIndex}`,
      phone: `+1201555${String(userIndex).padStart(4, "0")}`,
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
        specialClassId: specialClass.id,
        status: "pending",
        holdExpiresAt: { gt: now },
      },
    })).resolves.toBe(40)
  }, 120_000)

  it("serializes a published capacity reduction with checkout admission", async () => {
    const now = new Date("2026-08-23T20:00:00.000Z")
    const users = await Promise.all(["existing", "candidate"].map((label) => prisma.user.create({ data: { email: `capacity-edit-${label}@example.com` } })))
    const session = await prisma.classSession.create({ data: { courseSlug: "capacity-edit-race", title: "Capacity edit race", startsAt: new Date("2026-08-30T20:00:00.000Z"), capacity: 2 } })
    const specialClass = await prisma.specialClass.create({ data: { slug: "capacity-edit-race", status: "published", classSessionId: session.id, title: "Capacity edit race", description: "Race", currency: "usd", priceCents: 2500, createdBy: "test" } })
    await prisma.purchase.create({ data: { userId: users[0].id, courseSlug: session.courseSlug, amount: 2500, currency: "usd", status: "paid", participants: 1, specialClassId: specialClass.id, classSessionId: session.id } })

    const [admission, capacityEdit] = await Promise.all([
      admitSpecialClassReservation({ attemptId: "48a7fb74-e132-4dc4-a3ed-583e37e140d7", specialClassSlug: specialClass.slug, dbUserId: users[1].id, email: users[1].email, name: "Candidate", phone: "+12015550199" }, { db: prisma as never, now: () => now }),
      updatePublishedSpecialClassCapacity(prisma, { specialClassId: specialClass.id, capacity: 1, actorClerkUserId: "owner_1", actorRole: "owner", now }),
    ])

    const finalSession = await prisma.classSession.findUniqueOrThrow({ where: { id: session.id } })
    const occupied = await prisma.purchase.count({ where: { specialClassId: specialClass.id, OR: [{ status: { in: ["paid", "succeeded", "completed", "capture_pending"] } }, { status: "pending", holdExpiresAt: { gt: now } }] } })
    expect(occupied).toBeLessThanOrEqual(finalSession.capacity)
    expect(admission.ok || capacityEdit.ok).toBe(true)
    expect(admission.ok && capacityEdit.ok).toBe(false)
  }, 120_000)
})
