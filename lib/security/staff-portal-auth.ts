import { auth, clerkClient } from "@clerk/nextjs/server"
import {
  extractStaffRoleFromClaims,
  extractStaffRoleFromUserMetadata,
  isStaffAdminRole,
  type StaffRole,
} from "@/lib/security/staff-role"
import {
  extractStaffCategoryFromClaims,
  extractStaffCategoryFromUserMetadata,
  type StaffCategory,
} from "@/lib/security/staff-category"

export type StaffPortalAuthResult =
  | { ok: true; userId: string; role: StaffRole; category: StaffCategory | null }
  | { ok: false; status: number; error: string }

export type StaffPortalBaseAuthResult =
  | { ok: true; userId: string; role: StaffRole | null; category: StaffCategory | null }
  | { ok: false; status: number; error: string }

const STAFF_SCAN_PAGE_SIZE = 100
const STAFF_SCAN_MAX_USERS = 5000

export const hasAnyStaffAdmin = async () => {
  const client = await clerkClient()
  for (let offset = 0; offset < STAFF_SCAN_MAX_USERS; offset += STAFF_SCAN_PAGE_SIZE) {
    const page = await client.users.getUserList({
      limit: STAFF_SCAN_PAGE_SIZE,
      offset,
    })
    for (const user of page.data) {
      if (isStaffAdminRole(extractStaffRoleFromUserMetadata(user))) {
        return true
      }
    }
    if (page.data.length < STAFF_SCAN_PAGE_SIZE) {
      break
    }
  }
  return false
}

const canManageStaffPortal = (role: StaffRole | null | undefined, category: StaffCategory | null | undefined) =>
  role === "owner" || (isStaffAdminRole(role) && category === "manager")

export const authorizeStaffPortalBaseRequest = async (): Promise<StaffPortalBaseAuthResult> => {
  const authResult = await auth()
  if (!authResult.userId) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const client = await clerkClient()
  const user = await client.users.getUser(authResult.userId)

  const claimRole = extractStaffRoleFromClaims(authResult.sessionClaims)
  const claimCategory = extractStaffCategoryFromClaims(authResult.sessionClaims)
  const metadataRole = extractStaffRoleFromUserMetadata(user)
  const metadataCategory = extractStaffCategoryFromUserMetadata(user)

  return {
    ok: true,
    userId: authResult.userId,
    role: metadataRole || claimRole,
    category: metadataCategory || claimCategory,
  }
}

export const authorizeStaffPortalRequest = async (): Promise<StaffPortalAuthResult> => {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) return authResult
  if (!canManageStaffPortal(authResult.role, authResult.category)) {
    return { ok: false, status: 403, error: "Insufficient role" }
  }
  return { ok: true, userId: authResult.userId, role: authResult.role as StaffRole, category: authResult.category }
}
