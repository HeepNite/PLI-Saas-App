import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writePayrollAudit } from "@/lib/payroll/audit"
import { asOptionalString, hasOwn, jsonError, readJsonBody, resolveSchoolIdForClerkUser } from "@/lib/payroll/route-helpers"
import { AUDIT_ENTRY_TYPES } from "@/lib/payroll/types"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"

export const runtime = "nodejs"

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const schoolId = await resolveSchoolIdForClerkUser(authResult.userId)
  if (!schoolId) {
    return jsonError("School context is required", 400)
  }

  const { userId } = await context.params
  if (!userId) {
    return jsonError("Missing userId", 400)
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  if (!hasOwn(parsedBody.body, "paymentModelId")) {
    return jsonError("paymentModelId is required", 422)
  }

  const paymentModelId = parsedBody.body.paymentModelId === null ? null : asOptionalString(parsedBody.body.paymentModelId)
  if (parsedBody.body.paymentModelId !== null && !paymentModelId) {
    return jsonError("Resource not found", 404)
  }

  const staffAccount = await prisma.staffAccount.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      clerkUserId: true,
      paymentModelId: true,
      hourlyRate: true,
      paydayWeekday: true,
      creditCapCents: true,
    },
  })

  if (!staffAccount) {
    return jsonError("Resource not found", 404)
  }

  if (paymentModelId) {
    const model = await prisma.staffPaymentModel.findFirst({
      where: { id: paymentModelId, schoolId },
      select: { id: true },
    })

    if (!model) {
      return jsonError("Resource not found", 404)
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextStaffAccount = await tx.staffAccount.update({
      where: { clerkUserId: userId },
      data: { paymentModelId },
      select: {
        id: true,
        clerkUserId: true,
        paymentModelId: true,
        hourlyRate: true,
        paydayWeekday: true,
        creditCapCents: true,
      },
    })

    await writePayrollAudit(
      {
        staffAccountId: staffAccount.id,
        type: AUDIT_ENTRY_TYPES.MODEL_ASSIGNED,
        actorClerkUserId: authResult.userId,
        previousValue: { previousModelId: staffAccount.paymentModelId },
        nextValue: { nextModelId: nextStaffAccount.paymentModelId },
        metadata: {
          previousModelId: staffAccount.paymentModelId,
          nextModelId: nextStaffAccount.paymentModelId,
        },
      },
      tx
    )

    return nextStaffAccount
  })

  return NextResponse.json(updated)
}
