import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalBaseRequest, hasAnyStaffAdmin } from "@/lib/security/staff-portal-auth"
import { applyStaffRoleToMetadata, extractStaffRoleFromUserMetadata, isStaffAdminRole } from "@/lib/security/staff-role"
import { applyStaffCategoryToMetadata } from "@/lib/security/staff-category"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:bootstrap:post", getClientIp(req)),
    limit: 20,
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
  const withOwnerRole = applyStaffRoleToMetadata(currentUser.publicMetadata, "owner")
  const updated = await client.users.updateUserMetadata(authResult.userId, {
    publicMetadata: applyStaffCategoryToMetadata(withOwnerRole, "partner"),
  })

  return NextResponse.json({
    ok: true,
    mode: "bootstrapped",
    userId: updated.id,
    role: extractStaffRoleFromUserMetadata(updated),
  })
}
