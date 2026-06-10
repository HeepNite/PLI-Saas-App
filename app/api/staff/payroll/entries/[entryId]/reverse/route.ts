import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerRequest } from "@/lib/security/staff-portal-auth"
import {
  asOptionalString,
  hasOwn,
  jsonError,
  readJsonBody,
} from "@/lib/payroll/route-helpers"
import { AUDIT_ENTRY_TYPES, CREDIT_LEDGER_ENTRY_TYPES, PAYROLL_ENTRY_STATUSES } from "@/lib/payroll/types"

export const runtime = "nodejs"

export async function POST(req: Request, context: { params: Promise<{ entryId: string }> }) {
  const authResult = await authorizeOwnerRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { entryId } = await context.params
  if (!entryId) {
    return jsonError("Missing entryId", 400)
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  if (!hasOwn(parsedBody.body, "reason") || !asOptionalString(parsedBody.body.reason)) {
    return jsonError("Reason is required", 422)
  }
  const reason = asOptionalString(parsedBody.body.reason)!

  const entry = await prisma.staffPayrollEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      staffAccountId: true,
      status: true,
      paidAt: true,
      paymentMethodId: true,
      paymentMethod: {
        select: {
          adapterType: true,
        },
      },
    },
  })

  if (!entry) {
    return jsonError("Entry not found", 404)
  }

  if (entry.status !== PAYROLL_ENTRY_STATUSES.PAID) {
    if (entry.status === PAYROLL_ENTRY_STATUSES.REVERSED) {
      return jsonError("Entry is already reversed", 422)
    }
    return jsonError("Entry must be paid to reverse", 422)
  }

  const [, , updatedEntry] = await prisma.$transaction([
    prisma.staffPayrollEntry.update({
      where: { id: entryId },
      data: {
        status: PAYROLL_ENTRY_STATUSES.REVERSED,
        reversedAt: new Date(),
        reversedBy: authResult.userId,
        reversalReason: reason,
      },
    }),
    prisma.staffPayrollAudit.create({
      data: {
        entryId,
        staffAccountId: entry.staffAccountId,
        type: AUDIT_ENTRY_TYPES.REVERSAL,
        actorClerkUserId: authResult.userId,
        reason,
      },
    }),
    entry.paymentMethod?.adapterType === "credits"
      ? prisma.staffCreditLedgerEntry.create({
          data: {
            staffAccountId: entry.staffAccountId,
            type: CREDIT_LEDGER_ENTRY_TYPES.REVERSAL,
            amount: 0,
            note: `Reversal of payroll entry ${entryId}`,
            eventKey: `payroll-reversal-${entryId}`,
            awardedBy: authResult.userId,
          },
        })
      : prisma.$executeRaw`SELECT 1`,
  ])

  return NextResponse.json(updatedEntry)
}
