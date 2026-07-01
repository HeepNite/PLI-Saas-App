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
  parseStaffSubCategory,
  applyStaffSubCategoryToMetadata,
  removeStaffCategoryFromMetadata,
} from "@/lib/security/staff-category"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import {
  createStaffRoleAudit,
  extractStaffRoleSnapshot,
  syncStaffAccountFromClerkUser,
} from "@/lib/security/staff-account-sync"
import { asObject } from "@/lib/shared"

export const runtime = "nodejs"

type StaffAction = "set_role" | "set_category" | "lock" | "unlock" | "ban" | "unban" | "remove_staff" | "force_logout"

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
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:users:patch", limit: 120, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

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
  const previousState = extractStaffRoleSnapshot(targetUser)
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

    const currentCategory = extractStaffCategoryFromUserMetadata(targetUser) || "guest"
    const normalizedCategory = normalizeCategoryForRole(role, currentCategory) || currentCategory
    const withRole = applyStaffRoleToMetadata(targetUser.publicMetadata, role)
    const withCategory = applyStaffCategoryToMetadata(withRole, normalizedCategory)
    
    // Handle subCategory: clear it when changing category away from guest
    let subCategory = null
    if (normalizedCategory === "guest" && typeof payload.subCategory === "string") {
      subCategory = parseStaffSubCategory(payload.subCategory)
    }
    const withSubCategory = applyStaffSubCategoryToMetadata(withCategory, subCategory)
    
    const updated = await client.users.updateUserMetadata(userId, {
      publicMetadata: withSubCategory,
    })
    const nextState = extractStaffRoleSnapshot(updated)
    await syncStaffAccountFromClerkUser(updated, { source: "staff_users_patch" })
    await createStaffRoleAudit({
      staffClerkUserId: updated.id,
      actorClerkUserId: authResult.userId,
      actorRole: authResult.role,
      action: "set_role",
      previousRole: previousState.role,
      nextRole: nextState.role,
      previousCategory: previousState.category,
      nextCategory: nextState.category,
      metadata: { via: "staff/users/[userId] PATCH" },
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
    const withoutCategory = removeStaffCategoryFromMetadata(withoutRole)
    // Also remove subCategory
    const withoutSubCategory = applyStaffSubCategoryToMetadata(withoutCategory, null)
    const updated = await client.users.updateUserMetadata(userId, {
      publicMetadata: withoutSubCategory,
    })
    const nextState = extractStaffRoleSnapshot(updated)
    await syncStaffAccountFromClerkUser(updated, { source: "staff_users_patch", allowWithoutRole: true })
    await createStaffRoleAudit({
      staffClerkUserId: updated.id,
      actorClerkUserId: authResult.userId,
      actorRole: authResult.role,
      action: "remove_staff",
      previousRole: previousState.role,
      nextRole: nextState.role || "removed",
      previousCategory: previousState.category,
      nextCategory: nextState.category,
      metadata: { via: "staff/users/[userId] PATCH" },
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
    const nextState = extractStaffRoleSnapshot(updated)
    await syncStaffAccountFromClerkUser(updated, { source: "staff_users_patch" })
    await createStaffRoleAudit({
      staffClerkUserId: updated.id,
      actorClerkUserId: authResult.userId,
      actorRole: authResult.role,
      action: "set_category",
      previousRole: previousState.role,
      nextRole: nextState.role,
      previousCategory: previousState.category,
      nextCategory: nextState.category,
      metadata: { via: "staff/users/[userId] PATCH" },
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

    // R7/D7: force_logout MUST NOT mutate payroll hours from session duration.
    // Payroll authority is canonical StaffClockEntry only (not login/session metadata).
    const updated = await client.users.updateUserMetadata(userId, {
      publicMetadata,
      privateMetadata: {
        ...privateMetadata,
        staffPresenceStatus: "offline",
        staffPresenceUpdatedAt: nowIso,
        staffLastCheckOutAt: nowIso,
        staffLastCheckInAt: null,
        staffForceLogoutAt: nowIso,
      },
    })
    await syncStaffAccountFromClerkUser(updated, { source: "staff_users_force_logout", allowWithoutRole: true })

    return NextResponse.json({
      user: {
        id: updated.id,
        role: extractStaffRoleFromUserMetadata(updated),
        banned: Boolean(updated.banned),
        locked: Boolean(updated.locked),
      },
    })
  }

  if (action === "lock") {
    const updated = await client.users.lockUser(userId)
    await syncStaffAccountFromClerkUser(updated, { source: "staff_users_lock", allowWithoutRole: true })
    return NextResponse.json({ user: { id: updated.id, locked: Boolean(updated.locked), banned: Boolean(updated.banned) } })
  }

  if (action === "unlock") {
    const updated = await client.users.unlockUser(userId)
    await syncStaffAccountFromClerkUser(updated, { source: "staff_users_unlock", allowWithoutRole: true })
    return NextResponse.json({ user: { id: updated.id, locked: Boolean(updated.locked), banned: Boolean(updated.banned) } })
  }

  if (action === "ban") {
    const updated = await client.users.banUser(userId)
    await syncStaffAccountFromClerkUser(updated, { source: "staff_users_ban", allowWithoutRole: true })
    return NextResponse.json({ user: { id: updated.id, locked: Boolean(updated.locked), banned: Boolean(updated.banned) } })
  }

  const updated = await client.users.unbanUser(userId)
  await syncStaffAccountFromClerkUser(updated, { source: "staff_users_unban", allowWithoutRole: true })
  return NextResponse.json({ user: { id: updated.id, locked: Boolean(updated.locked), banned: Boolean(updated.banned) } })
}

export async function DELETE(req: Request, context: { params: Promise<{ userId: string }> }) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:users:delete", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  if (userId === authResult.userId) {
    return NextResponse.json({ error: "You cannot remove your own staff access" }, { status: 400 })
  }

  const client = await clerkClient()
  const current = await client.users.getUser(userId)
  const previousState = extractStaffRoleSnapshot(current)
  const withoutRole = removeStaffRolesFromMetadata(current.publicMetadata)
  const updated = await client.users.updateUserMetadata(userId, {
    publicMetadata: removeStaffCategoryFromMetadata(withoutRole),
  })
  const nextState = extractStaffRoleSnapshot(updated)
  await syncStaffAccountFromClerkUser(updated, { source: "staff_users_delete", allowWithoutRole: true })
  await createStaffRoleAudit({
    staffClerkUserId: updated.id,
    actorClerkUserId: authResult.userId,
    actorRole: authResult.role,
    action: "delete_staff_access",
    previousRole: previousState.role,
    nextRole: nextState.role || "removed",
    previousCategory: previousState.category,
    nextCategory: nextState.category,
    metadata: { via: "staff/users/[userId] DELETE" },
  })

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      role: extractStaffRoleFromUserMetadata(updated),
    },
  })
}
