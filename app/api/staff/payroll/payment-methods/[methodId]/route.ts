import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { VALID_ADAPTER_TYPES } from "@/lib/payroll/adapters/registry"
import {
  asOptionalBoolean,
  asOptionalString,
  currencyExists,
  hasOwn,
  jsonError,
  readJsonBody,
  resolveSchoolIdForClerkUser,
  toNullableJsonInput,
} from "@/lib/payroll/route-helpers"
import { authorizeOwnerRequest } from "@/lib/security/staff-portal-auth"

export const runtime = "nodejs"

const isValidAdapterType = (value: string): value is (typeof VALID_ADAPTER_TYPES)[number] =>
  VALID_ADAPTER_TYPES.includes(value as (typeof VALID_ADAPTER_TYPES)[number])

export async function PATCH(req: Request, context: { params: Promise<{ methodId: string }> }) {
  const authResult = await authorizeOwnerRequest()
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      {
        status: authResult.status,
        headers: authResult.retryAfterSec ? { "Retry-After": String(authResult.retryAfterSec) } : undefined,
      }
    )
  }

  const schoolId = await resolveSchoolIdForClerkUser(authResult.userId)
  if (!schoolId) {
    return jsonError("School context is required", 400)
  }

  const { methodId } = await context.params
  if (!methodId) {
    return jsonError("Missing methodId", 400)
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const existing = await prisma.staffPaymentMethod.findUnique({
    where: { id: methodId },
    select: { id: true, schoolId: true, active: true },
  })

  if (!existing || existing.schoolId !== schoolId) {
    return jsonError("Resource not found", 404)
  }

  const data: {
    name?: string
    adapterType?: string
    currency?: string
    active?: boolean
    configJson?: ReturnType<typeof toNullableJsonInput>
  } = {}

  if (hasOwn(parsedBody.body, "name")) {
    const name = asOptionalString(parsedBody.body.name)
    if (!name) {
      return jsonError("Payment method name is required", 422)
    }

    const duplicate = await prisma.staffPaymentMethod.findFirst({
      where: {
        schoolId,
        name,
        NOT: { id: methodId },
      },
      select: { id: true },
    })
    if (duplicate) {
      return jsonError("Payment method name already exists", 409)
    }

    data.name = name
  }

  if (hasOwn(parsedBody.body, "adapterType")) {
    const adapterType = asOptionalString(parsedBody.body.adapterType)
    if (!adapterType || !isValidAdapterType(adapterType)) {
      return jsonError("Invalid adapter type", 422)
    }

    data.adapterType = adapterType
  }

  if (hasOwn(parsedBody.body, "currency")) {
    const currency = asOptionalString(parsedBody.body.currency)
    if (!currency || !(await currencyExists(currency))) {
      return jsonError("Unsupported currency", 422)
    }

    data.currency = currency
  }

  if (hasOwn(parsedBody.body, "config")) {
    data.configJson = toNullableJsonInput(parsedBody.body.config)
  }

  if (hasOwn(parsedBody.body, "active")) {
    const active = asOptionalBoolean(parsedBody.body.active)
    if (active === null) {
      return jsonError("Active flag must be boolean", 422)
    }

    if (!active) {
      const modelsInUse = await prisma.staffPaymentModel.findMany({
        where: {
          schoolId,
          active: true,
          defaultPaymentMethodId: methodId,
        },
        select: { name: true },
        orderBy: { name: "asc" },
      })

      if (modelsInUse.length > 0) {
        return jsonError("Cannot deactivate: method is used by active model(s)", 409, {
          models: modelsInUse.map((model) => model.name),
        })
      }
    }

    data.active = active
  }

  const updated = await prisma.staffPaymentMethod.update({
    where: { id: methodId },
    data,
  })

  return NextResponse.json(updated)
}
