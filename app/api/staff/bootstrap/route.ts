import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalBaseRequest, hasAnyStaffAdmin } from "@/lib/security/staff-portal-auth"
import { applyStaffRoleToMetadata, extractStaffRoleFromUserMetadata, isStaffAdminRole } from "@/lib/security/staff-role"
import { applyStaffCategoryToMetadata } from "@/lib/security/staff-category"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { createStaffRoleAudit, extractStaffRoleSnapshot, syncStaffAccountFromClerkUser } from "@/lib/security/staff-account-sync"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:bootstrap:post", limit: 20, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalBaseRequest(),
  })
  if (!guard.ok) return guard.response
  const authResult = guard.auth

  if (isStaffAdminRole(authResult.role)) {
    return NextResponse.json({ ok: true, mode: "already_admin", role: authResult.role })
  }

  const hasAdmin = await hasAnyStaffAdmin()
  if (hasAdmin) {
    return NextResponse.json(
      { error: "Bootstrap disabled: an admin/owner already exists" },
      { status: 403 }
    )
  }

  const client = await clerkClient()
  const currentUser = await client.users.getUser(authResult.userId)
  const previousState = extractStaffRoleSnapshot(currentUser)
  const withOwnerRole = applyStaffRoleToMetadata(currentUser.publicMetadata, "owner")
  const updated = await client.users.updateUserMetadata(authResult.userId, {
    publicMetadata: applyStaffCategoryToMetadata(withOwnerRole, "partner"),
  })
  const nextState = extractStaffRoleSnapshot(updated)
  await syncStaffAccountFromClerkUser(updated, { source: "staff_bootstrap" })
  await createStaffRoleAudit({
    staffClerkUserId: updated.id,
    actorClerkUserId: authResult.userId,
    actorRole: "owner",
    action: "bootstrap_owner",
    previousRole: previousState.role,
    nextRole: nextState.role,
    previousCategory: previousState.category,
    nextCategory: nextState.category,
    metadata: { via: "staff/bootstrap POST" },
  })

  return NextResponse.json({
    ok: true,
    mode: "bootstrapped",
    userId: updated.id,
    role: extractStaffRoleFromUserMetadata(updated),
  })
}
