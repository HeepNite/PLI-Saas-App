import { clerkClient } from "@clerk/nextjs/server"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { resolveSchoolIdFromUser } from "@/lib/security/staff-school"

const ROSTER_SCAN_PAGE_SIZE = 100
const ROSTER_SCAN_MAX_USERS = 5000

export type StaffRosterEntry = {
  id: string
  displayName: string
  role: string
}

/**
 * Lists active staff scoped to `schoolId` with MINIMAL fields only
 * (id, displayName, role — no phone/email). Used by:
 *  - GET /api/staff/terminal/roster (design v5: terminal login/pin picker)
 *  - both PIN routes, to derive the real `activeRosterSize` for
 *    `computeTerminalTargetedCap` (design ADR 15), replacing the PR2 fixed
 *    `TERMINAL_TARGETED_BASE_CAP` literal.
 *
 * Fail-closed on `schoolId`: an empty/falsy schoolId returns an EMPTY
 * roster and never falls back to an unscoped Clerk user-list scan.
 */
export const listStaffRosterForSchool = async (schoolId: string): Promise<StaffRosterEntry[]> => {
  if (!schoolId) return []

  const client = await clerkClient()
  const roster: StaffRosterEntry[] = []

  for (let offset = 0; offset < ROSTER_SCAN_MAX_USERS; offset += ROSTER_SCAN_PAGE_SIZE) {
    const page = await client.users.getUserList({ limit: ROSTER_SCAN_PAGE_SIZE, offset })

    for (const user of page.data) {
      const role = extractStaffRoleFromUserMetadata(user)
      if (!role) continue
      if (resolveSchoolIdFromUser(user) !== schoolId) continue

      const displayName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.primaryEmailAddress?.emailAddress ||
        user.id

      roster.push({ id: user.id, displayName, role })
    }

    if (page.data.length < ROSTER_SCAN_PAGE_SIZE) break
  }

  return roster
}
