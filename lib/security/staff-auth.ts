import { auth, clerkClient } from "@clerk/nextjs/server"
import { timingSafeEqual } from "crypto"
import { hasStaffRoleInClaims, hasStaffRoleInUserMetadata } from "@/lib/security/staff-role"

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

export type StaffAuthResult =
  | { ok: true; source: "token" | "clerk" }
  | { ok: false; status: number; error: string }

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

  if (hasStaffRoleInClaims(authResult.sessionClaims)) {
    return { ok: true, source: "clerk" }
  }

  const client = await clerkClient()
  const user = await client.users.getUser(authResult.userId)
  const hasRole = hasStaffRoleInUserMetadata(user)

  if (!hasRole) {
    return { ok: false, status: 403, error: "Insufficient staff role" }
  }

  return { ok: true, source: "clerk" }
}
