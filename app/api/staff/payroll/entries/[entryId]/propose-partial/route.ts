import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { asOptionalNumber, asOptionalString, jsonError, readJsonBody } from "@/lib/payroll/route-helpers"
import { PAYROLL_ENTRY_STATUSES, AUDIT_ENTRY_TYPES } from "@/lib/payroll/types"

export const runtime = "nodejs"

export async function POST(
  req: Request,
  context: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await context.params

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const { proposedAmount, note } = parsedBody.body as {
    proposedAmount?: unknown
    note?: unknown
  }

  if (proposedAmount === undefined) {
    return jsonError("proposedAmount is required", 422)
  }

  const parsedAmount = asOptionalNumber(proposedAmount)
  if (parsedAmount === null || parsedAmount <= 0) {
    return jsonError("proposedAmount must be greater than 0", 422, { field: "proposedAmount" })
  }

  const parsedNote = asOptionalString(note)

  try {
    const entry = await prisma.staffPayrollEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        staffAccountId: true,
      },
    })

    if (!entry) {
      return jsonError("Entry not found", 404)
    }

    if (entry.status === PAYROLL_ENTRY_STATUSES.PARTIAL_PROPOSED) {
      return jsonError("Entry already has a partial payment proposed", 409)
    }

    if (entry.status !== PAYROLL_ENTRY_STATUSES.PENDING) {
      return jsonError("Entry must have status 'pending' to propose partial payment", 422)
    }

    if (parsedAmount >= entry.totalAmount) {
      return jsonError(
        "proposedAmount must be less than totalAmount",
        422,
        { field: "proposedAmount" }
      )
    }

    const [updated] = await prisma.$transaction([
      prisma.staffPayrollEntry.update({
        where: { id: entryId },
        data: {
          status: PAYROLL_ENTRY_STATUSES.PARTIAL_PROPOSED,
          proposedAmount: parsedAmount,
          proposedBy: authResult.userId,
          notes: parsedNote,
        },
      }),
      prisma.staffPayrollAudit.create({
        data: {
          entryId,
          staffAccountId: entry.staffAccountId,
          type: AUDIT_ENTRY_TYPES.PARTIAL_PROPOSED,
          actorClerkUserId: authResult.userId,
          previousValue: { status: entry.status, totalAmount: entry.totalAmount },
          nextValue: { status: PAYROLL_ENTRY_STATUSES.PARTIAL_PROPOSED, proposedAmount: parsedAmount },
          reason: parsedNote,
        },
      }),
    ])

    return NextResponse.json(updated)
  } catch (error) {
    console.error("POST /api/staff/payroll/entries/[entryId]/propose-partial failed", error)
    return jsonError("Failed to propose partial payment", 500)
  }
}