import type { PrismaClient } from "@prisma/client"
import { SPECIAL_SALSA_CLASS } from "@/lib/special-salsa-class/config"

const PAID_STATUSES = ["paid", "succeeded", "completed"]

export async function backfillSpecialSalsa(db: PrismaClient, options: { dryRun: boolean; chunkSize?: number; now?: Date }) {
  const now = options.now ?? new Date()
  const existingSession = await db.classSession.findUnique({ where: { courseSlug_startsAt: { courseSlug: SPECIAL_SALSA_CLASS.courseSlug, startsAt: SPECIAL_SALSA_CLASS.startsAt } } })
  const existingSpecialClass = await db.specialClass.findUnique({ where: { slug: SPECIAL_SALSA_CLASS.key }, include: { classSession: true } })
  const purchases = await db.purchase.findMany({
    where: { courseSlug: SPECIAL_SALSA_CLASS.courseSlug },
    select: { id: true, userId: true, status: true, specialClassId: true, classSessionId: true },
  })
  const attendances = existingSession
    ? await db.attendance.findMany({ where: { sessionId: existingSession.id }, select: { userId: true } })
    : []
  const paidPurchaseRecords = purchases.filter((purchase) => PAID_STATUSES.includes(purchase.status))
  const paidPurchases = paidPurchaseRecords.length
  const attendanceCount = attendances.length
  const capacity = existingSession?.capacity ?? SPECIAL_SALSA_CLASS.capacity
  const conflicts: string[] = []

  if (existingSpecialClass && (
    existingSpecialClass.classSession.courseSlug !== SPECIAL_SALSA_CLASS.courseSlug ||
    existingSpecialClass.classSession.startsAt.getTime() !== SPECIAL_SALSA_CLASS.startsAt.getTime() ||
    (existingSession && existingSpecialClass.classSessionId !== existingSession.id)
  )) conflicts.push("special_class_session_binding")
  for (const purchase of purchases) {
    if (purchase.specialClassId && purchase.specialClassId !== existingSpecialClass?.id) conflicts.push(`purchase_special_class:${purchase.id}`)
    if (purchase.classSessionId && purchase.classSessionId !== existingSession?.id) conflicts.push(`purchase_class_session:${purchase.id}`)
  }
  if (paidPurchases !== attendanceCount) conflicts.push("paid_attendance_count")
  const paidAttendeeIds = paidPurchaseRecords.map((purchase) => purchase.userId).sort()
  const attendanceUserIds = attendances.map((attendance) => attendance.userId).sort()
  if (paidAttendeeIds.length !== attendanceUserIds.length || paidAttendeeIds.some((userId, index) => userId !== attendanceUserIds[index])) {
    conflicts.push("paid_attendance_identity")
  }
  if (Math.max(paidPurchases, attendanceCount) > capacity) conflicts.push("capacity_reconciliation")

  const pending = purchases.filter((purchase) => !purchase.specialClassId || !purchase.classSessionId)
  const report = {
    dryRun: options.dryRun,
    sessionExists: Boolean(existingSession),
    specialClassExists: Boolean(existingSpecialClass),
    purchasesToLink: pending.length,
    paidPurchases,
    attendanceCount,
    capacity,
    conflicts: [...new Set(conflicts)],
  }
  if (options.dryRun) return report
  if (report.conflicts.length > 0) throw new Error(`Special Salsa backfill conflict: ${report.conflicts.join(",")}`)

  const session = existingSession ?? await db.classSession.create({ data: {
    courseSlug: SPECIAL_SALSA_CLASS.courseSlug,
    title: SPECIAL_SALSA_CLASS.title,
    startsAt: SPECIAL_SALSA_CLASS.startsAt,
    durationMinutes: SPECIAL_SALSA_CLASS.durationMinutes,
    capacity: SPECIAL_SALSA_CLASS.capacity,
    location: SPECIAL_SALSA_CLASS.address,
  } })
  const specialClass = existingSpecialClass ?? await db.specialClass.create({ data: {
    slug: SPECIAL_SALSA_CLASS.key,
    status: "published",
    classSessionId: session.id,
    title: SPECIAL_SALSA_CLASS.title,
    description: SPECIAL_SALSA_CLASS.displayTitle,
    currency: SPECIAL_SALSA_CLASS.currency,
    priceCents: SPECIAL_SALSA_CLASS.amountCents,
    publishedAt: now,
    createdBy: "special-class-backfill",
  } })
  if (specialClass.classSessionId !== session.id) throw new Error("Special Salsa backfill conflict: canonical session changed")

  const chunkSize = options.chunkSize ?? 100
  let linkedPurchases = 0
  for (let index = 0; index < pending.length; index += chunkSize) {
    for (const purchase of pending.slice(index, index + chunkSize)) {
      const update = await db.purchase.updateMany({
        where: {
          id: purchase.id,
          AND: [
            { OR: [{ specialClassId: null }, { specialClassId: specialClass.id }] },
            { OR: [{ classSessionId: null }, { classSessionId: session.id }] },
          ],
        },
        data: { specialClassId: specialClass.id, classSessionId: session.id },
      })
      if (update.count !== 1) throw new Error(`Special Salsa backfill conflict: purchase changed:${purchase.id}`)
      linkedPurchases += 1
    }
  }
  return { ...report, sessionId: session.id, specialClassId: specialClass.id, linkedPurchases }
}
