import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import {
  applyStaffRoleToMetadata,
  extractStaffRoleFromUserMetadata,
  removeStaffRolesFromMetadata,
  STAFF_ROLES,
  type StaffRole,
} from "@/lib/security/staff-role"
import {
  applyStaffCategoryToMetadata,
  extractStaffCategoryFromUserMetadata,
  parseStaffCategory,
  removeStaffCategoryFromMetadata,
} from "@/lib/security/staff-category"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

type StaffAction = "set_role" | "set_category" | "lock" | "unlock" | "ban" | "unban" | "remove_staff" | "force_logout"

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

const parseRole = (value: unknown): StaffRole | null => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return STAFF_ROLES.includes(normalized as StaffRole) ? (normalized as StaffRole) : null
}

const normalizeCategoryForRole = (role: StaffRole, category: ReturnType<typeof parseStaffCategory>) => {
  if (!category) return null
  if (role === "owner") return "partner" as const
  if (role === "admin") return "manager" as const
  return category
}

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:users:patch", getClientIp(req)),
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

  const payload = body as Record<string, unknown>
  const action = typeof payload.action === "string" ? (payload.action as StaffAction) : ""
  if (!["set_role", "set_category", "lock", "unlock", "ban", "unban", "remove_staff", "force_logout"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const client = await clerkClient()
  const targetUser = await client.users.getUser(userId)
  const targetRole = extractStaffRoleFromUserMetadata(targetUser)
  if (authResult.role !== "owner" && targetRole === "owner") {
    return NextResponse.json({ error: "Admins cannot manage Owner users." }, { status: 403 })
  }

  if (action === "set_role") {
    const role = parseRole(payload.role)
    if (!role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
    if (authResult.role !== "owner" && role === "owner") {
      return NextResponse.json({ error: "Only Owner can assign Owner role." }, { status: 403 })
    }

    const currentCategory = extractStaffCategoryFromUserMetadata(targetUser) || "guest_staff"
    const normalizedCategory = normalizeCategoryForRole(role, currentCategory) || currentCategory
    const withRole = applyStaffRoleToMetadata(targetUser.publicMetadata, role)
    const updated = await client.users.updateUserMetadata(userId, {
      publicMetadata: applyStaffCategoryToMetadata(withRole, normalizedCategory),
    })

    return NextResponse.json({
      user: {
        id: updated.id,
        role: extractStaffRoleFromUserMetadata(updated),
        banned: Boolean(updated.banned),
        locked: Boolean(updated.locked),
      },
    })
  }

  if (action === "remove_staff") {
    const withoutRole = removeStaffRolesFromMetadata(targetUser.publicMetadata)
    const updated = await client.users.updateUserMetadata(userId, {
      publicMetadata: removeStaffCategoryFromMetadata(withoutRole),
    })

    return NextResponse.json({
      user: {
        id: updated.id,
        role: extractStaffRoleFromUserMetadata(updated),
        banned: Boolean(updated.banned),
        locked: Boolean(updated.locked),
      },
    })
  }

  if (action === "set_category") {
    const category = parseStaffCategory(payload.category)
    if (!category) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }
    const currentRole = extractStaffRoleFromUserMetadata(targetUser)
    if (currentRole === "owner" || currentRole === "admin") {
      return NextResponse.json({ error: "Owner/Admin category is fixed by role." }, { status: 400 })
    }
    const updated = await client.users.updateUserMetadata(userId, {
      publicMetadata: applyStaffCategoryToMetadata(targetUser.publicMetadata, category),
    })
    return NextResponse.json({
      user: {
        id: updated.id,
        role: extractStaffRoleFromUserMetadata(updated),
        banned: Boolean(updated.banned),
        locked: Boolean(updated.locked),
      },
    })
  }

  if (action === "force_logout") {
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const sessions = await client.sessions.getSessionList({
      userId,
      status: "active",
      limit: 100,
    })
    await Promise.allSettled(sessions.data.map((session) => client.sessions.revokeSession(session.id)))

    const privateMetadata = asObject(targetUser.privateMetadata)
    const publicMetadata = asObject(targetUser.publicMetadata)
    const payrollMetadata = asObject(publicMetadata.staffPayroll)

    const checkInRaw = typeof privateMetadata.staffLastCheckInAt === "string" ? privateMetadata.staffLastCheckInAt : ""
    const checkInMs = checkInRaw ? Date.parse(checkInRaw) : Number.NaN
    const sessionMinutes =
      Number.isFinite(checkInMs) && checkInMs <= now ? Math.max(0, Math.floor((now - checkInMs) / 60_000)) : 0
    const sessionHours = sessionMinutes / 60
    const existingHours =
      typeof payrollMetadata.hoursWorked === "number" && Number.isFinite(payrollMetadata.hoursWorked)
        ? payrollMetadata.hoursWorked
        : 0
    const nextHours =
      sessionHours > 0 ? Math.max(0, Number((existingHours + sessionHours).toFixed(2))) : existingHours

    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...publicMetadata,
        staffPayroll: {
          ...payrollMetadata,
          hoursWorked: nextHours,
        },
      },
      privateMetadata: {
        ...privateMetadata,
        staffPresenceStatus: "offline",
        staffPresenceUpdatedAt: nowIso,
        staffLastCheckOutAt: nowIso,
        staffLastCheckInAt: null,
      },
    })

    return NextResponse.json({
      user: {
        id: targetUser.id,
        role: extractStaffRoleFromUserMetadata(targetUser),
        banned: Boolean(targetUser.banned),
        locked: Boolean(targetUser.locked),
      },
    })
  }

  if (action === "lock") {
    const updated = await client.users.lockUser(userId)
    return NextResponse.json({ user: { id: updated.id, locked: Boolean(updated.locked), banned: Boolean(updated.banned) } })
  }

  if (action === "unlock") {
    const updated = await client.users.unlockUser(userId)
    return NextResponse.json({ user: { id: updated.id, locked: Boolean(updated.locked), banned: Boolean(updated.banned) } })
  }

  if (action === "ban") {
    const updated = await client.users.banUser(userId)
    return NextResponse.json({ user: { id: updated.id, locked: Boolean(updated.locked), banned: Boolean(updated.banned) } })
  }

  const updated = await client.users.unbanUser(userId)
  return NextResponse.json({ user: { id: updated.id, locked: Boolean(updated.locked), banned: Boolean(updated.banned) } })
}

export async function DELETE(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:users:delete", getClientIp(req)),
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

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  if (userId === authResult.userId) {
    return NextResponse.json({ error: "You cannot remove your own staff access" }, { status: 400 })
  }

  const client = await clerkClient()
  const current = await client.users.getUser(userId)
  const withoutRole = removeStaffRolesFromMetadata(current.publicMetadata)
  const updated = await client.users.updateUserMetadata(userId, {
    publicMetadata: removeStaffCategoryFromMetadata(withoutRole),
  })

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      role: extractStaffRoleFromUserMetadata(updated),
    },
  })
}
