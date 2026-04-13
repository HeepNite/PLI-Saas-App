import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { jsonError } from "@/lib/payroll/route-helpers"
import { getAdapter } from "@/lib/payroll/adapters/registry"
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
        totalAmount: true,
        paymentMethodId: true,
        currency: true,
        periodStart: true,
        periodEnd: true,
        hoursWorked: true,
        hourlyRate: true,
        grossAmount: true,
        bonusAmount: true,
        paymentModelId: true,
        idempotencyKey: true,
      },
    })

    if (!entry) {
      return jsonError("Entry not found", 404)
    }

    if (entry.status !== PAYROLL_ENTRY_STATUSES.PARTIAL_PROPOSED) {
      return jsonError("Entry is not in partial_proposed status", 422)
    }

    if (entry.staffAccount.clerkUserId !== baseAuth.userId) {
      return jsonError("Only the staff member who owns this entry can accept the partial payment", 403)
    }

    const proposedAmount = entry.proposedAmount
    if (!proposedAmount) {
      return jsonError("No proposed amount found", 400)
    }

    await prisma.staffPayrollEntry.update({
      where: { id: entryId },
      data: { status: PAYROLL_ENTRY_STATUSES.PROCESSING },
    })

    const snapshot = {
      id: entry.id,
      staffAccountId: entry.staffAccountId,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      hoursWorked: entry.hoursWorked,
      hourlyRate: entry.hourlyRate,
      grossAmount: entry.grossAmount,
      bonusAmount: entry.bonusAmount,
      totalAmount: entry.totalAmount,
      currency: entry.currency,
      status: entry.status,
      paymentMethodId: entry.paymentMethodId,
      paymentModelId: entry.paymentModelId,
      idempotencyKey: entry.idempotencyKey,
      proposedAmount: entry.proposedAmount,
    }

    const adapterType = entry.paymentMethodId
      ? (await prisma.staffPaymentMethod.findUnique({ where: { id: entry.paymentMethodId } }))?.adapterType ?? "cash"
      : "cash"

    const adapter = getAdapter(adapterType)
    const dispatchResult = await adapter.dispatch(snapshot, proposedAmount, baseAuth.userId)

    if (!dispatchResult.ok) {
      await prisma.staffPayrollEntry.update({
        where: { id: entryId },
        data: { status: PAYROLL_ENTRY_STATUSES.PENDING },
      })
      return jsonError(dispatchResult.error ?? "Payment dispatch failed", 500)
    }

    const [updated] = await prisma.$transaction([
      prisma.staffPayrollEntry.update({
        where: { id: entryId },
        data: {
          status: PAYROLL_ENTRY_STATUSES.PAID,
          paidAt: new Date(),
          paidAmount: proposedAmount,
          paidBy: baseAuth.userId,
        },
      }),
      prisma.staffPayrollAudit.create({
        data: {
          entryId,
          staffAccountId: entry.staffAccountId,
          type: AUDIT_ENTRY_TYPES.PARTIAL_ACCEPTED,
          actorClerkUserId: baseAuth.userId,
          previousValue: { status: PAYROLL_ENTRY_STATUSES.PROCESSING },
          nextValue: {
            status: PAYROLL_ENTRY_STATUSES.PAID,
            paidAt: new Date().toISOString(),
            paidAmount: proposedAmount,
          },
          reason: `Accepted partial payment of ${proposedAmount} cents`,
        },
      }),
    ])

    return NextResponse.json(updated)
  } catch (error) {
    console.error("POST /api/staff/payroll/entries/[entryId]/accept-partial failed", error)
    return jsonError("Failed to accept partial payment", 500)
  }
}
