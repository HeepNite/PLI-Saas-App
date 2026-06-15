import { Prisma, PrismaClient } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type PrismaTransaction = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

/**
 * Parameters for creating a StudentDataAudit entry.
 *
 * Every manual data override by staff MUST produce an audit record with:
 * - targetUserId: the student whose data was modified
 * - staffClerkId: the Clerk user ID of the staff member making the change
 * - entity: which domain was affected (attendance, payment, package, stats, profile)
 * - field: the specific field that changed
 * - reason: human-readable explanation (required for audit compliance)
 */
export type WriteStudentDataAuditParams = {
  targetUserId: string
  staffClerkId: string
  staffName?: string | null
  entity: "attendance" | "payment" | "package" | "stats" | "profile"
  entityId?: string | null
  field: string
  valueBefore?: Prisma.InputJsonValue | null
  valueAfter?: Prisma.InputJsonValue | null
  reason: string
  ipAddress?: string | null
}

/**
 * Write an immutable audit log entry for a manual student data override.
 *
 * This function follows the same pattern as `writePayrollAudit` — it accepts
 * an optional Prisma transaction client so the audit write can be part of the
 * same atomic operation as the entity update.
 *
 * @param params - Audit entry fields (reason is required)
 * @param tx - Optional Prisma transaction client; defaults to global prisma instance
 *
 * @example
 * // Inside a transaction with an attendance update:
 * await prisma.$transaction(async (tx) => {
 *   await tx.attendance.update({ where: { id }, data: { status: "no_show" } })
 *   await writeStudentDataAudit({
 *     targetUserId: userId,
 *     staffClerkId: clerkId,
 *     entity: "attendance",
 *     entityId: attendanceId,
 *     field: "status",
 *     valueBefore: "checked_in",
 *     valueAfter: "no_show",
 *     reason: "Student left early",
 *   }, tx)
 * })
 */
export async function writeStudentDataAudit(
  params: WriteStudentDataAuditParams,
  tx?: PrismaTransaction
): Promise<void> {
  const db = tx ?? prisma

  await db.studentDataAudit.create({
    data: {
      targetUserId: params.targetUserId,
      staffClerkId: params.staffClerkId,
      staffName: params.staffName ?? null,
      entity: params.entity,
      entityId: params.entityId ?? null,
      field: params.field,
      valueBefore:
        params.valueBefore === undefined
          ? Prisma.JsonNull
          : params.valueBefore ?? Prisma.JsonNull,
      valueAfter:
        params.valueAfter === undefined
          ? Prisma.JsonNull
          : params.valueAfter ?? Prisma.JsonNull,
      reason: params.reason,
      ipAddress: params.ipAddress ?? null,
    },
  })
}
