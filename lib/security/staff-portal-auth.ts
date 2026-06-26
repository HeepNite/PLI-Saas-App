import { auth, clerkClient } from "@clerk/nextjs/server"
import {
  extractStaffRoleFromUserMetadata,
  isStaffAdminRole,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/security/staff-role"
import { asObject } from "@/lib/shared"
import {
  extractStaffCategoryFromUserMetadata,
  parseStaffCategory,
  type StaffCategory,
} from "@/lib/security/staff-category"
import {
  canAccessStaffPortalSection,
  canOperateStudentEdits,
  hasExplicitStaffPermission,
  type StaffPermission,
  type StaffPortalSection,
} from "@/lib/security/staff-access"
import { prisma } from "@/lib/prisma"
import { getCachedClerkUser } from "@/lib/clerk-users"

const isClerkRateLimitError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false
  const status = (error as { status?: number }).status
  return status === 429
}

const extractRetryAfterSec = (error: unknown): number => {
  if (!error || typeof error !== "object") return 5
  const retryAfter = (error as { headers?: Record<string, string> }).headers?.["retry-after"]
  if (retryAfter) {
    const parsed = Number(retryAfter)
    if (Number.isFinite(parsed) && parsed > 0) return Math.ceil(parsed)
  }
  return 5
}

export type StaffPortalAuthResult =
  | { ok: true; userId: string; role: StaffRole; category: StaffCategory | null; staffName: string | null }
  | { ok: false; status: number; error: string; retryAfterSec?: number }

export type StaffPortalBaseAuthResult =
  | { ok: true; userId: string; role: StaffRole | null; category: StaffCategory | null; staffName: string | null }
  | { ok: false; status: number; error: string; retryAfterSec?: number }

const STAFF_SCAN_PAGE_SIZE = 100
const STAFF_SCAN_MAX_USERS = 5000
const STAFF_ROLE_SET = new Set<StaffRole>(STAFF_ROLES)


const parseSessionIssuedAtMs = (claims: unknown): number | null => {
  if (!claims || typeof claims !== "object") return null
  const maybe = (claims as Record<string, unknown>).iat
  if (typeof maybe !== "number" || !Number.isFinite(maybe)) return null
  // Clerk iat claim is unix seconds.
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

const parseDbRole = (value: unknown): StaffRole | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return STAFF_ROLE_SET.has(normalized as StaffRole) ? (normalized as StaffRole) : null
}

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

  let user
  try {
    user = await getCachedClerkUser(authResult.userId)
  } catch (error) {
    if (isClerkRateLimitError(error)) {
      const retryAfterSec = extractRetryAfterSec(error)
      return { ok: false, status: 503, error: "Service temporarily busy. Please try again shortly.", retryAfterSec }
    }
    // Other Clerk errors (5xx, network) → transient failure
    if (error && typeof error === "object" && typeof (error as { status?: number }).status === "number") {
      const status = (error as { status: number }).status
      if (status >= 500 && status < 600) {
        return { ok: false, status: 503, error: "Service temporarily unavailable. Please try again shortly.", retryAfterSec: 5 }
      }
    }
    throw error
  }

  let metadataRole = extractStaffRoleFromUserMetadata(user)
  let metadataCategory = extractStaffCategoryFromUserMetadata(user)
  if (!metadataRole || !metadataCategory) {
    try {
      const mirrored = await prisma.staffAccount.findUnique({
        where: { clerkUserId: authResult.userId },
        select: { role: true, category: true },
      })
      if (!metadataRole) metadataRole = parseDbRole(mirrored?.role)
      if (!metadataCategory) metadataCategory = parseStaffCategory(mirrored?.category)
    } catch (error) {
      console.warn("authorizeStaffPortalBaseRequest: failed to read staff mirror, continuing with Clerk metadata", error)
    }
  }
  const sessionIssuedAtMs = parseSessionIssuedAtMs(authResult.sessionClaims)
  const forcedLogoutAtMs = parseForcedLogoutAtMs(user.privateMetadata)
  if (forcedLogoutAtMs && sessionIssuedAtMs && sessionIssuedAtMs <= forcedLogoutAtMs) {
    return { ok: false, status: 401, error: "Staff session expired" }
  }

  // Build staff display name from Clerk user data
  const staffName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.emailAddresses?.[0]?.emailAddress || null

  return {
    ok: true,
    userId: authResult.userId,
    role: metadataRole,
    category: metadataCategory,
    staffName,
  }
}

export const authorizeStaffPortalRequest = async (): Promise<StaffPortalAuthResult> => {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) return authResult
  if (!canManageStaffPortal(authResult.role, authResult.category)) {
    return { ok: false, status: 403, error: "Insufficient role" }
  }
  return { ok: true, userId: authResult.userId, role: authResult.role as StaffRole, category: authResult.category, staffName: authResult.staffName }
}

export const authorizeStaffPortalSectionRequest = async (
  section: StaffPortalSection
): Promise<StaffPortalAuthResult> => {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) return authResult
  if (!authResult.role) {
    return { ok: false, status: 403, error: "Insufficient role" }
  }
  if (!canAccessStaffPortalSection(authResult.role, authResult.category, section)) {
    return { ok: false, status: 403, error: "Insufficient role" }
  }
  return { ok: true, userId: authResult.userId, role: authResult.role, category: authResult.category, staffName: authResult.staffName }
}

export const authorizeOwnerRequest = async (): Promise<StaffPortalAuthResult> => {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) return authResult
  if (authResult.role !== "owner") {
    return { ok: false, status: 403, error: "Owner role required" }
  }

  return { ok: true, userId: authResult.userId, role: authResult.role, category: authResult.category, staffName: authResult.staffName }
}

/**
 * Authorize requests that require owner OR admin role.
 * Uses `isStaffAdminRole()` internally to allow both owner and admin.
 */
export const authorizeOwnerOrAdminRequest = async (): Promise<StaffPortalAuthResult> => {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) return authResult
  if (!isStaffAdminRole(authResult.role)) {
    return { ok: false, status: 403, error: "Owner or Admin role required" }
  }

  return { ok: true, userId: authResult.userId, role: authResult.role as StaffRole, category: authResult.category, staffName: authResult.staffName }
}

export const authorizeStaffPermissionRequest = async (permission: StaffPermission): Promise<StaffPortalAuthResult> => {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) return authResult
  if (!authResult.role || !hasExplicitStaffPermission(authResult.role, authResult.category, permission)) {
    return { ok: false, status: 403, error: "Insufficient role" }
  }
  return { ok: true, userId: authResult.userId, role: authResult.role, category: authResult.category, staffName: authResult.staffName }
}

/**
 * Authorize requests that require student operational permission:
 * owner, admin, or staff with front_desk category (including guest front_desk).
 *
 * Intentionally narrower than full users-section access. Use this for the
 * student profile GET/PATCH and the override modal flows instead of granting
 * broad staff-management rights to front-desk callers.
 */
export const authorizeStudentOperationalRequest = async (): Promise<StaffPortalAuthResult> => {
  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) return authResult
  if (!authResult.role || !canOperateStudentEdits(authResult.role, authResult.category)) {
    return { ok: false, status: 403, error: "Insufficient role" }
  }
  return { ok: true, userId: authResult.userId, role: authResult.role, category: authResult.category, staffName: authResult.staffName }
}
