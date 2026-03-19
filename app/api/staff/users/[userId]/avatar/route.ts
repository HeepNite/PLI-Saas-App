import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { authorizeStaffTerminalSession } from "@/lib/security/staff-terminal"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:users:avatar:patch", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  const portalAuth = await authorizeStaffPortalRequest()
  const terminalAuth = portalAuth.ok ? null : await authorizeStaffTerminalSession()
  if (!portalAuth.ok && !terminalAuth?.ok) {
    return NextResponse.json({ error: portalAuth.error }, { status: portalAuth.status })
  }

  const { userId } = await context.params
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  const client = await clerkClient()
  const targetUser = await client.users.getUser(userId)
  const targetRole = extractStaffRoleFromUserMetadata(targetUser)
  if (portalAuth.ok && portalAuth.role !== "owner" && targetRole === "owner") {
    return NextResponse.json({ error: "Admins cannot update Owner avatar." }, { status: 403 })
  }
  if (terminalAuth?.ok && targetRole) {
    return NextResponse.json({ error: "Terminal kiosk can only update customer avatars." }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 })
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Image too large. Max 5MB." }, { status: 400 })
  }

  const updated = await client.users.updateUserProfileImage(userId, { file })
  return NextResponse.json({
    ok: true,
    imageUrl: updated.imageUrl || "",
  })
}
