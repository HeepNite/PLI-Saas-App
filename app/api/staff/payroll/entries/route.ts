import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { asOptionalString, jsonError, readJsonBody } from "@/lib/payroll/route-helpers"
import { deriveHoursWorked } from "@/lib/payroll/hours"
import { BONUS_TYPES } from "@/lib/payroll/types"

export const runtime = "nodejs"

async function resolveEffectivePaymentModel(staffAccountId: string, schoolId: string | null) {
  const staffAccount = await prisma.staffAccount.findUnique({
    where: { id: staffAccountId },
    select: {
      paymentModelId: true,
    },
  })

  if (!staffAccount) {
    return null
  }

  if (staffAccount.paymentModelId) {
    const model = await prisma.staffPaymentModel.findUnique({
      where: { id: staffAccount.paymentModelId },
      select: { id: true, hourlyRate: true, currency: true, defaultPaymentMethodId: true },
    })
    if (model) {
      return {
        modelId: model.id,
        hourlyRate: model.hourlyRate,
        currency: model.currency,
        paymentMethodId: model.defaultPaymentMethodId,
      }
    }
  }

  if (!schoolId) {
    return null
  }

  const defaultModel = await prisma.staffPaymentModel.findFirst({
    where: {
      schoolId,
      isDefault: true,
      active: true,
    },
    select: { id: true, hourlyRate: true, currency: true, defaultPaymentMethodId: true },
  })

  if (!defaultModel) {
    return null
  }

  return {
    modelId: defaultModel.id,
    hourlyRate: defaultModel.hourlyRate,
    currency: defaultModel.currency,
    paymentMethodId: defaultModel.defaultPaymentMethodId,
  }
}

async function calculateBonusAmount(staffAccountId: string, entryId: string): Promise<number> {
  const activeRecurring = await prisma.staffPayrollBonus.findMany({
    where: {
      staffAccountId,
      type: BONUS_TYPES.RECURRING,
      active: true,
    },
    select: { amount: true },
  })

  const unattachedOneOff = await prisma.staffPayrollBonus.findMany({
    where: {
      staffAccountId,
      type: BONUS_TYPES.ONE_OFF,
      active: true,
      entryId: null,
    },
    select: { id: true, amount: true },
  })

  const recurringTotal = activeRecurring.reduce((sum, b) => sum + b.amount, 0)

  if (unattachedOneOff.length > 0) {
    await prisma.staffPayrollBonus.updateMany({
      where: {
        id: { in: unattachedOneOff.map((b) => b.id) },
      },
      data: { entryId },
    })
  }

  const oneOffTotal = unattachedOneOff.reduce((sum, b) => sum + b.amount, 0)

  return recurringTotal + oneOffTotal
}

export async function POST(req: Request) {
  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const staffAccountId = parsedBody.body.staffAccountId
  const periodStartRaw = parsedBody.body.periodStart
  const periodEndRaw = parsedBody.body.periodEnd
  const currency = asOptionalString(parsedBody.body.currency)
  const notes = asOptionalString(parsedBody.body.notes)

  if (!staffAccountId || typeof staffAccountId !== "string") {
    return jsonError("staffAccountId is required", 422)
  }

  if (!periodStartRaw || typeof periodStartRaw !== "string") {
    return jsonError("periodStart is required", 422)
  }

  if (!periodEndRaw || typeof periodEndRaw !== "string") {
    return jsonError("periodEnd is required", 422)
  }

  const periodStart = new Date(periodStartRaw)
  const periodEnd = new Date(periodEndRaw)

  if (isNaN(periodStart.getTime())) {
    return jsonError("Invalid periodStart date", 422)
  }

  if (isNaN(periodEnd.getTime())) {
    return jsonError("Invalid periodEnd date", 422)
  }

  if (periodStart >= periodEnd) {
    return jsonError("Period start must be before period end", 422)
  }

  const existingEntry = await prisma.staffPayrollEntry.findFirst({
    where: {
      staffAccountId,
      periodStart,
      periodEnd,
    },
    select: { id: true },
  })

  if (existingEntry) {
    return jsonError("Entry already exists", 409)
  }

  const hoursResult = await deriveHoursWorked(prisma, staffAccountId, periodStart, periodEnd)
  const hoursWorked = hoursResult.hoursWorked

  const paymentModel = await resolveEffectivePaymentModel(staffAccountId, "default-school")
  if (!paymentModel) {
    return jsonError("No payment model found for staff member", 400)
  }

  const effectiveCurrency = currency || paymentModel.currency
  const grossAmount = Math.ceil(hoursWorked * paymentModel.hourlyRate * 100)

  const createdEntry = await prisma.staffPayrollEntry.create({
    data: {
      staffAccountId,
      periodStart,
      periodEnd,
      hoursWorked,
      hourlyRate: paymentModel.hourlyRate,
      grossAmount,
      bonusAmount: 0,
      totalAmount: 0,
      currency: effectiveCurrency,
      status: "pending",
      paymentMethodId: paymentModel.paymentMethodId,
      paymentModelId: paymentModel.modelId,
      notes,
    },
    select: {
      id: true,
      staffAccountId: true,
      periodStart: true,
      periodEnd: true,
      hoursWorked: true,
      hourlyRate: true,
      grossAmount: true,
      bonusAmount: true,
      totalAmount: true,
      currency: true,
      status: true,
      paymentMethodId: true,
      paymentModelId: true,
      notes: true,
      createdAt: true,
    },
  })

  const bonusAmount = await calculateBonusAmount(staffAccountId, createdEntry.id)
  const totalAmount = grossAmount + bonusAmount

  const finalEntry = await prisma.staffPayrollEntry.update({
    where: { id: createdEntry.id },
    data: {
      bonusAmount,
      totalAmount,
    },
    select: {
      id: true,
      staffAccountId: true,
      periodStart: true,
      periodEnd: true,
      hoursWorked: true,
      hourlyRate: true,
      grossAmount: true,
      bonusAmount: true,
      totalAmount: true,
      currency: true,
      status: true,
      paymentMethodId: true,
      paymentModelId: true,
      notes: true,
      createdAt: true,
    },
  })

  return NextResponse.json(finalEntry, { status: 201 })
}
