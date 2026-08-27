import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { finalizeSpecialClassCapture } from "@/lib/special-classes/fulfillment"
import { lockSpecialClassBoundary, runSpecialClassSerializableTransaction } from "@/lib/special-classes/management"
import { applySpecialClassRosterAction } from "@/lib/special-classes/staff-mutations"
import { setupIntegrationDb } from "./db-test-utils"

let prisma: PrismaClient
let cleanup: (() => Promise<void>) | null = null

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((next) => { resolve = next })
  return { promise, resolve }
}

describe("special class staff mutation races", () => {
  beforeAll(async () => { const context = await setupIntegrationDb(); prisma = context.prisma; cleanup = context.cleanup }, 120_000)
  afterAll(async () => { if (cleanup) await cleanup() }, 120_000)

  it("blocks staff cancellation while capture_pending is locked, then lets capture finalize", async () => {
    const user = await prisma.user.create({ data: { email: "capture-cancel-race@example.com" } })
    const session = await prisma.classSession.create({ data: { courseSlug: "capture-cancel-race", startsAt: new Date(Date.now() + 60_000), capacity: 2 } })
    const specialClass = await prisma.specialClass.create({ data: { slug: "capture-cancel-race", status: "published", classSessionId: session.id, title: "Capture race", description: "Race", currency: "usd", priceCents: 2500, createdBy: "test" } })
    const purchase = await prisma.purchase.create({ data: { userId: user.id, courseSlug: session.courseSlug, amount: 2500, currency: "usd", status: "capture_pending", participants: 1, specialClassId: specialClass.id, classSessionId: session.id } })
    const attendance = await prisma.attendance.create({ data: { userId: user.id, sessionId: session.id, status: "scheduled", metadata: { purchaseId: purchase.id } } })
    const locked = deferred()
    const release = deferred()

    const cancellation = applySpecialClassRosterAction(prisma, {
      specialClassId: specialClass.id,
      attendanceId: attendance.id,
      action: "cancel",
      reason: "Customer request",
      idempotencyKey: "capture-cancel-race",
      actorClerkUserId: "owner_1",
      actorRole: "owner",
    }, { afterStateLocked: async () => { locked.resolve(); await release.promise } })
    await locked.promise
    const capture = finalizeSpecialClassCapture(prisma, { purchaseId: purchase.id, eventId: "evt_capture_cancel_race" })
    release.resolve()

    await expect(cancellation).resolves.toEqual({ kind: "capture_in_progress", retryable: true })
    await expect(capture).resolves.toMatchObject({ status: "paid" })
    await expect(prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).resolves.toMatchObject({ status: "paid" })
    await expect(prisma.attendance.findUniqueOrThrow({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "scheduled" })
  }, 120_000)

  it("serializes lifecycle cancellation before check-in and rejects the queued check-in", async () => {
    const user = await prisma.user.create({ data: { email: "class-cancel-checkin-race@example.com" } })
    const session = await prisma.classSession.create({ data: { courseSlug: "class-cancel-checkin-race", startsAt: new Date(Date.now() + 60_000), capacity: 2 } })
    const specialClass = await prisma.specialClass.create({ data: { slug: "class-cancel-checkin-race", status: "published", classSessionId: session.id, title: "Check-in race", description: "Race", currency: "usd", priceCents: 2500, createdBy: "test" } })
    const attendance = await prisma.attendance.create({ data: { userId: user.id, sessionId: session.id, status: "scheduled" } })
    const locked = deferred()
    const release = deferred()

    const lifecycleCancellation = runSpecialClassSerializableTransaction(prisma, async (tx) => {
      await lockSpecialClassBoundary(tx, specialClass.id)
      locked.resolve()
      await release.promise
      return tx.specialClass.update({ where: { id: specialClass.id }, data: { status: "cancelled", cancelledAt: new Date() } })
    })
    await locked.promise
    const checkIn = applySpecialClassRosterAction(prisma, {
      specialClassId: specialClass.id,
      attendanceId: attendance.id,
      action: "check_in",
      reason: "",
      idempotencyKey: "cancel-checkin-race",
      actorClerkUserId: "staff_1",
      actorRole: "staff",
    })
    release.resolve()

    await expect(lifecycleCancellation).resolves.toMatchObject({ status: "cancelled" })
    await expect(checkIn).resolves.toEqual({ kind: "class_cancelled" })
    await expect(prisma.attendance.findUniqueOrThrow({ where: { id: attendance.id } })).resolves.toMatchObject({ status: "scheduled" })
  }, 120_000)
})
