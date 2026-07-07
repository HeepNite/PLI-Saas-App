import { asObject } from "@/lib/shared"

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Resolves the school a staff Clerk user belongs to from their metadata.
 *
 * Shared by the PIN gate (CLERK_SESSION/PERSONAL context) and the PIN
 * resolver (school-scope check before any hash compare). Returns `null`
 * when no school can be resolved (staff Clerk-metadata schoolId backfill
 * is still pending — see design ADR 14).
 */
export const resolveSchoolIdFromUser = (user: { publicMetadata?: unknown; privateMetadata?: unknown }): string | null => {
  const publicMeta = asObject(user.publicMetadata)
  const privateMeta = asObject(user.privateMetadata)
  return (
    asOptionalString(publicMeta.schoolId) ||
    asOptionalString(publicMeta.staffSchoolId) ||
    asOptionalString(privateMeta.schoolId) ||
    asOptionalString(privateMeta.staffSchoolId)
  )
}
