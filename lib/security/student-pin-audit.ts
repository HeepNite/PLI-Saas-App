import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type StudentPinAuditDbClient = Prisma.TransactionClient | typeof prisma

export const STUDENT_PIN_AUDIT_ACTIONS = {
  ENROLLED: "enrolled",
  RESET: "reset",
  RECOVERY_RESET: "recovery_reset",
  ROTATED: "rotated",
  UNLOCKED: "unlocked",
  ISSUE_PROVISIONAL: "issue_provisional",
  KIOSK_IDENTIFIED: "kiosk_identified",
  EXPIRED: "expired",
  OBSOLETE: "obsolete",
  STAFF_DENIED: "staff_denied",
} as const

export type StudentPinAuditAction = (typeof STUDENT_PIN_AUDIT_ACTIONS)[keyof typeof STUDENT_PIN_AUDIT_ACTIONS]

export const writeStudentPinAudit = async (input: {
  userId: string
  action: StudentPinAuditAction | string
  result: "allowed" | "denied" | "success" | "error"
  actorType: "student" | "staff" | "system"
  actorUserId?: string | null
  actorClerkId?: string | null
  actorRole?: string | null
  credentialKind?: string | null
  terminalId?: string | null
  reason?: string | null
  metadata?: Record<string, unknown> | null
  db?: StudentPinAuditDbClient
}) =>
  (input.db || prisma).studentPinAudit.create({
    data: {
      userId: input.userId,
      action: input.action,
      result: input.result,
      actorType: input.actorType,
      actorUserId: input.actorUserId || null,
      actorClerkId: input.actorClerkId || null,
      actorRole: input.actorRole || null,
      credentialKind: input.credentialKind || null,
      terminalId: input.terminalId || null,
      reason: input.reason || null,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) || undefined,
    },
  })
