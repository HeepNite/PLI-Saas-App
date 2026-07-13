import { prisma } from "@/lib/prisma"
import { getCachedClerkUser } from "@/lib/clerk-users"
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

const resolveSchoolIdFromMetadata = (metadata: unknown): string | null => {
  const record = asObject(metadata)

  return asOptionalString(record.schoolId) || asOptionalString(record.staffSchoolId)
}

export async function resolveSchoolIdForClerkUser(userId: string): Promise<string | null> {
  const staffAccount = await prisma.staffAccount.findUnique({
    where: { clerkUserId: userId },
    select: {
      metadata: true,
      paymentModel: {
        select: { schoolId: true },
      },
    },
  })

  const resolvedId =
    resolveSchoolIdFromMetadata(staffAccount?.metadata) ||
    asOptionalString(staffAccount?.paymentModel?.schoolId)

  if (resolvedId) return resolvedId

  const clerkUser = await getCachedClerkUser(userId)
  const clerkSchoolId =
    resolveSchoolIdFromMetadata(clerkUser.publicMetadata) ||
    resolveSchoolIdFromMetadata(clerkUser.privateMetadata)

  // Fallback for local testing or when metadata is missing
  return clerkSchoolId || "default-school"
}

export async function currencyExists(code: string): Promise<boolean> {
  const currency = await prisma.currency.findUnique({
    where: { code },
    select: { code: true },
  })

  return Boolean(currency)
}
