import { NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
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
  publicMetadata?: unknown
  privateMetadata?: unknown
}) => {
  const publicMetadata = asObject(user.publicMetadata)
  const privateMetadata = asObject(user.privateMetadata)
  const profile = asObject(publicMetadata.staffProfile)
  const role = extractStaffRoleFromUserMetadata(user)
  const category = extractStaffCategoryFromUserMetadata(user)
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

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  const targetRole = extractStaffRoleFromUserMetadata(user)
  if (authResult.role !== "owner" && targetRole === "owner") {
    return NextResponse.json({ error: "Admins cannot access Owner profile." }, { status: 403 })
  }
  const canEditRole = authResult.role === "owner" || (authResult.role === "admin" && authResult.category === "manager")

  return NextResponse.json({
    user: toResponsePayload(user),
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

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
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
  const currentRole = extractStaffRoleFromUserMetadata(current)
  if (authResult.role !== "owner" && currentRole === "owner") {
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

  const canEditRole = authResult.role === "owner" || (authResult.role === "admin" && authResult.category === "manager")
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

  return NextResponse.json({
    ok: true,
    canEditRole,
    supportedRoles: STAFF_ROLES,
    supportedCategories: STAFF_CATEGORIES,
    user: toResponsePayload(updated),
  })
}
