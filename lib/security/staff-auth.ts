import { auth, clerkClient } from "@clerk/nextjs/server"

const STAFF_ROLES = new Set(["admin", "staff", "owner"])

const toStringArray = (value: unknown): string[] => {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }
  return []
}

const hasStaffRoleInMetadata = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object") return false
  const record = metadata as Record<string, unknown>
  const candidates = [
    ...toStringArray(record.role),
    ...toStringArray(record.roles),
  ]
  return candidates.some((role) => STAFF_ROLES.has(role.toLowerCase()))
}

const hasStaffRoleInClaims = (claims: unknown) => {
  if (!claims || typeof claims !== "object") return false
  const record = claims as Record<string, unknown>
  return hasStaffRoleInMetadata(record.metadata) || hasStaffRoleInMetadata(record.public_metadata)
}

const hasValidServiceToken = (req: Request) => {
  const expected = process.env.STAFF_CHECKIN_TOKEN
  if (!expected) return false
  const incoming = req.headers.get("x-staff-token")
  return incoming === expected
}

export type StaffAuthResult =
  | { ok: true; source: "token" | "clerk" }
  | { ok: false; status: number; error: string }

export const authorizeStaffRequest = async (req: Request): Promise<StaffAuthResult> => {
  const expectedToken = process.env.STAFF_CHECKIN_TOKEN
  const incomingToken = req.headers.get("x-staff-token")

  if (hasValidServiceToken(req)) {
    return { ok: true, source: "token" }
  }
  if (expectedToken && incomingToken && incomingToken !== expectedToken) {
    return { ok: false, status: 401, error: "Unauthorized staff request" }
  }

  const authResult = await auth()
  if (!authResult.userId) {
    return { ok: false, status: 401, error: "Unauthorized staff request" }
  }

  if (hasStaffRoleInClaims(authResult.sessionClaims)) {
    return { ok: true, source: "clerk" }
  }

  const client = await clerkClient()
  const user = await client.users.getUser(authResult.userId)
  const hasRole =
    hasStaffRoleInMetadata(user.publicMetadata) ||
    hasStaffRoleInMetadata(user.privateMetadata) ||
    hasStaffRoleInMetadata(user.unsafeMetadata)

  if (!hasRole) {
    return { ok: false, status: 403, error: "Insufficient staff role" }
  }

  return { ok: true, source: "clerk" }
}
