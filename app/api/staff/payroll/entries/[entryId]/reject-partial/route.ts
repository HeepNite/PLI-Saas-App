import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { asOptionalString, jsonError, readJsonBody } from "@/lib/payroll/route-helpers"
import { PAYROLL_ENTRY_STATUSES, AUDIT_ENTRY_TYPES } from "@/lib/payroll/types"

export const runtime = "nodejs"

export async function POST(
  req: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await context.params
  if (!entryId) {
    return jsonError("Missing entryId", 400)
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const reason = asOptionalString(parsedBody.body.reason)

  const baseAuth = await authorizeStaffPortalBaseRequest()
  if (!baseAuth.ok) {
    return NextResponse.json({ error: baseAuth.error }, { status: baseAuth.status })
  }

  try {
    const entry = await prisma.staffPayrollEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        status: true,
        staffAccountId: true,
        staffAccount: {
          select: { clerkUserId: true },
        },
        proposedAmount: true,
        proposedBy: true,
      },
    })

    if (!entry) {
      return jsonError("Entry not found", 404)
    }

    if (entry.status !== PAYROLL_ENTRY_STATUSES.PARTIAL_PROPOSED) {
      return jsonError("Entry is not in partial_proposed status", 422)
    }

    if (entry.staffAccount.clerkUserId !== baseAuth.userId) {
      return jsonError("Only the staff member who owns this entry can reject the partial payment", 403)
    }

    const [updated] = await prisma.$transaction([
      prisma.staffPayrollEntry.update({
        where: { id: entryId },
        data: {
          status: PAYROLL_ENTRY_STATUSES.PENDING,
          proposedAmount: null,
          proposedBy: null,
          rejectionNote: reason ?? null,
        },
      }),
      prisma.staffPayrollAudit.create({
        data: {
          entryId,
          staffAccountId: entry.staffAccountId,
          type: AUDIT_ENTRY_TYPES.PARTIAL_REJECTED,
          actorClerkUserId: baseAuth.userId,
          previousValue: { status: entry.status, proposedAmount: entry.proposedAmount },
          nextValue: { status: PAYROLL_ENTRY_STATUSES.PENDING },
          reason: reason ?? "Partial payment rejected by staff member",
        },
      }),
    ])

    console.log("[NOTIFICATION STUB] Notify owners and admins about partial rejection for entry:", entryId)

    return NextResponse.json(updated)
  } catch (error) {
    console.error("POST /api/staff/payroll/entries/[entryId]/reject-partial failed", error)
    return jsonError("Failed to reject partial payment", 500)
  }
}
