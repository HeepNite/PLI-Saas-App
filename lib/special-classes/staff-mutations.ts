import { Prisma, type PrismaClient } from "@prisma/client"
import { lockSpecialClassBoundary, runSpecialClassSerializableTransaction } from "@/lib/special-classes/management"

type RosterAction = "check_in" | "undo_check_in" | "cancel"

type RosterActionInput = {
  specialClassId: string
  attendanceId: string
  action: RosterAction
  reason: string
  idempotencyKey: string
  actorClerkUserId: string
  actorRole: string
}

type RosterActionOptions = { afterStateLocked?: () => Promise<void> }

const ACTIVE_CANCELLATION_STATUSES = ["paid", "succeeded", "completed", "capture_pending"]

export async function applySpecialClassRosterAction(
  db: PrismaClient,
  input: RosterActionInput,
  options: RosterActionOptions = {},
) {
  return runSpecialClassSerializableTransaction(db, async (tx) => {
    const specialClass = await lockSpecialClassBoundary(tx, input.specialClassId)
    const duplicate = await tx.specialClassAuditLog.findUnique({
      where: { specialClassId_idempotencyKey: { specialClassId: input.specialClassId, idempotencyKey: input.idempotencyKey } },
    })
    if (duplicate) {
      if (duplicate.attendanceId !== input.attendanceId || duplicate.action !== input.action) throw new Error("IDEMPOTENCY_KEY_REUSED")
      return { kind: "replayed" as const }
    }

    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Attendance" WHERE "id" = ${input.attendanceId} FOR UPDATE`)
    const attendance = await tx.attendance.findUnique({ where: { id: input.attendanceId } })
    if (!attendance || attendance.sessionId !== specialClass.classSessionId) return { kind: "not_found" as const }
    if (input.action === "check_in" && specialClass.status === "cancelled") return { kind: "class_cancelled" as const }

    if (input.action === "cancel") {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "Purchase"
        WHERE "specialClassId" = ${input.specialClassId}
          AND "userId" = ${attendance.userId}
          AND "status" IN ('paid', 'succeeded', 'completed', 'capture_pending')
        ORDER BY "id" FOR UPDATE
      `)
    }
    const purchases = input.action === "cancel" ? await tx.purchase.findMany({
      where: { specialClassId: input.specialClassId, userId: attendance.userId, status: { in: ACTIVE_CANCELLATION_STATUSES } },
      select: { id: true, status: true },
      orderBy: { id: "asc" },
    }) : []
    await options.afterStateLocked?.()
    if (purchases.some((purchase) => purchase.status === "capture_pending")) {
      return { kind: "capture_in_progress" as const, retryable: true as const }
    }

    const nextStatus = input.action === "check_in" ? "checked_in" : input.action === "undo_check_in" ? "scheduled" : "cancelled"
    const checkedInAt = input.action === "check_in" ? new Date() : attendance.checkedInAt
    await tx.attendance.update({ where: { id: attendance.id }, data: { status: nextStatus, checkedInAt } })
    if (purchases.length > 0) {
      await tx.purchase.updateMany({ where: { id: { in: purchases.map((purchase) => purchase.id) } }, data: { status: "cancelled" } })
    }
    await tx.specialClassAuditLog.create({ data: {
      specialClassId: input.specialClassId,
      classSessionId: specialClass.classSessionId,
      attendanceId: attendance.id,
      action: input.action,
      actorClerkUserId: input.actorClerkUserId,
      actorRole: input.actorRole,
      beforeState: {
        attendance: { id: attendance.id, status: attendance.status, checkedInAt: attendance.checkedInAt.toISOString() },
        purchases,
      },
      afterState: {
        attendance: { id: attendance.id, status: nextStatus, checkedInAt: checkedInAt.toISOString() },
        purchases: purchases.map((purchase) => ({ id: purchase.id, status: "cancelled" })),
      },
      reason: input.reason || null,
      correlationId: crypto.randomUUID(),
      idempotencyKey: input.idempotencyKey,
    } })
    return { kind: "applied" as const, attendance: { id: attendance.id, status: nextStatus } }
  })
}
