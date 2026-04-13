import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { PAYROLL_ENTRY_STATUSES } from "@/lib/payroll/types"
import { ADAPTER_TYPES, type AdapterType } from "@/lib/payroll/types"
import { getAdapter } from "@/lib/payroll/adapters/registry"
import { jsonError, readJsonBody, resolveSchoolIdForClerkUser, asOptionalString } from "@/lib/payroll/route-helpers"
import { writePayrollAudit } from "@/lib/payroll/audit"
import type { PayrollEntrySnapshot, PayrollEntryStatus } from "@/lib/payroll/types"

export const runtime = "nodejs"

const VALID_STATUSES = [PAYROLL_ENTRY_STATUSES.PENDING, PAYROLL_ENTRY_STATUSES.PARTIAL_PROPOSED] as const

export async function POST(req: Request, context: { params: Promise<{ entryId: string }> }) {
  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const actorClerkUserId = authResult.userId

  const { entryId } = await context.params
  if (!entryId) {
    return jsonError("Missing entryId", 400)
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const idempotencyKey = asOptionalString(parsedBody.body.idempotencyKey) ?? undefined
  const paymentMethodId = asOptionalString(parsedBody.body.paymentMethodId) ?? undefined

  const entry = await prisma.staffPayrollEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      staffAccountId: true,
      status: true,
      totalAmount: true,
      currency: true,
      paymentMethodId: true,
      paymentModel: {
        select: {
          schoolId: true,
        },
      },
    },
  })

  if (!entry) {
    return jsonError("Entry not found", 404)
  }

  if (entry.status === PAYROLL_ENTRY_STATUSES.PAID) {
    return jsonError("Entry already paid", 409)
  }

  if (entry.status === PAYROLL_ENTRY_STATUSES.CANCELLED || entry.status === PAYROLL_ENTRY_STATUSES.REVERSED) {
    return jsonError("Entry is cancelled or reversed", 422)
  }

  if (!VALID_STATUSES.includes(entry.status as (typeof VALID_STATUSES)[number])) {
    return jsonError("Entry status must be pending or partial_proposed", 409)
  }

  const schoolId = entry.paymentModel?.schoolId
  const authSchoolId = await resolveSchoolIdForClerkUser(actorClerkUserId)
  if (schoolId !== authSchoolId) {
    return jsonError("Entry not found", 404)
  }

  if (idempotencyKey) {
    const existingWithKey = await prisma.staffPayrollEntry.findFirst({
      where: {
        idempotencyKey,
        staffAccountId: entry.staffAccountId,
        status: PAYROLL_ENTRY_STATUSES.PAID,
      },
      select: { id: true },
    })

    if (existingWithKey) {
      return NextResponse.json({ id: existingWithKey.id, message: "Idempotent response", status: "paid" })
    }
  }

  const resolvedPaymentMethodId = paymentMethodId ?? entry.paymentMethodId

  let adapterType: AdapterType = ADAPTER_TYPES.CASH
  if (resolvedPaymentMethodId) {
    const method = await prisma.staffPaymentMethod.findUnique({
      where: { id: resolvedPaymentMethodId },
      select: { adapterType: true },
    })
    if (method) {
      adapterType = method.adapterType as AdapterType
    }
  }

  const snapshot: PayrollEntrySnapshot = {
    id: entry.id,
    staffAccountId: entry.staffAccountId,
    periodStart: new Date(),
    periodEnd: new Date(),
    hoursWorked: 0,
    hourlyRate: 0,
    grossAmount: entry.totalAmount,
    bonusAmount: 0,
    totalAmount: entry.totalAmount,
    currency: entry.currency,
    status: entry.status as PayrollEntryStatus,
    paymentMethodId: resolvedPaymentMethodId,
    paymentModelId: null,
    idempotencyKey: idempotencyKey ?? null,
    proposedAmount: null,
  }

  await prisma.staffPayrollEntry.update({
    where: { id: entryId },
    data: { status: PAYROLL_ENTRY_STATUSES.PROCESSING },
  })

  const adapter = getAdapter(adapterType)
  const dispatchResult = await adapter.dispatch(snapshot, entry.totalAmount, actorClerkUserId)

  if (!dispatchResult.ok) {
    await prisma.staffPayrollEntry.update({
      where: { id: entryId },
      data: { status: PAYROLL_ENTRY_STATUSES.PENDING },
    })

    return jsonError(dispatchResult.error ?? "Payment failed", 500)
  }

  const auditData = {
    entryId,
    staffAccountId: entry.staffAccountId,
    type: "PAID" as const,
    actorClerkUserId,
    previousValue: { status: entry.status, totalAmount: entry.totalAmount },
    nextValue: {
      status: PAYROLL_ENTRY_STATUSES.PAID,
      totalAmount: entry.totalAmount,
      paidAmount: entry.totalAmount,
      paidAt: new Date().toISOString(),
    },
    metadata: { reference: dispatchResult.reference },
  }

  await prisma.$transaction([
    prisma.staffPayrollEntry.update({
      where: { id: entryId },
      data: {
        status: PAYROLL_ENTRY_STATUSES.PAID,
        paidAt: new Date(),
        paidBy: actorClerkUserId,
        paidAmount: entry.totalAmount,
        idempotencyKey: idempotencyKey ?? undefined,
      },
    }),
    prisma.staffPayrollAudit.create({
      data: {
        entryId,
        staffAccountId: entry.staffAccountId,
        type: "PAID",
        actorClerkUserId: actorClerkUserId,
        previousValue: auditData.previousValue,
        nextValue: auditData.nextValue,
        metadata: auditData.metadata ?? undefined,
      },
    }),
  ])

  const updated = await prisma.staffPayrollEntry.findUnique({
    where: { id: entryId },
  })

  return NextResponse.json(updated)
}