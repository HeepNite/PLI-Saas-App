import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { resolveStaffUserByPin } from "@/lib/security/staff-pin-auth"

export const runtime = "nodejs"

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const resolveSchoolIdFromUser = (user: { publicMetadata?: unknown; privateMetadata?: unknown }): string | null => {
  const publicMeta = asObject(user.publicMetadata)
  const privateMeta = asObject(user.privateMetadata)
  return (
    asOptionalString(publicMeta.schoolId) ||
    asOptionalString(publicMeta.staffSchoolId) ||
    asOptionalString(privateMeta.schoolId) ||
    asOptionalString(privateMeta.staffSchoolId)
  )
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:login:pin:post", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSec) } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const payload = body as Record<string, unknown>
  const pin = typeof payload.pin === "string" ? payload.pin.trim() : ""
  const requestedUserId = typeof payload.userId === "string" ? payload.userId.trim() : ""
  const preferredUserId = typeof payload.preferUserId === "string" ? payload.preferUserId.trim() : ""
  const expectedSchoolId = asOptionalString(payload.schoolId)

  const resolved = await resolveStaffUserByPin({ pin, requestedUserId, preferredUserId })
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  const { user: matchedUser, role: matchedRole, category } = resolved.staff

  // School-context validation: if caller provides a schoolId, ensure the
  // resolved user belongs to that school. This prevents cross-school login
  // from shared terminal contexts.
  if (expectedSchoolId) {
    const userSchoolId = resolveSchoolIdFromUser(matchedUser)
    if (userSchoolId && userSchoolId !== expectedSchoolId) {
      return NextResponse.json(
        { error: "Staff member does not belong to the requested school context." },
        { status: 403 }
      )
    }
  }

  console.info("staff/login/pin authenticated user", {
    userId: matchedUser.id,
    role: matchedRole,
    category,
    requestedUserId: requestedUserId || null,
    preferredUserId: preferredUserId || null,
    schoolContext: expectedSchoolId || null,
  })

  const client = await clerkClient()

  const signInToken = await client.signInTokens.createSignInToken({
    userId: matchedUser.id,
    expiresInSeconds: 300,
  })

  const requestUrl = new URL(req.url)
  const redirectTo = `${requestUrl.origin}/staff/resolve`
  const signInUrl = new URL(signInToken.url)
  signInUrl.searchParams.set("redirect_url", redirectTo)
  const ticketFromUrl = signInUrl.searchParams.get("token")
  const ticket =
    typeof (signInToken as { token?: unknown }).token === "string"
      ? ((signInToken as { token: string }).token || "").trim()
      : (ticketFromUrl || "").trim()

  const name =
    `${matchedUser.firstName || ""} ${matchedUser.lastName || ""}`.trim() ||
    matchedUser.primaryEmailAddress?.emailAddress ||
    matchedUser.id

  return NextResponse.json({
    ok: true,
    signInUrl: signInUrl.toString(),
    ticket,
    staff: {
      id: matchedUser.id,
      name,
      role: matchedRole,
      category,
    },
  })
}
