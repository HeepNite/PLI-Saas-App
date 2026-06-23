import { auth, clerkClient } from "@clerk/nextjs/server"
import { timingSafeEqual } from "crypto"
import { hasStaffRoleInUserMetadata, STAFF_ROLES, type StaffRole } from "@/lib/security/staff-role"
import { prisma } from "@/lib/prisma"
import { asObject } from "@/lib/shared"

const timingSafeTokenEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left, "utf8")
  const rightBuffer = Buffer.from(right, "utf8")
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

const hasValidServiceToken = (req: Request) => {
  const expected = process.env.STAFF_CHECKIN_TOKEN
  if (!expected) return false
  const incoming = req.headers.get("x-staff-token")
  return incoming ? timingSafeTokenEqual(incoming, expected) : false
}

const parseSessionIssuedAtMs = (claims: unknown): number | null => {
  if (!claims || typeof claims !== "object") return null
  const maybe = (claims as Record<string, unknown>).iat
  if (typeof maybe !== "number" || !Number.isFinite(maybe)) return null
  return Math.floor(maybe * 1000)
}

const parseForcedLogoutAtMs = (privateMetadata: unknown): number | null => {
  const value = asObject(privateMetadata).staffForceLogoutAt
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value)
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export type StaffAuthResult =
  | { ok: true; source: "token" | "clerk" }
  | { ok: false; status: number; error: string }

const STAFF_ROLE_SET = new Set<StaffRole>(STAFF_ROLES)

const parseDbRole = (value: unknown): StaffRole | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return STAFF_ROLE_SET.has(normalized as StaffRole) ? (normalized as StaffRole) : null
}

export const authorizeStaffRequest = async (req: Request): Promise<StaffAuthResult> => {
  const expectedToken = process.env.STAFF_CHECKIN_TOKEN
  const incomingToken = req.headers.get("x-staff-token")

  if (hasValidServiceToken(req)) {
    return { ok: true, source: "token" }
  }
  if (expectedToken && incomingToken && !timingSafeTokenEqual(incomingToken, expectedToken)) {
    return { ok: false, status: 401, error: "Unauthorized staff request" }
  }

  const authResult = await auth()
  if (!authResult.userId) {
    return { ok: false, status: 401, error: "Unauthorized staff request" }
  }

  const client = await clerkClient()
  const user = await client.users.getUser(authResult.userId)
  const sessionIssuedAtMs = parseSessionIssuedAtMs(authResult.sessionClaims)
  const forcedLogoutAtMs = parseForcedLogoutAtMs(user.privateMetadata)
  if (forcedLogoutAtMs && sessionIssuedAtMs && sessionIssuedAtMs <= forcedLogoutAtMs) {
    return { ok: false, status: 401, error: "Unauthorized staff request" }
  }
  let hasRole = hasStaffRoleInUserMetadata(user)
  if (!hasRole) {
    try {
      const mirrored = await prisma.staffAccount.findUnique({
        where: { clerkUserId: authResult.userId },
        select: { role: true },
      })
      hasRole = Boolean(parseDbRole(mirrored?.role))
    } catch (error) {
      console.warn("authorizeStaffRequest: failed to read staff mirror, continuing with Clerk metadata", error)
    }
  }

  if (!hasRole) {
    return { ok: false, status: 403, error: "Insufficient staff role" }
  }

  return { ok: true, source: "clerk" }
}
