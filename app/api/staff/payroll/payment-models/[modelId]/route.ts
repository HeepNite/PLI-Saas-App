import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  asOptionalBoolean,
  asOptionalNumber,
  asOptionalString,
  currencyExists,
  hasOwn,
  jsonError,
  readJsonBody,
  resolveSchoolIdForClerkUser,
} from "@/lib/payroll/route-helpers"
import { hydratePaymentModelDefaultMethod } from "@/lib/payroll/payment-model-response"
import { authorizeOwnerRequest } from "@/lib/security/staff-portal-auth"

export const runtime = "nodejs"

const isValidWeekday = (value: number) => Number.isInteger(value) && value >= 0 && value <= 6

const validatePaymentMethod = async (schoolId: string, defaultPaymentMethodId: string | null) => {
  if (defaultPaymentMethodId === null) return true

  const method = await prisma.staffPaymentMethod.findFirst({
    where: {
      id: defaultPaymentMethodId,
      schoolId,
      active: true,
    },
    select: { id: true },
  })

  return Boolean(method)
}

export async function PATCH(req: Request, context: { params: Promise<{ modelId: string }> }) {
  const authResult = await authorizeOwnerRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const schoolId = await resolveSchoolIdForClerkUser(authResult.userId)
  if (!schoolId) {
    return jsonError("School context is required", 400)
  }

  const { modelId } = await context.params
  if (!modelId) {
    return jsonError("Missing modelId", 400)
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const existing = await prisma.staffPaymentModel.findUnique({
    where: { id: modelId },
    select: { id: true, schoolId: true },
  })

  if (!existing || existing.schoolId !== schoolId) {
    return jsonError("Resource not found", 404)
  }

  const data: {
    name?: string
    hourlyRate?: number
    currency?: string
    paydayWeekday?: number
    creditCapCents?: number
    defaultPaymentMethodId?: string | null
    isDefault?: boolean
    active?: boolean
    type?: string
    percentageRate?: number | null
    revenueBase?: string | null
  } = {}

  if (hasOwn(parsedBody.body, "name")) {
    const name = asOptionalString(parsedBody.body.name)
    if (!name) {
      return jsonError("Payment model name is required", 422)
    }

    data.name = name
  }

  if (hasOwn(parsedBody.body, "hourlyRate")) {
    const hourlyRate = asOptionalNumber(parsedBody.body.hourlyRate)
    if (hourlyRate === null || hourlyRate <= 0) {
      return jsonError("Hourly rate must be greater than 0", 422, { field: "hourlyRate" })
    }

    data.hourlyRate = hourlyRate
  }

  if (hasOwn(parsedBody.body, "currency")) {
    const currency = asOptionalString(parsedBody.body.currency)
    if (!currency || !(await currencyExists(currency))) {
      return jsonError("Unsupported currency", 422, { field: "currency" })
    }

    data.currency = currency
  }

  if (hasOwn(parsedBody.body, "paydayWeekday")) {
    const paydayWeekday = asOptionalNumber(parsedBody.body.paydayWeekday)
    if (paydayWeekday === null || !isValidWeekday(paydayWeekday)) {
      return jsonError("Payday weekday must be between 0 and 6", 422, { field: "paydayWeekday" })
    }

    data.paydayWeekday = paydayWeekday
  }

  if (hasOwn(parsedBody.body, "creditCapCents")) {
    const creditCapCents = asOptionalNumber(parsedBody.body.creditCapCents)
    if (creditCapCents === null || !Number.isInteger(creditCapCents) || creditCapCents < 0) {
      return jsonError("Credit cap must be 0 or greater", 422, { field: "creditCapCents" })
    }

    data.creditCapCents = creditCapCents
  }

  if (hasOwn(parsedBody.body, "defaultPaymentMethodId")) {
    const defaultPaymentMethodId = parsedBody.body.defaultPaymentMethodId === null
      ? null
      : asOptionalString(parsedBody.body.defaultPaymentMethodId)

    if (parsedBody.body.defaultPaymentMethodId !== null && !defaultPaymentMethodId) {
      return jsonError("Default payment method not found or inactive", 422, { field: "defaultPaymentMethodId" })
    }

    if (!(await validatePaymentMethod(schoolId, defaultPaymentMethodId))) {
      return jsonError("Default payment method not found or inactive", 422, { field: "defaultPaymentMethodId" })
    }

    data.defaultPaymentMethodId = defaultPaymentMethodId
  }

  if (hasOwn(parsedBody.body, "isDefault")) {
    const isDefault = asOptionalBoolean(parsedBody.body.isDefault)
    if (isDefault === null) {
      return jsonError("isDefault flag must be boolean", 422, { field: "isDefault" })
    }

    data.isDefault = isDefault
  }

  if (hasOwn(parsedBody.body, "active")) {
    const active = asOptionalBoolean(parsedBody.body.active)
    if (active === null) {
      return jsonError("Active flag must be boolean", 422, { field: "active" })
    }

    data.active = active
  }

  const VALID_MODEL_TYPES = ["per_hour", "per_percentage", "hybrid"] as const
  if (hasOwn(parsedBody.body, "type")) {
    const type = asOptionalString(parsedBody.body.type)
    if (!type || !VALID_MODEL_TYPES.includes(type as typeof VALID_MODEL_TYPES[number])) {
      return jsonError("Type must be per_hour, per_percentage, or hybrid", 422, { field: "type" })
    }

    data.type = type
  }

  if (hasOwn(parsedBody.body, "percentageRate")) {
    if (parsedBody.body.percentageRate === null) {
      data.percentageRate = null
    } else {
      const percentageRate = asOptionalNumber(parsedBody.body.percentageRate)
      if (percentageRate === null || percentageRate <= 0 || percentageRate > 1) {
        return jsonError("Percentage rate must be between 0 and 1 (e.g. 0.40 for 40%)", 422, { field: "percentageRate" })
      }

      data.percentageRate = percentageRate
    }
  }

  if (hasOwn(parsedBody.body, "revenueBase")) {
    if (parsedBody.body.revenueBase === null) {
      data.revenueBase = null
    } else {
      const revenueBase = asOptionalString(parsedBody.body.revenueBase)
      if (!revenueBase) {
        return jsonError("Revenue base cannot be empty", 422, { field: "revenueBase" })
      }

      data.revenueBase = revenueBase
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (data.isDefault === true) {
      await tx.staffPaymentModel.updateMany({
        where: { schoolId, isDefault: true, NOT: { id: modelId } },
        data: { isDefault: false },
      })
    }

    return tx.staffPaymentModel.update({
      where: { id: modelId },
      data,
      include: {
        defaultPaymentMethod: true,
      },
    })
  })

  return NextResponse.json(await hydratePaymentModelDefaultMethod(schoolId, updated))
}
