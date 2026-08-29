import { Prisma, type PrismaClient } from "@prisma/client"
import { ATTENDANCE_STATUS } from "@/lib/attendance-constants"
import { lockSpecialClassBoundary, runSpecialClassSerializableTransaction } from "@/lib/special-classes/management"
import { CAPACITY_STATUSES } from "@/lib/special-classes/policy"

const MAX_SERIALIZABLE_ATTEMPTS = 3

type AuthorizationInput = {
  purchaseId: string
  amount: number
  currency: string
  eventId: string
  source: string
  now?: Date
}

export type SpecialClassAuthorizationOutcome =
  | { kind: "capture"; purchaseId: string; paymentIntentId: string | null }
  | { kind: "cancel"; purchaseId: string; paymentIntentId: string | null }
  | { kind: "captured"; purchaseId: string; paymentIntentId: string | null }

const isRetryableConflict = (error: unknown) => {
  if (!error || typeof error !== "object") return false
  const code = Object.hasOwn(error, "code") ? String((error as { code: unknown }).code) : ""
  const meta = Object.hasOwn(error, "meta") ? (error as { meta?: unknown }).meta : null
  const databaseCode = meta && typeof meta === "object" && Object.hasOwn(meta, "code")
    ? String((meta as { code: unknown }).code)
    : ""
  return ["P2002", "P2034"].includes(code) || (code === "P2010" && databaseCode === "40001")
}

const audit = (tx: Prisma.TransactionClient, data: {
  specialClassId: string
  classSessionId: string
  purchaseId: string
  attendanceId?: string
  action: string
  beforeState: Prisma.InputJsonValue
  afterState: Prisma.InputJsonValue
  eventId: string
}) => tx.specialClassAuditLog.upsert({
  where: { specialClassId_idempotencyKey: { specialClassId: data.specialClassId, idempotencyKey: `${data.eventId}:${data.action}` } },
  update: {},
  create: {
    specialClassId: data.specialClassId,
    classSessionId: data.classSessionId,
    purchaseId: data.purchaseId,
    attendanceId: data.attendanceId,
    action: data.action,
    actorClerkUserId: "stripe-webhook",
    actorRole: "system",
    beforeState: data.beforeState,
    afterState: data.afterState,
    correlationId: crypto.randomUUID(),
    idempotencyKey: `${data.eventId}:${data.action}`,
  },
})

const attendanceSnapshot = (attendance: {
  id: string
  status: string
  checkedInAt: Date
  checkedOutAt: Date | null
  metadata: Prisma.JsonValue | null
} | null) => attendance ? {
  id: attendance.id,
  status: attendance.status,
  checkedInAt: attendance.checkedInAt.toISOString(),
  checkedOutAt: attendance.checkedOutAt?.toISOString() ?? null,
  metadata: attendance.metadata,
} : null

export async function admitSpecialClassAuthorization(
  db: PrismaClient,
  input: AuthorizationInput,
): Promise<SpecialClassAuthorizationOutcome> {
  const now = input.now ?? new Date()
  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const initial = await tx.purchase.findUnique({ where: { id: input.purchaseId } })
        if (!initial?.specialClassId || !initial.classSessionId || initial.participants !== 1) {
          throw new Error("Special class purchase linkage missing")
        }
        const specialClass = await lockSpecialClassBoundary(tx, initial.specialClassId)
        if (specialClass.classSessionId !== initial.classSessionId) throw new Error("Special class canonical session mismatch")
        const attendanceKey = { userId: initial.userId, sessionId: initial.classSessionId }
        const initialAttendance = await tx.attendance.findUnique({ where: { userId_sessionId: attendanceKey } })
        if (initialAttendance) {
          await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Attendance" WHERE "id" = ${initialAttendance.id} FOR UPDATE`)
        }
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Purchase" WHERE "id" = ${input.purchaseId} FOR UPDATE`)
        const purchase = await tx.purchase.findUnique({ where: { id: input.purchaseId } })
        if (!purchase?.specialClassId || !purchase.classSessionId || purchase.participants !== 1) {
          throw new Error("Special class purchase linkage missing")
        }
        if (purchase.amount !== input.amount || purchase.currency.toLowerCase() !== input.currency.toLowerCase()) {
          throw new Error("Special class payment contract mismatch")
        }
        if (specialClass.id !== purchase.specialClassId || specialClass.classSessionId !== purchase.classSessionId) {
          throw new Error("Special class canonical session mismatch")
        }
        const priorAttendance = initialAttendance
          ? await tx.attendance.findUnique({ where: { id: initialAttendance.id } })
          : null
        const terminal = { purchaseId: purchase.id, paymentIntentId: purchase.stripePaymentIntentId }
        if (["paid", "succeeded", "completed"].includes(purchase.status)) return { kind: "captured" as const, ...terminal }
        if (purchase.status === "capture_pending") return { kind: "capture" as const, ...terminal }
        if (["no_capacity", "no_capacity_pending_cancel"].includes(purchase.status)) return { kind: "cancel" as const, ...terminal }
        if (!["pending", "expired"].includes(purchase.status)) throw new Error("Special class authorization is not fulfillable")

        await tx.purchase.updateMany({
          where: { specialClassId: specialClass.id, status: "pending", holdExpiresAt: { lte: now }, id: { not: purchase.id } },
          data: { status: "expired" },
        })
        const occupiedByOthers = await tx.purchase.count({
          where: {
            specialClassId: specialClass.id,
            id: { not: purchase.id },
            OR: [{ status: { in: CAPACITY_STATUSES } }, { status: "pending", holdExpiresAt: { gt: now } }],
          },
        })
        const canAdmit = specialClass.status === "published" && occupiedByOthers < specialClass.classSession.capacity
        if (!canAdmit) {
          await tx.purchase.update({ where: { id: purchase.id }, data: { status: "no_capacity_pending_cancel" } })
          await audit(tx, {
            specialClassId: specialClass.id,
            classSessionId: specialClass.classSessionId,
            purchaseId: purchase.id,
            action: "authorization_capacity_rejected",
            beforeState: { purchaseStatus: purchase.status },
            afterState: { purchaseStatus: "no_capacity_pending_cancel", attendanceCreated: false },
            eventId: input.eventId,
          })
          return { kind: "cancel" as const, ...terminal }
        }

        const attendance = await tx.attendance.upsert({
          where: { userId_sessionId: { userId: purchase.userId, sessionId: specialClass.classSessionId } },
          update: {
            status: ATTENDANCE_STATUS.SCHEDULED,
            checkedInAt: specialClass.classSession.startsAt,
            checkedOutAt: null,
            metadata: { source: input.source, purchaseId: purchase.id, specialClassId: specialClass.id },
          },
          create: {
            userId: purchase.userId,
            sessionId: specialClass.classSessionId,
            status: ATTENDANCE_STATUS.SCHEDULED,
            checkedInAt: specialClass.classSession.startsAt,
            metadata: { source: input.source, purchaseId: purchase.id, specialClassId: specialClass.id },
          },
        })
        await tx.purchase.update({ where: { id: purchase.id }, data: { status: "capture_pending" } })
        await audit(tx, {
          specialClassId: specialClass.id,
          classSessionId: specialClass.classSessionId,
          purchaseId: purchase.id,
          attendanceId: attendance.id,
          action: "authorization_admitted",
          beforeState: { purchaseStatus: purchase.status, attendance: attendanceSnapshot(priorAttendance) },
          afterState: { purchaseStatus: "capture_pending", attendance: attendanceSnapshot(attendance) },
          eventId: input.eventId,
        })
        return { kind: "capture" as const, ...terminal }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (!isRetryableConflict(error) || attempt === MAX_SERIALIZABLE_ATTEMPTS) throw error
    }
  }
  throw new Error("Unable to admit special class authorization")
}

export async function finalizeSpecialClassCapture(db: PrismaClient, input: { purchaseId: string; eventId: string }) {
  const initial = await db.purchase.findUnique({ where: { id: input.purchaseId } })
  if (!initial?.specialClassId || !initial.classSessionId) throw new Error("Special class purchase linkage missing")
  const specialClassId = initial.specialClassId
  const classSessionId = initial.classSessionId
  return runSpecialClassSerializableTransaction(db, async (tx) => {
    const specialClass = await lockSpecialClassBoundary(tx, specialClassId)
    if (specialClass.classSessionId !== classSessionId) throw new Error("Special class canonical session mismatch")
    const initialAttendance = await tx.attendance.findUnique({ where: { userId_sessionId: { userId: initial.userId, sessionId: classSessionId } } })
    if (initialAttendance) {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Attendance" WHERE "id" = ${initialAttendance.id} FOR UPDATE`)
    }
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Purchase" WHERE "id" = ${input.purchaseId} FOR UPDATE`)
    const purchase = await tx.purchase.findUnique({ where: { id: input.purchaseId } })
    if (!purchase?.specialClassId || !purchase.classSessionId) throw new Error("Special class purchase linkage missing")
    if (purchase.specialClassId !== specialClass.id || purchase.classSessionId !== specialClass.classSessionId) throw new Error("Special class canonical session mismatch")
    if (["paid", "succeeded", "completed"].includes(purchase.status)) return purchase
    if (purchase.status !== "capture_pending") throw new Error("Special class purchase is not awaiting capture")
    const updated = await tx.purchase.update({ where: { id: purchase.id }, data: { status: "paid" } })
    await audit(tx, {
      specialClassId: purchase.specialClassId,
      classSessionId: purchase.classSessionId,
      purchaseId: purchase.id,
      action: "payment_captured",
      beforeState: { purchaseStatus: purchase.status },
      afterState: { purchaseStatus: "paid" },
      eventId: input.eventId,
    })
    return updated
  })
}

export const finalizeSpecialClassNoCapacityCancellation = (db: PrismaClient, input: { purchaseId: string; eventId: string }) =>
  db.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { id: input.purchaseId } })
    if (!purchase?.specialClassId || !purchase.classSessionId) throw new Error("Special class purchase linkage missing")
    if (purchase.status === "no_capacity") return purchase
    if (purchase.status !== "no_capacity_pending_cancel") throw new Error("Special class purchase is not awaiting authorization cancellation")
    const updated = await tx.purchase.update({ where: { id: purchase.id }, data: { status: "no_capacity" } })
    await audit(tx, {
      specialClassId: purchase.specialClassId,
      classSessionId: purchase.classSessionId,
      purchaseId: purchase.id,
      action: "authorization_cancelled_no_capacity",
      beforeState: { purchaseStatus: purchase.status },
      afterState: { purchaseStatus: "no_capacity", attendanceCreated: false },
      eventId: input.eventId,
    })
    return updated
  })

export const finalizeSpecialClassPaymentFailure = (db: PrismaClient, input: {
  purchaseId: string
  eventId: string
  metadata: Prisma.InputJsonValue
}) => runSpecialClassSerializableTransaction(db, async (tx) => {
  const initial = await tx.purchase.findUnique({ where: { id: input.purchaseId } })
  if (!initial?.specialClassId || !initial.classSessionId) throw new Error("Special class purchase linkage missing")
  const specialClass = await lockSpecialClassBoundary(tx, initial.specialClassId)
  if (specialClass.classSessionId !== initial.classSessionId) throw new Error("Special class canonical session mismatch")
  const initialAttendance = await tx.attendance.findUnique({ where: { userId_sessionId: { userId: initial.userId, sessionId: initial.classSessionId } } })
  if (initialAttendance) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Attendance" WHERE "id" = ${initialAttendance.id} FOR UPDATE`)
  }
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Purchase" WHERE "id" = ${input.purchaseId} FOR UPDATE`)
  const purchase = await tx.purchase.findUnique({ where: { id: input.purchaseId } })
  if (!purchase?.specialClassId || !purchase.classSessionId) throw new Error("Special class purchase linkage missing")
  if (["paid", "succeeded", "completed", "no_capacity"].includes(purchase.status)) return purchase
  const attendance = initialAttendance ? await tx.attendance.findUnique({ where: { id: initialAttendance.id } }) : null
  const attendanceMetadata = attendance?.metadata
  const attendanceBelongsToPurchase = Boolean(
    attendance && attendanceMetadata && typeof attendanceMetadata === "object" && !Array.isArray(attendanceMetadata) &&
    Object.hasOwn(attendanceMetadata, "purchaseId") && (attendanceMetadata as Record<string, unknown>).purchaseId === purchase.id,
  )
  const updated = await tx.purchase.update({ where: { id: purchase.id }, data: { status: "failed", metadata: input.metadata } })
  if (attendanceBelongsToPurchase && attendance) {
    await tx.attendance.update({ where: { id: attendance.id }, data: { status: "cancelled" } })
  }
  await audit(tx, {
    specialClassId: purchase.specialClassId,
    classSessionId: purchase.classSessionId,
    purchaseId: purchase.id,
    attendanceId: attendanceBelongsToPurchase ? attendance?.id : undefined,
    action: "payment_failed",
    beforeState: { purchaseStatus: purchase.status, attendanceStatus: attendanceBelongsToPurchase ? attendance?.status : null },
    afterState: { purchaseStatus: "failed", attendanceStatus: attendanceBelongsToPurchase ? "cancelled" : null },
    eventId: input.eventId,
  })
  return updated
})
