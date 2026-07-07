import { clerkClient } from "@clerk/nextjs/server"
import { extractStaffCategoryFromUserMetadata } from "@/lib/security/staff-category"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { isValidPinHash } from "@/lib/security/staff-pin-hash"
import { resolveSchoolIdFromUser } from "@/lib/security/staff-school"
import { asObject } from "@/lib/shared"

const STAFF_SCAN_PAGE_SIZE = 100
const STAFF_SCAN_MAX_USERS = 5000

export type MatchedStaffUser = {
  user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>>
  role: string
  category: ReturnType<typeof extractStaffCategoryFromUserMetadata>
}

type ResolveStaffUserByPinInput = {
  pin: string
  /**
   * Server-derived school scope (terminal.schoolId for TERMINAL context; the
   * owner's own Clerk-metadata school for PERSONAL/CLERK_SESSION context).
   * MANDATORY — never sourced from the request payload. Enforced BEFORE any
   * hash compare (design v5 ADR 14).
   */
  expectedSchoolId: string
  /**
   * When set, resolution is restricted to exactly this Clerk user id — no
   * other user's hash is ever fetched or compared. This is the ONLY
   * client-influenced targeting left after the removal of `preferredUserId`
   * (design v5 — the old "try preferred, else scan everyone" fallback path
   * is gone).
   */
  restrictToUserId?: string
}

export const resolveStaffUserByPin = async ({
  pin,
  expectedSchoolId,
  restrictToUserId = "",
}: ResolveStaffUserByPinInput): Promise<
  { ok: true; staff: MatchedStaffUser } | { ok: false; status: number; error: string }
> => {
  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, status: 400, error: "PIN must be exactly 4 digits." }
  }

  if (!expectedSchoolId) {
    return { ok: false, status: 403, error: "School context could not be resolved." }
  }

  const client = await clerkClient()

  if (restrictToUserId) {
    let selectedUser: Awaited<ReturnType<typeof client.users.getUser>> | null = null
    try {
      selectedUser = await client.users.getUser(restrictToUserId)
    } catch {
      return { ok: false, status: 404, error: "Selected staff user was not found." }
    }

    const role = extractStaffRoleFromUserMetadata(selectedUser)
    if (!role) {
      return { ok: false, status: 400, error: "Selected user is not a staff member." }
    }

    // Server-derived school scope is enforced BEFORE any hash compare — a
    // wrong-school request never reaches isValidPinHash, regardless of
    // whether the submitted PIN would otherwise have matched.
    const userSchoolId = resolveSchoolIdFromUser(selectedUser)
    if (userSchoolId !== expectedSchoolId) {
      return {
        ok: false,
        status: 403,
        error: "Staff member does not belong to the requested school context.",
      }
    }

    const privateMetadata = asObject(selectedUser.privateMetadata)
    const pinHash = typeof privateMetadata.staffPinHash === "string" ? privateMetadata.staffPinHash : ""
    if (!pinHash) {
      return { ok: false, status: 400, error: "Selected user has no PIN configured." }
    }

    if (!isValidPinHash(pin, pinHash)) {
      return { ok: false, status: 401, error: "Invalid PIN." }
    }

    const category = extractStaffCategoryFromUserMetadata(selectedUser)
    return { ok: true, staff: { user: selectedUser, role, category } }
  }

  // Scan-all mode: restricted to the server-derived school BEFORE any hash
  // compare. A candidate outside expectedSchoolId is skipped entirely — its
  // hash is never touched, even if it would have matched the submitted PIN.
  const pinMatches: Array<{
    user: Awaited<ReturnType<typeof client.users.getUser>>
    role: string
  }> = []

  for (let offset = 0; offset < STAFF_SCAN_MAX_USERS; offset += STAFF_SCAN_PAGE_SIZE) {
    const page = await client.users.getUserList({
      limit: STAFF_SCAN_PAGE_SIZE,
      offset,
    })

    for (const user of page.data) {
      const role = extractStaffRoleFromUserMetadata(user)
      if (!role) continue

      const userSchoolId = resolveSchoolIdFromUser(user)
      if (userSchoolId !== expectedSchoolId) continue

      const privateMetadata = asObject(user.privateMetadata)
      const pinHash = typeof privateMetadata.staffPinHash === "string" ? privateMetadata.staffPinHash : ""
      if (!pinHash) continue

      if (!isValidPinHash(pin, pinHash)) continue
      if (!pinMatches.some((entry) => entry.user.id === user.id)) {
        pinMatches.push({ user, role })
      }
    }

    if (page.data.length < STAFF_SCAN_PAGE_SIZE) break
  }

  if (pinMatches.length === 0) {
    return { ok: false, status: 401, error: "Invalid PIN." }
  }
  if (pinMatches.length > 1) {
    return {
      ok: false,
      status: 409,
      error: "This PIN is assigned to multiple staff users. Set unique PINs before using PIN sign-in.",
    }
  }

  const { user: matchedUser, role: matchedRole } = pinMatches[0]!
  const category = extractStaffCategoryFromUserMetadata(matchedUser)
  return { ok: true, staff: { user: matchedUser, role: matchedRole, category } }
}
