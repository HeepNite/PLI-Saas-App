import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
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
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import {
  createStaffRoleAudit,
  extractStaffRoleSnapshot,
  syncStaffAccountFromClerkUser,
} from "@/lib/security/staff-account-sync"

export const runtime = "nodejs"

type StaffListItem = {
  id: string
  email: string
  phone: string
  avatarUrl: string
  location: string
  hasPin: boolean
  firstName: string
  lastName: string
  role: StaffRole
  category: StaffCategory
  payrollHoursWorked: number | null
  payrollHourlyRate: number | null
  payrollStatus: "paid" | "pending" | null
  payrollPaydayWeekday: number | null
  payrollDelayEntries: Array<{
    id: string
    dateLabel: string
    expectedTime: string
    actualTime: string
    delayMinutes: number
  }>
  performanceRating: number | null
  performanceReviewsCount: number | null
  performanceReviewCycleDays: number | null
  teacherType: string
  teacherAssignedUserId: string
  teacherRecurrenceUnit: "month" | "year"
  teacherRecurrenceInterval: number | null
  teacherCourseSlugs: string[]
  teacherWeekdays: number[]
  teacherShiftStart: string
  teacherShiftEnd: string
  teacherWeeklyHours: number | null
  teacherBonusTargetHours: number | null
  banned: boolean
  locked: boolean
  online: boolean
  lastActiveAt: number | null
  staffLastCheckInAt: number | null
  createdAt: number
  lastSignInAt: number | null
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

const asNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

const asArrayWeekdays = (value: unknown): number[] => {
  if (!Array.isArray(value)) return []
  const out = value
    .map((day) => (typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6 ? day : null))
    .filter((day): day is number => day !== null)
  return Array.from(new Set(out)).sort((a, b) => a - b)
}

const asTimeValue = (value: unknown): string => {
  if (typeof value !== "string") return ""
  const normalized = value.trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized) ? normalized : ""
}

const asSafeShortText = (value: unknown, max = 80): string => {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, max)
}

const asWeekday = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value)) return null
  if (value < 0 || value > 6) return null
  return value
}

const asRecurrenceUnit = (value: unknown): "month" | "year" => {
  if (value === "year") return "year"
  return "month"
}

const asRecurrenceInterval = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  if (rounded < 1 || rounded > 12) return null
  return rounded
}

const asCourseSlugs = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
  return Array.from(new Set(items)).slice(0, 10)
}

const asDelayEntries = (
  value: unknown
): Array<{ id: string; dateLabel: string; expectedTime: string; actualTime: string; delayMinutes: number }> => {
  if (!Array.isArray(value)) return []
  return value
    .map((entry, index) => {
      const row = asObject(entry)
      const idValue = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `delay-${index}`
      const dateLabel = typeof row.dateLabel === "string" ? row.dateLabel.trim() : ""
      const expectedTime = typeof row.expectedTime === "string" ? row.expectedTime.trim() : ""
      const actualTime = typeof row.actualTime === "string" ? row.actualTime.trim() : ""
      const delayMinutes =
        typeof row.delayMinutes === "number" && Number.isFinite(row.delayMinutes) ? Math.max(0, Math.round(row.delayMinutes)) : 0
      if (!dateLabel || !expectedTime || !actualTime) return null
      return {
        id: idValue,
        dateLabel,
        expectedTime,
        actualTime,
        delayMinutes,
      }
    })
    .filter((entry): entry is { id: string; dateLabel: string; expectedTime: string; actualTime: string; delayMinutes: number } => Boolean(entry))
}

const sanitizeName = (value: unknown, max = 80) => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return undefined
  return trimmed
}

const PRESENCE_MAX_AGE_MS = 16 * 60 * 60 * 1000
const PRESENCE_ONLINE_MAX_AGE_MS = 30 * 60 * 1000
const RECENT_SIGN_IN_MAX_AGE_MS = 2 * 60 * 60 * 1000
const VERIFY_SESSION_ACTIVE_WINDOW_MS = 72 * 60 * 60 * 1000

const shouldVerifyUserActiveSession = (user: {
  lastActiveAt?: number | null
  privateMetadata?: unknown
}) => {
  const now = Date.now()
  const privateMetadata = asObject(user.privateMetadata)
  const presenceStatus =
    typeof privateMetadata.staffPresenceStatus === "string" ? privateMetadata.staffPresenceStatus : null
  const presenceUpdatedRaw =
    typeof privateMetadata.staffPresenceUpdatedAt === "string" ? privateMetadata.staffPresenceUpdatedAt : ""
  const parsedPresenceUpdated = presenceUpdatedRaw ? Date.parse(presenceUpdatedRaw) : Number.NaN
  const presenceUpdatedAt = Number.isFinite(parsedPresenceUpdated) ? parsedPresenceUpdated : null
  const lastActiveAt =
    typeof user.lastActiveAt === "number" && Number.isFinite(user.lastActiveAt) ? user.lastActiveAt : null

  // If Clerk metadata marks online, always verify via per-user sessions endpoint.
  // The global sessions endpoint may be stale/incomplete for some tenants.
  if (presenceStatus === "online") {
    return true
  }
  if (lastActiveAt && now - lastActiveAt <= VERIFY_SESSION_ACTIVE_WINDOW_MS) {
    return true
  }
  if (presenceUpdatedAt && now - presenceUpdatedAt <= VERIFY_SESSION_ACTIVE_WINDOW_MS) {
    return true
  }
  return false
}

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items]
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const toStaffListItem = (user: {
  id: string
  firstName?: string | null
  lastName?: string | null
  banned?: boolean | null
  locked?: boolean | null
  createdAt?: number | null
  lastSignInAt?: number | null
  emailAddresses?: Array<{ emailAddress: string }>
  primaryEmailAddress?: { emailAddress: string } | null
  phoneNumbers?: Array<{ phoneNumber?: string | null }>
  primaryPhoneNumber?: { phoneNumber?: string | null } | null
  lastActiveAt?: number | null
  imageUrl?: string | null
  publicMetadata?: unknown
  privateMetadata?: unknown
  unsafeMetadata?: unknown
}, hasActiveSession: boolean): StaffListItem | null => {
  const role = extractStaffRoleFromUserMetadata(user)
  if (!role) return null
  const category = extractStaffCategoryFromUserMetadata(user) || "guest_staff"
  const primaryEmail =
    user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || ""
  const primaryPhone =
    user.primaryPhoneNumber?.phoneNumber || user.phoneNumbers?.[0]?.phoneNumber || ""
  const lastActiveAt =
    typeof user.lastActiveAt === "number" && Number.isFinite(user.lastActiveAt) ? user.lastActiveAt : null
  const publicMetadata = asObject(user.publicMetadata)
  const privateMetadata =
    user.privateMetadata && typeof user.privateMetadata === "object"
      ? (user.privateMetadata as Record<string, unknown>)
      : {}
  const lastSignInAt = typeof user.lastSignInAt === "number" && Number.isFinite(user.lastSignInAt) ? user.lastSignInAt : null
  const staffLastCheckInRaw = typeof privateMetadata.staffLastCheckInAt === "string" ? privateMetadata.staffLastCheckInAt : ""
  const parsedStaffCheckIn = staffLastCheckInRaw ? Date.parse(staffLastCheckInRaw) : Number.NaN
  const staffLastCheckInAt = Number.isFinite(parsedStaffCheckIn) ? parsedStaffCheckIn : null
  const presenceStatus = typeof privateMetadata.staffPresenceStatus === "string" ? privateMetadata.staffPresenceStatus : null
  const presenceUpdatedRaw = typeof privateMetadata.staffPresenceUpdatedAt === "string" ? privateMetadata.staffPresenceUpdatedAt : ""
  const parsedPresenceUpdated = presenceUpdatedRaw ? Date.parse(presenceUpdatedRaw) : Number.NaN
  const presenceUpdatedAt = Number.isFinite(parsedPresenceUpdated) ? parsedPresenceUpdated : null
  const now = Date.now()
  const forcedOffline =
    !hasActiveSession && presenceStatus === "offline" && Boolean(presenceUpdatedAt && now - presenceUpdatedAt <= PRESENCE_MAX_AGE_MS)
  const onlineByPresence =
    presenceStatus === "online" && Boolean(presenceUpdatedAt && now - presenceUpdatedAt <= PRESENCE_ONLINE_MAX_AGE_MS)
  const onlineByRecentCheckIn =
    Boolean(staffLastCheckInAt && now - staffLastCheckInAt <= PRESENCE_ONLINE_MAX_AGE_MS)
  const onlineByRecentSignIn = Boolean(lastSignInAt && now - lastSignInAt <= RECENT_SIGN_IN_MAX_AGE_MS)
  const online = hasActiveSession ? true : forcedOffline ? false : onlineByPresence || onlineByRecentCheckIn || onlineByRecentSignIn
  const payroll = asObject(publicMetadata.staffPayroll)
  const performance = asObject(publicMetadata.staffPerformance)
  const teaching = asObject(publicMetadata.staffTeaching)
  const location = typeof publicMetadata.staffLocation === "string" ? publicMetadata.staffLocation.trim() : ""
  return {
    id: user.id,
    email: primaryEmail,
    phone: primaryPhone,
    avatarUrl: user.imageUrl || "",
    location: location || "—",
    hasPin: typeof privateMetadata.staffPinHash === "string" && privateMetadata.staffPinHash.length > 0,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    role,
    category,
    payrollHoursWorked: asNumber(payroll.hoursWorked),
    payrollHourlyRate: asNumber(payroll.hourlyRate),
    payrollStatus: payroll.status === "paid" || payroll.status === "pending" ? payroll.status : null,
    payrollPaydayWeekday: asWeekday(payroll.paydayWeekday),
    payrollDelayEntries: asDelayEntries(payroll.delayEntries),
    performanceRating: asNumber(performance.rating),
    performanceReviewsCount: asNumber(performance.reviewsCount),
    performanceReviewCycleDays: asNumber(performance.reviewCycleDays),
    teacherType: asSafeShortText(teaching.teacherType, 60),
    teacherAssignedUserId: asSafeShortText(teaching.assignedTeacherUserId, 80),
    teacherRecurrenceUnit: asRecurrenceUnit(teaching.recurrenceUnit),
    teacherRecurrenceInterval: asRecurrenceInterval(teaching.recurrenceInterval),
    teacherCourseSlugs: asCourseSlugs(teaching.courseSlugs),
    teacherWeekdays: asArrayWeekdays(teaching.weekdays),
    teacherShiftStart: asTimeValue(teaching.shiftStart),
    teacherShiftEnd: asTimeValue(teaching.shiftEnd),
    teacherWeeklyHours: asNumber(teaching.weeklyHours),
    teacherBonusTargetHours: asNumber(teaching.bonusTargetHours),
    banned: Boolean(user.banned),
    locked: Boolean(user.locked),
    online,
    lastActiveAt,
    staffLastCheckInAt,
    createdAt: user.createdAt || Date.now(),
    lastSignInAt,
  }
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:users:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const requestUrl = new URL(req.url)
  const query = requestUrl.searchParams.get("q")?.trim() || undefined
  const categoryFilter = parseStaffCategory(requestUrl.searchParams.get("category") || undefined)

  const client = await clerkClient()

  let activeSessionUserIds = new Set<string>()
  try {
    const sessions = await client.sessions.getSessionList({
      status: "active",
      limit: 500,
    })
    activeSessionUserIds = new Set(
      sessions.data
        .map((session) => (typeof session.userId === "string" ? session.userId : ""))
        .filter((userId) => userId.length > 0)
    )
  } catch {
    activeSessionUserIds = new Set<string>()
  }

  const users = await client.users.getUserList({
    limit: 100,
    ...(query ? { query } : {}),
  })

  const shouldForcePerUserSessionLookup = activeSessionUserIds.size === 0
  const verificationCandidates = users.data
    .filter((user) => !activeSessionUserIds.has(user.id))
    .filter((user) => (shouldForcePerUserSessionLookup ? true : shouldVerifyUserActiveSession(user)))

  if (verificationCandidates.length > 0) {
    const batches = chunkArray(verificationCandidates, 10)
    for (const batch of batches) {
      await Promise.all(
        batch.map(async (user) => {
          try {
            const sessions = await client.sessions.getSessionList({
              userId: user.id,
              status: "active",
              limit: 1,
            })
            if (sessions.data.length > 0) {
              activeSessionUserIds.add(user.id)
            }
          } catch {
            // Ignore per-user session lookup failure and keep fallback presence logic.
          }
        })
      )
    }
  }

  let list = users.data
    .map((user) => toStaffListItem(user, activeSessionUserIds.has(user.id)))
    .filter((item): item is StaffListItem => Boolean(item))
  if (categoryFilter) {
    list = list.filter((item) => item.category === categoryFilter)
  }
  list = list.sort((a, b) => b.createdAt - a.createdAt)

  return NextResponse.json(
    { items: list },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  )
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:users:post", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : ""
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 })
  }

  const role = parseRole(payload.role)
  if (!role) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }
  if (authResult.role !== "owner" && role === "owner") {
    return NextResponse.json({ error: "Only Owner can assign Owner role." }, { status: 403 })
  }
  const requestedCategory = parseStaffCategory(payload.category) || "guest_staff"
  const category = normalizeCategoryForRole(role, requestedCategory)

  const firstName = sanitizeName(payload.firstName)
  const lastName = sanitizeName(payload.lastName)

  const client = await clerkClient()
  const existing = await client.users.getUserList({
    emailAddress: [email],
    limit: 1,
  })

  if (existing.data.length > 0) {
    const current = existing.data[0]
    const previousState = extractStaffRoleSnapshot(current)
    const withRole = applyStaffRoleToMetadata(current.publicMetadata, role)
    const updated = await client.users.updateUser(current.id, {
      firstName: firstName || current.firstName || undefined,
      lastName: lastName || current.lastName || undefined,
      publicMetadata: applyStaffCategoryToMetadata(withRole, category),
    })
    await syncStaffAccountFromClerkUser(updated, { source: "staff_portal_post" })
    const nextState = extractStaffRoleSnapshot(updated)
    await createStaffRoleAudit({
      staffClerkUserId: updated.id,
      actorClerkUserId: authResult.userId,
      actorRole: authResult.role,
      action: "promote_existing",
      previousRole: previousState.role,
      nextRole: nextState.role,
      previousCategory: previousState.category,
      nextCategory: nextState.category,
      metadata: { via: "staff/users POST", email },
    })
    return NextResponse.json({
      mode: "promoted_existing",
      user: toStaffListItem(updated, false),
    })
  }

  const requestUrl = new URL(req.url)
  const redirectUrl = `${requestUrl.origin}/staff/sign-in`
  const withRole = applyStaffRoleToMetadata({}, role)
  const invitation = await client.invitations.createInvitation({
    emailAddress: email,
    notify: true,
    ignoreExisting: true,
    publicMetadata: applyStaffCategoryToMetadata(withRole, category),
    redirectUrl,
  })

  return NextResponse.json({
    mode: "invited",
    invitation: {
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      status: invitation.status,
      createdAt: invitation.createdAt,
    },
    supportedCategories: STAFF_CATEGORIES,
  })
}
