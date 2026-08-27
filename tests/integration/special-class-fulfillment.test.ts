import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { PrismaClient } from "@prisma/client"
import {
  admitSpecialClassAuthorization,
  finalizeSpecialClassCapture,
  finalizeSpecialClassNoCapacityCancellation,
  finalizeSpecialClassPaymentFailure,
} from "@/lib/special-classes/fulfillment"
import { setupIntegrationDb } from "./db-test-utils"
import { findSelectableClassSessions } from "@/app/api/staff/students/sessions/selectable-sessions"

let prisma: PrismaClient
let cleanup: (() => Promise<void>) | null = null

describe("special class webhook fulfillment", () => {
  beforeAll(async () => { const context = await setupIntegrationDb(); prisma = context.prisma; cleanup = context.cleanup }, 120_000)
  afterAll(async () => { if (cleanup) await cleanup() }, 120_000)

  it("re-admits an expired hold, validates locked Purchase money after a class price edit, and finalizes capture idempotently", async () => {
    const user = await prisma.user.create({ data: { email: "fulfillment@example.com" } })
    const now = new Date()
    const session = await prisma.classSession.create({ data: { courseSlug: "special-fulfillment", startsAt: new Date(now.getTime() + 60_000), capacity: 10 } })
    const specialClass = await prisma.specialClass.create({ data: { slug: "special-fulfillment", status: "published", classSessionId: session.id, title: "Fulfillment", description: "Test", currency: "usd", priceCents: 3000, createdBy: "test" } })
    const purchase = await prisma.purchase.create({ data: { userId: user.id, courseSlug: session.courseSlug, amount: 2500, currency: "usd", status: "expired", participants: 1, specialClassId: specialClass.id, classSessionId: session.id, holdExpiresAt: new Date(now.getTime() - 1) } })
    const input = { purchaseId: purchase.id, amount: 2500, currency: "usd", eventId: "evt_replay", source: "stripe_webhook_checkout", now }
    await expect(admitSpecialClassAuthorization(prisma, input)).resolves.toMatchObject({ kind: "capture", purchaseId: purchase.id })
    await finalizeSpecialClassCapture(prisma, { purchaseId: purchase.id, eventId: "evt_replay" })
    await finalizeSpecialClassCapture(prisma, { purchaseId: purchase.id, eventId: "evt_replay" })
    expect(await prisma.attendance.count({ where: { userId: user.id, sessionId: session.id } })).toBe(1)
    expect(await prisma.specialClassAuditLog.count({ where: { specialClassId: specialClass.id } })).toBe(2)
    await expect(prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).resolves.toMatchObject({ status: "paid", amount: 2500, currency: "usd" })
    const attendance = await prisma.attendance.findUniqueOrThrow({ where: { userId_sessionId: { userId: user.id, sessionId: session.id } } })
    expect(attendance.sessionId).toBe(specialClass.classSessionId)
    const kioskSessions = await findSelectableClassSessions(prisma, now)
    expect(kioskSessions.some((candidate) => candidate.id === session.id)).toBe(true)
    const checkedIn = await prisma.attendance.update({ where: { id: attendance.id }, data: { status: "checked_in", checkedInAt: now } })
    expect(checkedIn.sessionId).toBe(specialClass.classSessionId)
  }, 120_000)

  it("cancels admission without Attendance when a delayed authorization finds full capacity", async () => {
    const user = await prisma.user.create({ data: { email: "invalid-fulfillment@example.com" } })
    const session = await prisma.classSession.create({ data: { courseSlug: "invalid-fulfillment", startsAt: new Date(Date.now() + 60_000), capacity: 1 } })
    const specialClass = await prisma.specialClass.create({ data: { slug: "invalid-fulfillment", status: "published", classSessionId: session.id, title: "Invalid fulfillment", description: "Test", currency: "usd", priceCents: 2500, createdBy: "test" } })
    const admittedUser = await prisma.user.create({ data: { email: "already-admitted@example.com" } })
    await prisma.purchase.create({ data: { userId: admittedUser.id, courseSlug: session.courseSlug, amount: 2500, currency: "usd", status: "paid", participants: 1, specialClassId: specialClass.id, classSessionId: session.id } })
    const purchase = await prisma.purchase.create({ data: { userId: user.id, courseSlug: session.courseSlug, amount: 2500, currency: "usd", status: "expired", participants: 1, specialClassId: specialClass.id, classSessionId: session.id, holdExpiresAt: new Date(Date.now() - 1) } })
    await expect(admitSpecialClassAuthorization(prisma, { purchaseId: purchase.id, amount: 2500, currency: "usd", eventId: "evt_failed", source: "stripe_webhook_checkout", now: new Date() })).resolves.toMatchObject({ kind: "cancel", purchaseId: purchase.id })
    expect(await prisma.attendance.count({ where: { userId: user.id, sessionId: session.id } })).toBe(0)
    await finalizeSpecialClassNoCapacityCancellation(prisma, { purchaseId: purchase.id, eventId: "evt_failed" })
    await expect(prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).resolves.toMatchObject({ status: "no_capacity" })
    expect(await prisma.specialClassAuditLog.count({ where: { specialClassId: specialClass.id } })).toBe(2)
  }, 120_000)

  it("rejects Stripe money that differs from the immutable Purchase", async () => {
    const user = await prisma.user.create({ data: { email: "money-mismatch@example.com" } })
    const session = await prisma.classSession.create({ data: { courseSlug: "money-mismatch", startsAt: new Date(Date.now() + 60_000), capacity: 2 } })
    const specialClass = await prisma.specialClass.create({ data: { slug: "money-mismatch", status: "published", classSessionId: session.id, title: "Money mismatch", description: "Test", currency: "usd", priceCents: 3000, createdBy: "test" } })
    const purchase = await prisma.purchase.create({ data: { userId: user.id, courseSlug: session.courseSlug, amount: 2500, currency: "usd", status: "pending", participants: 1, specialClassId: specialClass.id, classSessionId: session.id, holdExpiresAt: new Date(Date.now() + 60_000) } })
    await expect(admitSpecialClassAuthorization(prisma, { purchaseId: purchase.id, amount: 3000, currency: "usd", eventId: "evt_money", source: "stripe_webhook_checkout", now: new Date() })).rejects.toThrow("payment contract mismatch")
    expect(await prisma.attendance.count({ where: { userId: user.id, sessionId: session.id } })).toBe(0)
  }, 120_000)

  it("audits the prior Attendance state before reusing it for authorization admission", async () => {
    const user = await prisma.user.create({ data: { email: "attendance-reuse-audit@example.com" } })
    const now = new Date()
    const session = await prisma.classSession.create({ data: { courseSlug: "attendance-reuse-audit", startsAt: new Date(now.getTime() + 60_000), capacity: 2 } })
    const specialClass = await prisma.specialClass.create({ data: { slug: "attendance-reuse-audit", status: "published", classSessionId: session.id, title: "Attendance audit", description: "Test", currency: "usd", priceCents: 2500, createdBy: "test" } })
    const purchase = await prisma.purchase.create({ data: { userId: user.id, courseSlug: session.courseSlug, amount: 2500, currency: "usd", status: "pending", participants: 1, specialClassId: specialClass.id, classSessionId: session.id, holdExpiresAt: new Date(now.getTime() + 60_000) } })
    const priorCheckedInAt = new Date(now.getTime() - 120_000)
    const priorCheckedOutAt = new Date(now.getTime() - 60_000)
    const attendance = await prisma.attendance.create({ data: { userId: user.id, sessionId: session.id, status: "cancelled", checkedInAt: priorCheckedInAt, checkedOutAt: priorCheckedOutAt, metadata: { source: "legacy" } } })

    await admitSpecialClassAuthorization(prisma, { purchaseId: purchase.id, amount: 2500, currency: "usd", eventId: "evt_attendance_reuse", source: "stripe_webhook_intent", now })
    const audit = await prisma.specialClassAuditLog.findFirstOrThrow({ where: { specialClassId: specialClass.id, action: "authorization_admitted" } })
    expect(audit.beforeState).toMatchObject({ attendance: { id: attendance.id, status: "cancelled", checkedInAt: priorCheckedInAt.toISOString(), checkedOutAt: priorCheckedOutAt.toISOString(), metadata: { source: "legacy" } } })
    expect(audit.afterState).toMatchObject({ attendance: { id: attendance.id, status: "scheduled", checkedInAt: session.startsAt.toISOString(), checkedOutAt: null } })
  }, 120_000)

  it("releases an admitted Attendance when capture reaches a terminal payment failure", async () => {
    const user = await prisma.user.create({ data: { email: "capture-failure@example.com" } })
    const now = new Date()
    const session = await prisma.classSession.create({ data: { courseSlug: "capture-failure", startsAt: new Date(now.getTime() + 60_000), capacity: 2 } })
    const specialClass = await prisma.specialClass.create({ data: { slug: "capture-failure", status: "published", classSessionId: session.id, title: "Capture failure", description: "Test", currency: "usd", priceCents: 2500, createdBy: "test" } })
    const purchase = await prisma.purchase.create({ data: { userId: user.id, courseSlug: session.courseSlug, amount: 2500, currency: "usd", status: "pending", participants: 1, specialClassId: specialClass.id, classSessionId: session.id, holdExpiresAt: new Date(now.getTime() + 60_000) } })
    await admitSpecialClassAuthorization(prisma, { purchaseId: purchase.id, amount: 2500, currency: "usd", eventId: "evt_capture_admission", source: "stripe_webhook_intent", now })
    await finalizeSpecialClassPaymentFailure(prisma, { purchaseId: purchase.id, eventId: "evt_capture_failed", metadata: { failureCode: "card_declined" } })
    await expect(prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } })).resolves.toMatchObject({ status: "failed" })
    await expect(prisma.attendance.findUniqueOrThrow({ where: { userId_sessionId: { userId: user.id, sessionId: session.id } } })).resolves.toMatchObject({ status: "cancelled" })
  }, 120_000)

  it("excludes cancelled special classes from normal kiosk session selection", async () => {
    const now = new Date()
    const session = await prisma.classSession.create({ data: { courseSlug: "cancelled-kiosk", startsAt: new Date(now.getTime() + 60_000), capacity: 10 } })
    await prisma.specialClass.create({ data: { slug: "cancelled-kiosk", status: "cancelled", classSessionId: session.id, title: "Cancelled kiosk", description: "Test", currency: "usd", priceCents: 2500, createdBy: "test", cancelledAt: now } })
    const kioskSessions = await findSelectableClassSessions(prisma, now)
    expect(kioskSessions.some((candidate) => candidate.id === session.id)).toBe(false)
  }, 120_000)
})
