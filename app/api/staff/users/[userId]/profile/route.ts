import { NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { canAccessStaffPortalSection } from "@/lib/security/staff-access"
import {
  applyStaffRoleToMetadata,
  extractStaffRoleFromUserMetadata,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/security/staff-role"
import {
  applyStaffCategoryToMetadata,
  extractStaffCategoryFromUserMetadata,
  parseStaffCategory,
  STAFF_CATEGORIES,
  type StaffCategory,
} from "@/lib/security/staff-category"
import {
  createStaffRoleAudit,
  extractStaffRoleSnapshot,
  syncStaffAccountFromClerkUser,
} from "@/lib/security/staff-account-sync"

export const runtime = "nodejs"

type StaffProfilePayload = {
  firstName: string
  lastName: string
  birthDate: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  personalNote: string
  location: string
  gallery: string[]
  role: StaffRole
  category: StaffCategory
  pin: string
  clearPin: boolean
}

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

const safeText = (value: unknown, max = 120) => {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, max)
}

const asNumber = (value: unknown): number | null => {
  if (typeof value !== "number") return null
  return Number.isFinite(value) ? value : null
}

const asWeekday = (value: unknown): number | null => {
  if (typeof value !== "number") return null
  if (!Number.isInteger(value)) return null
  if (value < 0 || value > 6) return null
  return value
}

const asPayrollStatus = (value: unknown): "paid" | "pending" | null =>
  value === "paid" || value === "pending" ? value : null

const asArrayWeekdays = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  const out = value
    .map((day) => (typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6 ? day : null))
    .filter((day): day is number => day !== null)
  return Array.from(new Set(out)).sort((a, b) => a - b)
}

const asCourseSlugs = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
  return Array.from(new Set(items)).slice(0, 10)
}

const asTimeValue = (value: unknown): string => {
  if (typeof value !== "string") return ""
  const normalized = value.trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized) ? normalized : ""
}

const parseIsoMs = (value: unknown): number | null => {
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

const PRESENCE_MAX_AGE_MS = 16 * 60 * 60 * 1000
const PRESENCE_ONLINE_MAX_AGE_MS = 30 * 60 * 1000
const RECENT_SIGN_IN_MAX_AGE_MS = 2 * 60 * 60 * 1000

const safeGallery = (value: unknown, max = 6) => {
  if (!Array.isArray(value)) return [] as string[]
  const out: string[] = []
  for (const entry of value) {
    if (typeof entry !== "string") continue
    const trimmed = entry.trim().slice(0, 500)
    if (!trimmed) continue
    try {
      const parsed = new URL(trimmed)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue
      const url = parsed.toString()
      if (!out.includes(url)) out.push(url)
      if (out.length >= max) break
    } catch {
      // skip invalid URL
    }
  }
  return out
}

const hashPin = (pin: string) => {
  const salt = randomBytes(16).toString("hex")
  const hash = createHash("sha256")
    .update(`${pin}:${salt}:${process.env.CLERK_SECRET_KEY || "staff-pin"}`)
    .digest("hex")
  return `${salt}:${hash}`
}

const isValidPinHash = (pin: string, pinHash: string) => {
  const parts = pinHash.split(":")
  if (parts.length !== 2) return false
  const [salt, expectedHash] = parts
  if (!salt || !expectedHash) return false
  const nextHash = createHash("sha256")
    .update(`${pin}:${salt}:${process.env.CLERK_SECRET_KEY || "staff-pin"}`)
    .digest("hex")
  return nextHash === expectedHash
}

const STAFF_SCAN_PAGE_SIZE = 100
const STAFF_SCAN_MAX_USERS = 5000

const parseRole = (value: unknown): StaffRole | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return STAFF_ROLES.includes(normalized as StaffRole) ? (normalized as StaffRole) : null
}

const normalizeCategoryForRole = (role: StaffRole, category: StaffCategory): StaffCategory => {
  if (role === "owner") return "partner"
  if (role === "admin") return "manager"
  return category
}

const toResponsePayload = (user: {
  id: string
  firstName?: string | null
  lastName?: string | null
  imageUrl?: string | null
  lastSignInAt?: number | null
  publicMetadata?: unknown
  privateMetadata?: unknown
}, options?: { hasActiveSession?: boolean }) => {
  const publicMetadata = asObject(user.publicMetadata)
  const privateMetadata = asObject(user.privateMetadata)
  const profile = asObject(publicMetadata.staffProfile)
  const performance = asObject(publicMetadata.staffPerformance)
  const payroll = asObject(publicMetadata.staffPayroll)
  const teaching = asObject(publicMetadata.staffTeaching)
  const role = extractStaffRoleFromUserMetadata(user)
  const category = extractStaffCategoryFromUserMetadata(user)
  const hasActiveSession = Boolean(options?.hasActiveSession)
  const now = Date.now()
  const staffLastCheckInAtMs = parseIsoMs(privateMetadata.staffLastCheckInAt)
  const presenceStatus = typeof privateMetadata.staffPresenceStatus === "string" ? privateMetadata.staffPresenceStatus : null
  const presenceUpdatedAtMs = parseIsoMs(privateMetadata.staffPresenceUpdatedAt)
  const forcedOffline =
    !hasActiveSession &&
    presenceStatus === "offline" &&
    Boolean(presenceUpdatedAtMs && now - presenceUpdatedAtMs <= PRESENCE_MAX_AGE_MS)
  const onlineByPresence =
    presenceStatus === "online" && Boolean(presenceUpdatedAtMs && now - presenceUpdatedAtMs <= PRESENCE_ONLINE_MAX_AGE_MS)
  const onlineByRecentCheckIn =
    Boolean(staffLastCheckInAtMs && now - staffLastCheckInAtMs <= PRESENCE_ONLINE_MAX_AGE_MS)
  const lastSignInAtMs = typeof user.lastSignInAt === "number" && Number.isFinite(user.lastSignInAt) ? user.lastSignInAt : null
  const onlineByRecentSignIn = Boolean(lastSignInAtMs && now - lastSignInAtMs <= RECENT_SIGN_IN_MAX_AGE_MS)
  const online = hasActiveSession ? true : forcedOffline ? false : onlineByPresence || onlineByRecentCheckIn || onlineByRecentSignIn
  return {
    id: user.id,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    imageUrl: user.imageUrl || "",
    profile: {
      birthDate: safeText(profile.birthDate, 40),
      addressLine1: safeText(profile.addressLine1, 150),
      addressLine2: safeText(profile.addressLine2, 150),
      city: safeText(profile.city, 80),
      state: safeText(profile.state, 80),
      postalCode: safeText(profile.postalCode, 24),
      country: safeText(profile.country, 80),
      personalNote: safeText(profile.personalNote, 600),
      location: safeText(publicMetadata.staffLocation, 120),
      gallery: safeGallery(profile.gallery),
    },
    role,
    category,
    hasPin: typeof privateMetadata.staffPinHash === "string" && privateMetadata.staffPinHash.length > 0,
    metrics: {
      performanceRating: asNumber(performance.rating),
      performanceReviewsCount: asNumber(performance.reviewsCount),
      performanceReviewCycleDays: asNumber(performance.reviewCycleDays),
      payrollHoursWorked: asNumber(payroll.hoursWorked),
      payrollHourlyRate: asNumber(payroll.hourlyRate),
      payrollStatus: asPayrollStatus(payroll.status),
      payrollPaydayWeekday: asWeekday(payroll.paydayWeekday),
    },
    presence: {
      online,
      lastSignInAt: lastSignInAtMs,
      staffLastCheckInAt: staffLastCheckInAtMs ? new Date(staffLastCheckInAtMs).toISOString() : null,
      status: presenceStatus === "online" || presenceStatus === "offline" ? presenceStatus : null,
      updatedAt: presenceUpdatedAtMs ? new Date(presenceUpdatedAtMs).toISOString() : null,
    },
    teaching: {
      teacherCourseSlugs: asCourseSlugs(teaching.courseSlugs),
      teacherWeekdays: asArrayWeekdays(teaching.weekdays),
      teacherShiftStart: asTimeValue(teaching.shiftStart),
      teacherShiftEnd: asTimeValue(teaching.shiftEnd),
    },
  }
}

export async function GET(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:users:profile:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  if (!authResult.role) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }
  const isSelfRequest = authResult.userId === userId
  const canManageProfiles = canAccessStaffPortalSection(authResult.role, authResult.category, "users")
  if (!isSelfRequest && !canManageProfiles) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  let hasActiveSession = false
  try {
    const sessions = await client.sessions.getSessionList({
      userId,
      status: "active",
      limit: 1,
    })
    hasActiveSession = sessions.data.length > 0
  } catch {
    hasActiveSession = false
  }
  const targetRole = extractStaffRoleFromUserMetadata(user)
  if (!isSelfRequest && authResult.role !== "owner" && targetRole === "owner") {
    return NextResponse.json({ error: "Admins cannot access Owner profile." }, { status: 403 })
  }
  const canEditRole =
    !isSelfRequest && (authResult.role === "owner" || (authResult.role === "admin" && authResult.category === "manager"))

  return NextResponse.json({
    user: toResponsePayload(user, { hasActiveSession }),
    canEditRole,
    supportedRoles: STAFF_ROLES,
    supportedCategories: STAFF_CATEGORIES,
  })
}

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:users:profile:patch", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalBaseRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }
  if (!authResult.role) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }
  const isSelfRequest = authResult.userId === userId
  const canManageProfiles = canAccessStaffPortalSection(authResult.role, authResult.category, "users")
  if (!isSelfRequest && !canManageProfiles) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Partial<StaffProfilePayload>
  const pin = safeText(payload.pin, 12)
  const clearPin = Boolean(payload.clearPin)
  if (pin && !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 })
  }

  const client = await clerkClient()
  const current = await client.users.getUser(userId)
  const previousState = extractStaffRoleSnapshot(current)
  const currentRole = extractStaffRoleFromUserMetadata(current)
  if (!isSelfRequest && authResult.role !== "owner" && currentRole === "owner") {
    return NextResponse.json({ error: "Admins cannot update Owner profile." }, { status: 403 })
  }
  const publicMetadata = asObject(current.publicMetadata)
  const privateMetadata = asObject(current.privateMetadata)
  const currentProfile = asObject(publicMetadata.staffProfile)

  const nextProfile = {
    ...currentProfile,
    birthDate: safeText(payload.birthDate, 40),
    addressLine1: safeText(payload.addressLine1, 150),
    addressLine2: safeText(payload.addressLine2, 150),
    city: safeText(payload.city, 80),
    state: safeText(payload.state, 80),
    postalCode: safeText(payload.postalCode, 24),
    country: safeText(payload.country, 80),
    personalNote: safeText(payload.personalNote, 600),
    gallery: safeGallery(payload.gallery),
  }

  const nextPublicMetadata: Record<string, unknown> = {
    ...publicMetadata,
    staffProfile: nextProfile,
    staffLocation: safeText(payload.location, 120),
  }

  const canEditRole =
    !isSelfRequest && (authResult.role === "owner" || (authResult.role === "admin" && authResult.category === "manager"))
  if (canEditRole) {
    const parsedRole = parseRole(payload.role)
    const parsedCategory = parseStaffCategory(payload.category)
    if (parsedRole && parsedCategory) {
      if (authResult.role !== "owner" && parsedRole === "owner") {
        return NextResponse.json({ error: "Only Owner can assign Owner role." }, { status: 403 })
      }
      const withRole = applyStaffRoleToMetadata(nextPublicMetadata, parsedRole)
      Object.assign(nextPublicMetadata, applyStaffCategoryToMetadata(withRole, normalizeCategoryForRole(parsedRole, parsedCategory)))
    }
  }
  const nextPrivateMetadata: Record<string, unknown> = { ...privateMetadata }

  if (clearPin) {
    delete nextPrivateMetadata.staffPinHash
    delete nextPrivateMetadata.staffPinUpdatedAt
  } else if (pin) {
    for (let offset = 0; offset < STAFF_SCAN_MAX_USERS; offset += STAFF_SCAN_PAGE_SIZE) {
      const page = await client.users.getUserList({
        limit: STAFF_SCAN_PAGE_SIZE,
        offset,
      })

      const duplicate = page.data.find((candidate) => {
        if (candidate.id === userId) return false
        const candidatePrivateMetadata = asObject(candidate.privateMetadata)
        const candidateHash =
          typeof candidatePrivateMetadata.staffPinHash === "string" ? candidatePrivateMetadata.staffPinHash : ""
        if (!candidateHash) return false
        return isValidPinHash(pin, candidateHash)
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "PIN already in use by another staff user. Choose a unique 4-digit PIN." },
          { status: 409 }
        )
      }

      if (page.data.length < STAFF_SCAN_PAGE_SIZE) {
        break
      }
    }

    nextPrivateMetadata.staffPinHash = hashPin(pin)
    nextPrivateMetadata.staffPinUpdatedAt = new Date().toISOString()
  }

  const firstName = safeText(payload.firstName, 80)
  const lastName = safeText(payload.lastName, 80)

  await client.users.updateUser(userId, {
    firstName: firstName || current.firstName || undefined,
    lastName: lastName || current.lastName || undefined,
  })

  const updated = await client.users.updateUserMetadata(userId, {
    publicMetadata: nextPublicMetadata,
    privateMetadata: nextPrivateMetadata,
  })
  await syncStaffAccountFromClerkUser(updated, {
    source: "staff_profile_patch",
    allowWithoutRole: true,
  })
  const nextState = extractStaffRoleSnapshot(updated)
  if (previousState.role !== nextState.role || previousState.category !== nextState.category) {
    await createStaffRoleAudit({
      staffClerkUserId: updated.id,
      actorClerkUserId: authResult.userId,
      actorRole: authResult.role,
      action: "profile_role_update",
      previousRole: previousState.role,
      nextRole: nextState.role || "removed",
      previousCategory: previousState.category,
      nextCategory: nextState.category,
      metadata: { via: "staff/users/[userId]/profile PATCH" },
    })
  }

  return NextResponse.json({
    ok: true,
    canEditRole,
    supportedRoles: STAFF_ROLES,
    supportedCategories: STAFF_CATEGORIES,
    user: toResponsePayload(updated),
  })
}
