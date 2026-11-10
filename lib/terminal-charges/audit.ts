import "server-only"
import type { Prisma } from "@prisma/client"
import { writeStudentDataAudit, type WriteStudentDataAuditParams } from "@/lib/audit/student-data-audit"

type ChargeAuditEntry = Pick<WriteStudentDataAuditParams, "staffClerkId" | "staffName" | "field" | "valueBefore" | "valueAfter" | "reason" | "ipAddress">

/** One payment audit row for a terminal charge, written in the charge's transaction. */
export const auditCharge = (tx: Prisma.TransactionClient, charge: { id: string; payerUserId: string }, entry: ChargeAuditEntry) =>
  writeStudentDataAudit({ targetUserId: charge.payerUserId, entity: "payment", entityId: charge.id, ...entry }, tx)
