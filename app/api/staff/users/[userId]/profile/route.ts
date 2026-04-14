import { NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { clerkClient } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
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
  extractStaffSubCategoryFromUserMetadata,
  parseStaffCategory,
  parseStaffSubCategory,
  applyStaffSubCategoryToMetadata,
  STAFF_CATEGORIES,
  STAFF_SUB_CATEGORIES,
  type StaffCategory,
  type StaffSubCategory,
  type StaffPaymentInfo,
  type StaffPaymentPreference,
  PAYMENT_PREFERENCES,
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
  subCategory: StaffSubCategory | null
  pin: string
  clearPin: boolean
  paymentPreference: StaffPaymentPreference | null
  paymentInfo: StaffPaymentInfo | null
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

const safeOptionalText = (value: unknown, max = 120) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)

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

const parsePaymentPreference = (value: unknown): StaffPaymentPreference | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== "string") return undefined
  const normalized = value.trim().toLowerCase()
  return PAYMENT_PREFERENCES.includes(normalized as StaffPaymentPreference)
    ? (normalized as StaffPaymentPreference)
    : undefined
}

const normalizePaymentInfo = (value: unknown): StaffPaymentInfo | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined

  const record = value as Record<string, unknown>
  const nextPaymentInfo: StaffPaymentInfo = {}

  for (const key of [
    "cbu",
    "alias",
    "accountHolder",
    "mercadoPagoId",
    "bankName",
    "routingNumber",
    "accountNumber",
    "zelleId",
    "venmoUser",
    "accountType",
  ] as const) {
    const fieldValue = record[key]
    if (fieldValue !== undefined && fieldValue !== null && typeof fieldValue !== "string") {
      return undefined
    }
  }

  const cbu = safeOptionalText(record.cbu, 32)
  const alias = safeOptionalText(record.alias, 80)
  const accountHolder = safeOptionalText(record.accountHolder, 120)
  const mercadoPagoId = safeOptionalText(record.mercadoPagoId, 120)
  const bankName = safeOptionalText(record.bankName, 120)
  const routingNumber = safeOptionalText(record.routingNumber, 32)
  const accountNumber = safeOptionalText(record.accountNumber, 32)
  const zelleId = safeOptionalText(record.zelleId, 120)
  const venmoUser = safeOptionalText(record.venmoUser, 120)
  const accountType = safeOptionalText(record.accountType, 40)

  if (cbu) nextPaymentInfo.cbu = cbu
  if (alias) nextPaymentInfo.alias = alias
  if (accountHolder) nextPaymentInfo.accountHolder = accountHolder
  if (mercadoPagoId) nextPaymentInfo.mercadoPagoId = mercadoPagoId
  if (bankName) nextPaymentInfo.bankName = bankName
  if (routingNumber) nextPaymentInfo.routingNumber = routingNumber
  if (accountNumber) nextPaymentInfo.accountNumber = accountNumber
  if (zelleId) nextPaymentInfo.zelleId = zelleId
  if (venmoUser) nextPaymentInfo.venmoUser = venmoUser
  if (accountType) nextPaymentInfo.accountType = accountType

  return Object.keys(nextPaymentInfo).length > 0 ? nextPaymentInfo : null
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

type StaffPaymentRecord = {
  paymentPreference: string | null
  paymentInfo: unknown
}

const staffAccountDelegate = prisma.staffAccount as unknown as {
  findUnique(args: { where: { clerkUserId: string }; select: { paymentPreference: true; paymentInfo: true } }): Promise<StaffPaymentRecord | null>
  update(args: {
    where: { clerkUserId: string }
    data: { paymentPreference?: string | null; paymentInfo?: StaffPaymentInfo | null }
    select: { paymentPreference: true; paymentInfo: true }
  }): Promise<StaffPaymentRecord>
}

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
  const subCategory = extractStaffSubCategoryFromUserMetadata(user)
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
    subCategory,
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

  // Fetch payment info from database
  let paymentPreference: StaffPaymentPreference | null = null
  let assignedPaymentPreference: StaffPaymentPreference | null = null
  let paymentInfo: StaffPaymentInfo | null = null
  try {
     type StaffAccountPaymentData = {
       paymentPreference: string | null
       paymentInfo: unknown
       paymentModel?: { defaultPaymentMethod?: { adapterType?: string } } | null
     }
     const staffAccount = (await prisma.staffAccount.findUnique({
       where: { clerkUserId: userId },
       select: {
         paymentPreference: true,
         paymentInfo: true,
         paymentModel: {
           select: {
             defaultPaymentMethod: {
               select: {
                 adapterType: true,
               },
             },
           },
         },
       },
     })) as StaffAccountPaymentData | null
    if (staffAccount) {
      paymentPreference = parsePaymentPreference(staffAccount.paymentPreference) ?? null
      paymentInfo = normalizePaymentInfo(staffAccount.paymentInfo) ?? null
      assignedPaymentPreference = parsePaymentPreference(staffAccount.paymentModel?.defaultPaymentMethod?.adapterType) ?? null

      // Fallback to model's default method if no preference is set
      if (!paymentPreference) {
        paymentPreference = assignedPaymentPreference
      }
    }
  } catch {
    // Continue without payment info if DB query fails
  }

  return NextResponse.json({
    user: toResponsePayload(user, { hasActiveSession }),
    canEditRole,
    supportedRoles: STAFF_ROLES,
    supportedCategories: STAFF_CATEGORIES,
    supportedSubCategories: STAFF_SUB_CATEGORIES,
    paymentPreference,
    assignedPaymentPreference,
    paymentInfo,
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
  const hasPaymentPreference = hasOwn(payload, "paymentPreference")
  const hasPaymentInfo = hasOwn(payload, "paymentInfo")
  if (pin && !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 })
  }

  const parsedPaymentPreference = parsePaymentPreference(payload.paymentPreference)
  if (hasPaymentPreference && parsedPaymentPreference === undefined) {
    return NextResponse.json({ error: "Invalid payment preference." }, { status: 400 })
  }

  const parsedPaymentInfo = normalizePaymentInfo(payload.paymentInfo)
  if (hasPaymentInfo && parsedPaymentInfo === undefined) {
    return NextResponse.json({ error: "Invalid payment information." }, { status: 400 })
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
    ...(hasOwn(payload, "birthDate") ? { birthDate: safeText(payload.birthDate, 40) } : {}),
    ...(hasOwn(payload, "addressLine1") ? { addressLine1: safeText(payload.addressLine1, 150) } : {}),
    ...(hasOwn(payload, "addressLine2") ? { addressLine2: safeText(payload.addressLine2, 150) } : {}),
    ...(hasOwn(payload, "city") ? { city: safeText(payload.city, 80) } : {}),
    ...(hasOwn(payload, "state") ? { state: safeText(payload.state, 80) } : {}),
    ...(hasOwn(payload, "postalCode") ? { postalCode: safeText(payload.postalCode, 24) } : {}),
    ...(hasOwn(payload, "country") ? { country: safeText(payload.country, 80) } : {}),
    ...(hasOwn(payload, "personalNote") ? { personalNote: safeText(payload.personalNote, 600) } : {}),
    ...(hasOwn(payload, "gallery") ? { gallery: safeGallery(payload.gallery) } : {}),
  }

  const nextPublicMetadata: Record<string, unknown> = {
    ...publicMetadata,
    staffProfile: nextProfile,
    ...(hasOwn(payload, "location") ? { staffLocation: safeText(payload.location, 120) } : {}),
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
      const normalizedCategory = normalizeCategoryForRole(parsedRole, parsedCategory)
      const withRole = applyStaffRoleToMetadata(nextPublicMetadata, parsedRole)
      const withCategory = applyStaffCategoryToMetadata(withRole, normalizedCategory)
      
      // Handle subCategory: only for guest category
      let subCategory = null
      if (normalizedCategory === "guest" && typeof payload.subCategory === "string") {
        subCategory = parseStaffSubCategory(payload.subCategory)
      }
      Object.assign(nextPublicMetadata, applyStaffSubCategoryToMetadata(withCategory, subCategory))
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
  let paymentPreference: StaffPaymentPreference | null = null
  let paymentInfo: StaffPaymentInfo | null = null
  if (hasPaymentPreference || hasPaymentInfo) {
    const updatedStaffAccount = await prisma.staffAccount.update({
      where: { clerkUserId: userId },
       data: {
         ...(hasPaymentPreference ? { paymentPreference: parsedPaymentPreference ?? null } : {}),
         ...(hasPaymentInfo ? { paymentInfo: parsedPaymentInfo ?? Prisma.JsonNull } : {}),
       },
      select: {
        paymentPreference: true,
        paymentInfo: true,
      },
    })
    paymentPreference = parsePaymentPreference(updatedStaffAccount.paymentPreference) ?? null
    paymentInfo = normalizePaymentInfo(updatedStaffAccount.paymentInfo) ?? null
  } else {
    const currentStaffAccount = await prisma.staffAccount.findUnique({
      where: { clerkUserId: userId },
      select: {
        paymentPreference: true,
        paymentInfo: true,
      },
    })
    paymentPreference = parsePaymentPreference(currentStaffAccount?.paymentPreference) ?? null
    paymentInfo = normalizePaymentInfo(currentStaffAccount?.paymentInfo) ?? null
  }
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
    supportedSubCategories: STAFF_SUB_CATEGORIES,
    paymentPreference,
    paymentInfo,
    user: toResponsePayload(updated),
  })
}
