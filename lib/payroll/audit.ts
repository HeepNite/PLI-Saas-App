import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { AuditEntryType } from "@/lib/payroll/types"

export type PrismaTransaction = Prisma.TransactionClient | typeof prisma

type PayrollAuditCreateClient = PrismaTransaction & {
  staffPayrollAudit: {
    create(args: {
      data: {
        entryId?: string | null
        staffAccountId?: string | null
        type: AuditEntryType
        actorClerkUserId?: string | null
        previousValue?: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull
        nextValue?: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull
        reason?: string | null
        metadata?: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull
      }
    }): Promise<unknown>
  }
}

export type WriteAuditParams = {
  entryId?: string | null
  staffAccountId?: string | null
  type: AuditEntryType
  actorClerkUserId?: string | null
  previousValue?: Prisma.InputJsonValue | null
  nextValue?: Prisma.InputJsonValue | null
  reason?: string | null
  metadata?: Prisma.InputJsonValue | null
}

export async function writePayrollAudit(params: WriteAuditParams, tx?: PrismaTransaction): Promise<void> {
  const db = (tx ?? prisma) as PayrollAuditCreateClient

  await db.staffPayrollAudit.create({
    data: {
      entryId: params.entryId ?? null,
      staffAccountId: params.staffAccountId ?? null,
      type: params.type,
      actorClerkUserId: params.actorClerkUserId ?? null,
      previousValue: params.previousValue === undefined ? undefined : params.previousValue ?? Prisma.JsonNull,
      nextValue: params.nextValue === undefined ? undefined : params.nextValue ?? Prisma.JsonNull,
      reason: params.reason ?? null,
      metadata: params.metadata === undefined ? undefined : params.metadata ?? Prisma.JsonNull,
    },
  })
}
