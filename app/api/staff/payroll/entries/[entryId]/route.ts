import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerRequest, authorizeStaffPortalRequest, type StaffPortalAuthResult } from "@/lib/security/staff-portal-auth"
import { asOptionalNumber, asOptionalString, jsonError, readJsonBody } from "@/lib/payroll/route-helpers"

export const runtime = "nodejs"

const VALID_STATUSES = ["pending", "partial_proposed"] as const

export async function PATCH(req: Request, context: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await context.params
  if (!entryId) {
    return jsonError("Missing entryId", 400)
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const hasHoursWorked = parsedBody.body.hoursWorked !== undefined
  const hasTotalAmount = parsedBody.body.totalAmount !== undefined

  if (!hasHoursWorked && !hasTotalAmount) {
    return jsonError("Either hoursWorked or totalAmount is required", 422)
  }

  const reason = asOptionalString(parsedBody.body.reason)
  if (!reason) {
    return jsonError("Reason is required", 422)
  }

  let authResult: StaffPortalAuthResult
  if (hasHoursWorked) {
    authResult = await authorizeStaffPortalRequest()
  } else {
    authResult = await authorizeOwnerRequest()
  }

  if (!authResult.ok) {
    if (hasTotalAmount && authResult.status === 403) {
      return jsonError("Only owners can override total amount", 403)
    }
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const entry = await prisma.staffPayrollEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      status: true,
      hoursWorked: true,
      hourlyRate: true,
      grossAmount: true,
      bonusAmount: true,
      totalAmount: true,
    },
  })

  if (!entry) {
    return jsonError("Entry not found", 404)
  }

  if (!VALID_STATUSES.includes(entry.status as (typeof VALID_STATUSES)[number])) {
    return jsonError("Cannot override finalized entry", 422)
  }

  const updates: {
    hoursWorked?: number
    grossAmount?: number
    totalAmount?: number
    amountOverrideReason?: string
    amountOverriddenBy?: string
  } = {}

  if (hasHoursWorked) {
    const hoursWorked = asOptionalNumber(parsedBody.body.hoursWorked)
    if (hoursWorked === null || hoursWorked < 0) {
      return jsonError("hoursWorked must be >= 0", 422)
    }

    const grossAmount = Math.ceil(hoursWorked * entry.hourlyRate * 100)
    const totalAmount = grossAmount + entry.bonusAmount

    updates.hoursWorked = hoursWorked
    updates.grossAmount = grossAmount
    updates.totalAmount = totalAmount
  }

  if (hasTotalAmount) {
    const totalAmount = asOptionalNumber(parsedBody.body.totalAmount)
    if (totalAmount === null || totalAmount <= 0) {
      return jsonError("totalAmount must be > 0 (cents)", 422)
    }

    updates.totalAmount = totalAmount
    updates.amountOverrideReason = reason
    updates.amountOverriddenBy = authResult.userId
  }

  const auditType = hasHoursWorked ? "HOURS_OVERRIDE" : "AMOUNT_OVERRIDE"
  const previousValue = hasHoursWorked
    ? { hoursWorked: entry.hoursWorked, grossAmount: entry.grossAmount, totalAmount: entry.totalAmount }
    : { totalAmount: entry.totalAmount }
  const nextValue = hasHoursWorked
    ? { hoursWorked: updates.hoursWorked, grossAmount: updates.grossAmount, totalAmount: updates.totalAmount }
    : { totalAmount: updates.totalAmount }

  const [updated] = await prisma.$transaction([
    prisma.staffPayrollEntry.update({
      where: { id: entryId },
      data: updates,
    }),
    prisma.staffPayrollAudit.create({
      data: {
        entryId,
        type: auditType,
        actorClerkUserId: authResult.userId,
        previousValue,
        nextValue,
        reason,
      },
    }),
  ])

  return NextResponse.json(updated)
}
