import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  asOptionalBoolean,
  asOptionalNumber,
  asOptionalString,
  currencyExists,
  jsonError,
  readJsonBody,
  resolveSchoolIdForClerkUser,
} from "@/lib/payroll/route-helpers"
import { hydratePaymentModelDefaultMethod, hydratePaymentModelsDefaultMethod } from "@/lib/payroll/payment-model-response"
import { authorizeOwnerRequest, authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"

export const runtime = "nodejs"

const VALID_WEEKDAY_RANGE = { min: 0, max: 6 }

const isValidWeekday = (value: number) => Number.isInteger(value) && value >= VALID_WEEKDAY_RANGE.min && value <= VALID_WEEKDAY_RANGE.max

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

export async function GET() {
  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const schoolId = await resolveSchoolIdForClerkUser(authResult.userId)
  if (!schoolId) {
    return jsonError("School context is required", 400)
  }

  const items = await prisma.staffPaymentModel.findMany({
    where: { schoolId },
    include: {
      defaultPaymentMethod: true,
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  })

  return NextResponse.json({ items: await hydratePaymentModelsDefaultMethod(schoolId, items) })
}

export async function POST(req: Request) {
  const authResult = await authorizeOwnerRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const schoolId = await resolveSchoolIdForClerkUser(authResult.userId)
  if (!schoolId) {
    return jsonError("School context is required", 400)
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const name = asOptionalString(parsedBody.body.name)
  if (!name) {
    return jsonError("Payment model name is required", 422)
  }

  const paydayWeekday = asOptionalNumber(parsedBody.body.paydayWeekday)
  if (paydayWeekday === null || !isValidWeekday(paydayWeekday)) {
    return jsonError("Payday weekday must be between 0 and 6", 422, { field: "paydayWeekday" })
  }

  const creditCapCents = asOptionalNumber(parsedBody.body.creditCapCents)
  if (creditCapCents === null || !Number.isInteger(creditCapCents) || creditCapCents < 0) {
    return jsonError("Credit cap must be 0 or greater", 422, { field: "creditCapCents" })
  }

  const currency = asOptionalString(parsedBody.body.currency)
  if (!currency || !(await currencyExists(currency))) {
    return jsonError("Unsupported currency", 422, { field: "currency" })
  }

  const rawDefaultPaymentMethodId = parsedBody.body.defaultPaymentMethodId
  const defaultPaymentMethodId = rawDefaultPaymentMethodId === null ? null : asOptionalString(rawDefaultPaymentMethodId)

  if (rawDefaultPaymentMethodId !== undefined) {
    if (rawDefaultPaymentMethodId !== null && !defaultPaymentMethodId) {
      return jsonError("Default payment method not found or inactive", 422, { field: "defaultPaymentMethodId" })
    }

    if (!(await validatePaymentMethod(schoolId, defaultPaymentMethodId))) {
      return jsonError("Default payment method not found or inactive", 422, { field: "defaultPaymentMethodId" })
    }
  }

  const VALID_MODEL_TYPES = ["per_hour", "per_percentage", "hybrid"] as const
  const type = asOptionalString(parsedBody.body.type) ?? "per_hour"
  if (!VALID_MODEL_TYPES.includes(type as typeof VALID_MODEL_TYPES[number])) {
    return jsonError("Type must be per_hour, per_percentage, or hybrid", 422, { field: "type" })
  }

  let hourlyRate: number | null
  if (parsedBody.body.hourlyRate === undefined) {
    hourlyRate = type === "per_percentage" ? 0 : null
  } else {
    hourlyRate = asOptionalNumber(parsedBody.body.hourlyRate)
  }

  if (hourlyRate === null || hourlyRate < 0) {
    return jsonError("Hourly rate must be 0 or greater", 422, { field: "hourlyRate" })
  }

  const isDefault = asOptionalBoolean(parsedBody.body.isDefault)
  if (parsedBody.body.isDefault !== undefined && isDefault === null) {
    return jsonError("isDefault flag must be boolean", 422, { field: "isDefault" })
  }

  const isPercentageOnly = type === "per_percentage"
  if (isPercentageOnly && hourlyRate === 0) {
    /* allowed: pure percentage models can have hourlyRate = 0 */
  } else if (hourlyRate <= 0) {
    return jsonError("Hourly rate must be greater than 0", 422, { field: "hourlyRate" })
  }

  let percentageRate: number | null = null
  let revenueBase: string | null = null
  if (type === "per_percentage" || type === "hybrid") {
    percentageRate = asOptionalNumber(parsedBody.body.percentageRate)
    if (percentageRate === null || percentageRate <= 0 || percentageRate > 1) {
      return jsonError("Percentage rate must be between 0 and 1 (e.g. 0.40 for 40%)", 422, { field: "percentageRate" })
    }
    revenueBase = asOptionalString(parsedBody.body.revenueBase) ?? "class_revenue"
  }

  const created = await prisma.$transaction(async (tx) => {
    if (isDefault === true) {
      await tx.staffPaymentModel.updateMany({
        where: { schoolId, isDefault: true },
        data: { isDefault: false },
      })
    }

    return tx.staffPaymentModel.create({
      data: {
        schoolId,
        name,
        hourlyRate,
        currency,
        paydayWeekday,
        creditCapCents,
        defaultPaymentMethodId,
        isDefault: isDefault ?? false,
        active: true,
        ...(type !== "per_hour" && { type }),
        ...(percentageRate !== null && { percentageRate }),
        ...(revenueBase !== null && revenueBase !== "class_revenue" && { revenueBase }),
      },
      include: {
        defaultPaymentMethod: true,
      },
    })
  })

  return NextResponse.json(await hydratePaymentModelDefaultMethod(schoolId, created), { status: 201 })
}
