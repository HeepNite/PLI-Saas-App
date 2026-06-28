import { clerkClient } from "@clerk/nextjs/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { asObject } from "@/lib/shared"
import { apiError, readJsonBody as _readJsonBody } from "@/lib/api-response"

export type JsonRecord = Record<string, unknown>

export const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)

export const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const asOptionalNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

export const asOptionalBoolean = (value: unknown): boolean | null => {
  if (typeof value !== "boolean") return null
  return value
}

/** @deprecated Use `apiError` from `@/lib/api-response` instead */
export const jsonError = apiError

export const readJsonBody = _readJsonBody

export async function resolveSchoolIdForClerkUser(userId: string): Promise<string | null> {
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const publicMetadata = asObject(user.publicMetadata)
  const privateMetadata = asObject(user.privateMetadata)

  const resolvedId =
    asOptionalString(publicMetadata.schoolId) ||
    asOptionalString(publicMetadata.staffSchoolId) ||
    asOptionalString(privateMetadata.schoolId) ||
    asOptionalString(privateMetadata.staffSchoolId)

  // Fallback for local testing or when metadata is missing
  return resolvedId || "default-school"
}

export async function currencyExists(code: string): Promise<boolean> {
  const currency = await prisma.currency.findUnique({
    where: { code },
    select: { code: true },
  })

  return Boolean(currency)
}

export const toNullableJsonInput = (value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull => {
  if (value === null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}
