import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  asOptionalNumber,
  asOptionalString,
  hasOwn,
  jsonError,
  readJsonBody,
  resolveSchoolIdForClerkUser,
} from "@/lib/payroll/route-helpers"
import { authorizeOwnerRequest } from "@/lib/security/staff-portal-auth"

export const runtime = "nodejs"

const isValidWeekday = (value: number) => Number.isInteger(value) && value >= 0 && value <= 6

export async function GET(_req: Request, context: { params: Promise<{ userId: string }> }) {
  const authResult = await authorizeOwnerRequest()
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

  const staffAccount = await prisma.staffAccount.findUnique({
    where: { clerkUserId: userId },
    select: {
      id: true,
      clerkUserId: true,
      hourlyRate: true,
      paydayWeekday: true,
      paymentModelId: true,
      creditCapCents: true,
      paymentModel: true,
    },
  })

  if (!staffAccount) {
    return jsonError("Resource not found", 404)
  }

  const effectivePaymentModel =
    staffAccount.paymentModel ??
    (await prisma.staffPaymentModel.findFirst({
      where: { schoolId, isDefault: true },
      include: { defaultPaymentMethod: true },
      orderBy: { updatedAt: "desc" },
    }))

  return NextResponse.json({
    clerkUserId: staffAccount.clerkUserId,
    hourlyRate: staffAccount.hourlyRate,
    paydayWeekday: staffAccount.paydayWeekday,
    paymentModelId: staffAccount.paymentModelId,
    creditCapCents: staffAccount.creditCapCents,
    effectivePaymentModel,
  })
}

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const authResult = await authorizeOwnerRequest()
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

  const staffAccount = await prisma.staffAccount.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  })

  if (!staffAccount) {
    return jsonError("Resource not found", 404)
  }

  const data: {
    hourlyRate?: number | null
    paydayWeekday?: number | null
    paymentModelId?: string | null
    creditCapCents?: number | null
  } = {}

  if (hasOwn(parsedBody.body, "hourlyRate")) {
    if (parsedBody.body.hourlyRate === null) {
      data.hourlyRate = null
    } else {
      const hourlyRate = asOptionalNumber(parsedBody.body.hourlyRate)
      if (hourlyRate === null || hourlyRate <= 0) {
        return jsonError("Hourly rate must be greater than 0", 422, { field: "hourlyRate" })
      }

      data.hourlyRate = hourlyRate
    }
  }

  if (hasOwn(parsedBody.body, "paydayWeekday")) {
    if (parsedBody.body.paydayWeekday === null) {
      data.paydayWeekday = null
    } else {
      const paydayWeekday = asOptionalNumber(parsedBody.body.paydayWeekday)
      if (paydayWeekday === null || !isValidWeekday(paydayWeekday)) {
        return jsonError("Payday weekday must be between 0 and 6", 422, { field: "paydayWeekday" })
      }

      data.paydayWeekday = paydayWeekday
    }
  }

  if (hasOwn(parsedBody.body, "creditCapCents")) {
    if (parsedBody.body.creditCapCents === null) {
      data.creditCapCents = null
    } else {
      const creditCapCents = asOptionalNumber(parsedBody.body.creditCapCents)
      if (creditCapCents === null || !Number.isInteger(creditCapCents) || creditCapCents < 0) {
        return jsonError("Credit cap must be 0 or greater", 422, { field: "creditCapCents" })
      }

      data.creditCapCents = creditCapCents
    }
  }

  if (hasOwn(parsedBody.body, "paymentModelId")) {
    const paymentModelId = parsedBody.body.paymentModelId === null ? null : asOptionalString(parsedBody.body.paymentModelId)
    if (parsedBody.body.paymentModelId !== null && !paymentModelId) {
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

    data.paymentModelId = paymentModelId
  }

  const updated = await prisma.staffAccount.update({
    where: { clerkUserId: userId },
    data,
    select: {
      clerkUserId: true,
      hourlyRate: true,
      paydayWeekday: true,
      paymentModelId: true,
      creditCapCents: true,
      paymentModel: true,
    },
  })

  const effectivePaymentModel =
    updated.paymentModel ??
    (await prisma.staffPaymentModel.findFirst({
      where: { schoolId, isDefault: true },
      include: { defaultPaymentMethod: true },
      orderBy: { updatedAt: "desc" },
    }))

  return NextResponse.json({
    ...updated,
    effectivePaymentModel,
  })
}
