import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { admitSpecialClassReservation } from "@/lib/checkout/special-class-reservation"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"
import { setupIntegrationDb } from "./db-test-utils"
import { updatePublishedSpecialClassCapacity } from "@/lib/special-classes/management"
import { admitSpecialClassCashWalkIn } from "@/lib/special-classes/fulfillment"
import { CAPACITY_STATUSES } from "@/lib/special-classes/policy"

let prisma: PrismaClient
let cleanupDb: (() => Promise<void>) | null = null

const now = new Date("2026-08-23T20:00:00.000Z")

const createCashFixture = async (input: { capacity?: number; status?: string; priceCents?: number; currency?: string } = {}) => {
  const key = randomUUID()
  const session = await prisma.classSession.create({
    data: { courseSlug: `cash-${key}`, title: "Cash capacity", startsAt: new Date("2026-08-30T20:00:00.000Z"), capacity: input.capacity ?? 40 },
  })
  const specialClass = await prisma.specialClass.create({
    data: { slug: `cash-${key}`, status: input.status ?? "published", classSessionId: session.id, title: "Cash capacity", description: "Cash capacity", currency: input.currency ?? "usd", priceCents: input.priceCents ?? 2500, createdBy: "test" },
  })
  return { specialClass, session }
}

const createCashUser = (label: string) => prisma.user.create({ data: { email: `${label}-${randomUUID()}@example.com`, name: label } })

const admitCash = (specialClassId: string, dbUserId: string, eventId = randomUUID()) =>
  admitSpecialClassCashWalkIn(prisma, { specialClassId, dbUserId, source: "test_cash_walk_in", eventId, now })

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
    const occupied = await prisma.purchase.count({ where: { specialClassId: specialClass.id, OR: [{ status: { in: CAPACITY_STATUSES } }, { status: "pending", holdExpiresAt: { gt: now } }] } })
    expect(occupied).toBeLessThanOrEqual(finalSession.capacity)
    expect(admission.ok || capacityEdit.ok).toBe(true)
    expect(admission.ok && capacityEdit.ok).toBe(false)
  }, 120_000)

  it("checks in a cash walk-in immediately while keeping the Purchase cash_pending", async () => {
    const { specialClass, session } = await createCashFixture()
    const user = await createCashUser("cash-admitted")

    const outcome = await admitCash(specialClass.id, user.id)

    expect(outcome).toHaveProperty("purchaseId")
    expect(outcome).toHaveProperty("attendanceId")
    if ("code" in outcome) throw new Error(`Expected admission, received ${outcome.code}`)
    await expect(prisma.purchase.findUniqueOrThrow({ where: { id: outcome.purchaseId } })).resolves.toMatchObject({ status: "cash_pending", specialClassId: specialClass.id, classSessionId: session.id })
    await expect(prisma.attendance.findUniqueOrThrow({ where: { id: outcome.attendanceId } })).resolves.toMatchObject({ userId: user.id, sessionId: session.id, status: "checked_in" })
  }, 120_000)

  it("persists the locked special-class price and currency for a cash walk-in", async () => {
    const { specialClass } = await createCashFixture({ priceCents: 3700, currency: "cad" })
    const user = await createCashUser("cash-authoritative-price")

    const outcome = await admitCash(specialClass.id, user.id)

    if ("code" in outcome) throw new Error(`Expected admission, received ${outcome.code}`)
    await expect(prisma.purchase.findUniqueOrThrow({ where: { id: outcome.purchaseId } })).resolves.toMatchObject({ amount: 3700, currency: "cad" })
  }, 120_000)

  it("rejects a sold-out cash walk-in without creating a Purchase or Attendance", async () => {
    const { specialClass, session } = await createCashFixture()
    const users = await Promise.all(Array.from({ length: 41 }, (_, index) => createCashUser(`cash-full-${index}`)))
    const statuses = ["paid", "capture_pending", "cash_pending", "pending"]
    await prisma.purchase.createMany({
      data: users.slice(0, 40).map((user, index) => ({
        userId: user.id, courseSlug: session.courseSlug, amount: 2500, currency: "usd", status: statuses[index % statuses.length], participants: 1,
        specialClassId: specialClass.id, classSessionId: session.id, holdExpiresAt: statuses[index % statuses.length] === "pending" ? new Date(now.getTime() + 60_000) : null,
      })),
    })

    await expect(admitCash(specialClass.id, users[40].id)).resolves.toEqual({ code: "SOLD_OUT" })
    await expect(prisma.purchase.count({ where: { userId: users[40].id } })).resolves.toBe(0)
    await expect(prisma.attendance.count({ where: { userId: users[40].id, sessionId: session.id } })).resolves.toBe(0)
  }, 120_000)

  it("admits only one of a card hold and cash check-in at the final seat", async () => {
    const { specialClass, session } = await createCashFixture()
    const users = await Promise.all(Array.from({ length: 41 }, (_, index) => createCashUser(`cash-race-${index}`)))
    await prisma.purchase.createMany({
      data: users.slice(0, 39).map((user) => ({ userId: user.id, courseSlug: session.courseSlug, amount: 2500, currency: "usd", status: "paid", participants: 1, specialClassId: specialClass.id, classSessionId: session.id })),
    })

    const [card, cash] = await Promise.all([
      admitSpecialClassReservation({ attemptId: randomUUID(), specialClassSlug: specialClass.slug, dbUserId: users[39].id, email: users[39].email, name: users[39].name || "Card", phone: "+12015550199" }, { db: prisma as never, now: () => now }),
      admitCash(specialClass.id, users[40].id),
    ])

    expect([card.ok, !("code" in cash)].filter(Boolean)).toHaveLength(1)
    await expect(prisma.purchase.count({ where: { specialClassId: specialClass.id, OR: [{ status: { in: CAPACITY_STATUSES } }, { status: "pending", holdExpiresAt: { gt: now } }] } })).resolves.toBe(40)
  }, 120_000)

  it("keeps the occupied count unchanged when cash_pending settles to paid", async () => {
    const { specialClass } = await createCashFixture()
    const user = await createCashUser("cash-settlement")
    const outcome = await admitCash(specialClass.id, user.id)
    if ("code" in outcome) throw new Error(`Expected admission, received ${outcome.code}`)
    const before = await prisma.purchase.count({ where: { specialClassId: specialClass.id, status: { in: CAPACITY_STATUSES } } })

    await prisma.purchase.update({ where: { id: outcome.purchaseId }, data: { status: "paid" } })

    await expect(prisma.purchase.count({ where: { specialClassId: specialClass.id, status: { in: CAPACITY_STATUSES } } })).resolves.toBe(before)
    await expect(prisma.attendance.findUniqueOrThrow({ where: { id: outcome.attendanceId } })).resolves.toMatchObject({ status: "checked_in" })
  }, 120_000)

  it("rejects a duplicate cash check-in without creating another Purchase or Attendance", async () => {
    const { specialClass, session } = await createCashFixture()
    const user = await createCashUser("cash-duplicate")
    await prisma.attendance.create({ data: { userId: user.id, sessionId: session.id, status: "checked_in", checkedInAt: now } })

    await expect(admitCash(specialClass.id, user.id)).resolves.toEqual({ code: "ALREADY_CHECKED_IN" })
    await expect(prisma.purchase.count({ where: { userId: user.id } })).resolves.toBe(0)
    await expect(prisma.attendance.count({ where: { userId: user.id, sessionId: session.id } })).resolves.toBe(1)
  }, 120_000)

  it("rejects cash admission for unpublished or cancelled special classes", async () => {
    const unpublished = await createCashFixture({ status: "draft" })
    const cancelled = await createCashFixture({ status: "cancelled" })
    const [unpublishedUser, cancelledUser] = await Promise.all([createCashUser("cash-draft"), createCashUser("cash-cancelled")])

    await expect(admitCash(unpublished.specialClass.id, unpublishedUser.id)).resolves.toEqual({ code: "NOT_AVAILABLE" })
    await expect(admitCash(cancelled.specialClass.id, cancelledUser.id)).resolves.toEqual({ code: "NOT_AVAILABLE" })
  }, 120_000)
})
