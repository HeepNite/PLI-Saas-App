import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { backfillSpecialSalsa } from "@/lib/special-classes/backfill-special-salsa"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"
import { setupIntegrationDb } from "./db-test-utils"

let prisma: PrismaClient
let cleanup: (() => Promise<void>) | null = null

describe("special Salsa backfill", () => {
  beforeAll(async () => { const context = await setupIntegrationDb(); prisma = context.prisma; cleanup = context.cleanup }, 120_000)
  afterAll(async () => { if (cleanup) await cleanup() }, 120_000)

  it("is dry-run safe, additive, idempotent, and preserves financial/attendance data", async () => {
    const user = await prisma.user.create({ data: { email: "backfill@example.com" } })
    const session = await prisma.classSession.create({ data: { courseSlug: SPECIAL_SALSA_CLASS.courseSlug, title: SPECIAL_SALSA_CLASS.title, startsAt: SPECIAL_SALSA_CLASS.startsAt, capacity: SPECIAL_SALSA_CLASS.capacity } })
    const purchase = await prisma.purchase.create({ data: { userId: user.id, courseSlug: SPECIAL_SALSA_CLASS.courseSlug, amount: 2000, currency: "usd", status: "paid", stripeCheckoutSessionId: "cs_backfill", participants: 1 } })
    await prisma.attendance.create({ data: { userId: user.id, sessionId: session.id, status: "scheduled", checkedInAt: SPECIAL_SALSA_CLASS.startsAt } })
    const beforeAttendance = await prisma.attendance.count()
    const dryRun = await backfillSpecialSalsa(prisma, { dryRun: true, now: new Date("2026-08-27T12:00:00.000Z") })
    expect(await prisma.specialClass.count()).toBe(0)
    expect(dryRun).toMatchObject({ paidPurchases: 1, attendanceCount: 1, capacity: SPECIAL_SALSA_CLASS.capacity, conflicts: [] })
    const first = await backfillSpecialSalsa(prisma, { dryRun: false, now: new Date("2026-08-27T12:00:00.000Z") })
    const second = await backfillSpecialSalsa(prisma, { dryRun: false, now: new Date("2026-08-27T12:00:00.000Z") })
    const after = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })
    expect(first.purchasesToLink).toBe(1)
    expect(second.purchasesToLink).toBe(0)
    expect({ amount: after.amount, status: after.status, stripe: after.stripeCheckoutSessionId }).toEqual({ amount: 2000, status: "paid", stripe: "cs_backfill" })
    expect(after.specialClassId).toBeTruthy()
    expect(after.classSessionId).toBeTruthy()
    expect(await prisma.attendance.count()).toBe(beforeAttendance)
    await expect(prisma.specialClass.findUniqueOrThrow({ where: { slug: SPECIAL_SALSA_CLASS.key } })).resolves.toMatchObject({ priceCents: SPECIAL_SALSA_CLASS.amountCents })
  }, 120_000)

  it("rejects existing class, session, or Purchase bindings that do not match the canonical session", async () => {
    const wrongSession = await prisma.classSession.create({ data: { courseSlug: "wrong-special-salsa", startsAt: new Date("2026-08-30T21:00:00.000Z"), capacity: 40 } })
    await prisma.specialClass.update({ where: { slug: SPECIAL_SALSA_CLASS.key }, data: { classSessionId: wrongSession.id } })
    await expect(backfillSpecialSalsa(prisma, { dryRun: false, now: new Date("2026-08-27T12:00:00.000Z") })).rejects.toThrow("conflict")
    await expect(prisma.specialClass.findUniqueOrThrow({ where: { slug: SPECIAL_SALSA_CLASS.key } })).resolves.toMatchObject({ classSessionId: wrongSession.id })
  }, 120_000)

  it("rejects equal paid and Attendance counts when the attendee identity sets differ", async () => {
    const session = await prisma.classSession.findUniqueOrThrow({ where: { courseSlug_startsAt: { courseSlug: SPECIAL_SALSA_CLASS.courseSlug, startsAt: SPECIAL_SALSA_CLASS.startsAt } } })
    const paidUser = await prisma.user.create({ data: { email: "backfill-paid-mismatch@example.com" } })
    const attendanceUser = await prisma.user.create({ data: { email: "backfill-attendance-mismatch@example.com" } })
    await prisma.purchase.create({ data: { userId: paidUser.id, courseSlug: SPECIAL_SALSA_CLASS.courseSlug, amount: 2000, currency: "usd", status: "paid", participants: 1 } })
    await prisma.attendance.create({ data: { userId: attendanceUser.id, sessionId: session.id, status: "scheduled" } })

    const report = await backfillSpecialSalsa(prisma, { dryRun: true, now: new Date("2026-08-27T12:00:00.000Z") })
    expect(report.paidPurchases).toBe(report.attendanceCount)
    expect(report.conflicts).toContain("paid_attendance_identity")
    await expect(backfillSpecialSalsa(prisma, { dryRun: false, now: new Date("2026-08-27T12:00:00.000Z") })).rejects.toThrow("paid_attendance_identity")
  }, 120_000)
})
