import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { VALID_ADAPTER_TYPES } from "@/lib/payroll/adapters/registry"
import { maskPaymentMethod, mergePaymentMethodConfig } from "@/lib/payroll/mask-payment-method-config"
import type { AdapterType } from "@/lib/payroll/types"
import {
  asOptionalString,
  currencyExists,
  jsonError,
  readJsonBody,
  resolveSchoolIdForClerkUser,
} from "@/lib/payroll/route-helpers"
import { authorizeOwnerRequest, type StaffPortalAuthResult } from "@/lib/security/staff-portal-auth"

export const runtime = "nodejs"

const isValidAdapterType = (value: string): value is (typeof VALID_ADAPTER_TYPES)[number] =>
  VALID_ADAPTER_TYPES.includes(value as (typeof VALID_ADAPTER_TYPES)[number])

const normalizeName = (value: unknown) => asOptionalString(value)

const authErrorResponse = (authResult: Extract<StaffPortalAuthResult, { ok: false }>) =>
  NextResponse.json(
    { error: authResult.error },
    {
      status: authResult.status,
      headers: authResult.retryAfterSec ? { "Retry-After": String(authResult.retryAfterSec) } : undefined,
    }
  )

export async function GET() {
  const authResult = await authorizeOwnerRequest()
  if (!authResult.ok) {
    return authErrorResponse(authResult)
  }

  const schoolId = await resolveSchoolIdForClerkUser(authResult.userId)
  if (!schoolId) {
    return jsonError("School context is required", 400)
  }

  const items = await prisma.staffPaymentMethod.findMany({
    where: { schoolId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  })

  return NextResponse.json({ items: items.map(maskPaymentMethod) })
}

export async function POST(req: Request) {
  const authResult = await authorizeOwnerRequest()
  if (!authResult.ok) {
    return authErrorResponse(authResult)
  }

  const schoolId = await resolveSchoolIdForClerkUser(authResult.userId)
  if (!schoolId) {
    return jsonError("School context is required", 400)
  }

  const parsedBody = await readJsonBody(req)
  if (!parsedBody.ok) return parsedBody.response

  const name = normalizeName(parsedBody.body.name)
  if (!name) {
    return jsonError("Payment method name is required", 422)
  }

  const adapterType = asOptionalString(parsedBody.body.adapterType)
  if (!adapterType || !isValidAdapterType(adapterType)) {
    return jsonError("Invalid adapter type", 422)
  }

  const currency = asOptionalString(parsedBody.body.currency)
  if (!currency || !(await currencyExists(currency))) {
    return jsonError("Unsupported currency", 422)
  }

  const duplicate = await prisma.staffPaymentMethod.findFirst({
    where: { schoolId, name },
    select: { id: true },
  })
  if (duplicate) {
    return jsonError("Payment method name already exists", 409)
  }

  const created = await prisma.staffPaymentMethod.create({
    data: {
      schoolId,
      name,
      adapterType,
      currency,
      configJson: mergePaymentMethodConfig(adapterType as AdapterType, undefined, parsedBody.body.config),
      active: true,
    },
  })

  return NextResponse.json(maskPaymentMethod(created), { status: 201 })
}
