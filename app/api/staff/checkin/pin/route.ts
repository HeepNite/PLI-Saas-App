import { createHash, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { extractStaffCategoryFromUserMetadata } from "@/lib/security/staff-category"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"

export const runtime = "nodejs"

const STAFF_SCAN_PAGE_SIZE = 100
const STAFF_SCAN_MAX_USERS = 5000

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

const isValidPinHash = (pin: string, pinHash: string) => {
  const parts = pinHash.split(":")
  if (parts.length !== 2) return false
  const [salt, expectedHash] = parts
  if (!salt || !expectedHash) return false

  const nextHash = createHash("sha256")
    .update(`${pin}:${salt}:${process.env.CLERK_SECRET_KEY || "staff-pin"}`)
    .digest("hex")

  try {
    const expectedBuffer = Buffer.from(expectedHash, "hex")
    const nextBuffer = Buffer.from(nextHash, "hex")
    if (expectedBuffer.length === 0 || nextBuffer.length === 0) return false
    if (expectedBuffer.length !== nextBuffer.length) return false
    return timingSafeEqual(expectedBuffer, nextBuffer)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:checkin:pin:post", getClientIp(req)),
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
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 })
  }

  const client = await clerkClient()
  let matchedUser: Awaited<ReturnType<typeof client.users.getUser>> | null = null
  let matchedRole: string | null = null

  if (requestedUserId) {
    let selectedUser: Awaited<ReturnType<typeof client.users.getUser>> | null = null
    try {
      selectedUser = await client.users.getUser(requestedUserId)
    } catch {
      return NextResponse.json({ error: "Selected staff user was not found." }, { status: 404 })
    }

    const role = extractStaffRoleFromUserMetadata(selectedUser)
    if (!role) {
      return NextResponse.json({ error: "Selected user is not a staff member." }, { status: 400 })
    }

    const privateMetadata = asObject(selectedUser.privateMetadata)
    const pinHash = typeof privateMetadata.staffPinHash === "string" ? privateMetadata.staffPinHash : ""
    if (!pinHash) {
      return NextResponse.json({ error: "Selected user has no PIN configured." }, { status: 400 })
    }

    if (!isValidPinHash(pin, pinHash)) {
      return NextResponse.json({ error: "Invalid PIN." }, { status: 401 })
    }

    matchedUser = selectedUser
    matchedRole = role
  } else {
    for (let offset = 0; offset < STAFF_SCAN_MAX_USERS; offset += STAFF_SCAN_PAGE_SIZE) {
      const page = await client.users.getUserList({
        limit: STAFF_SCAN_PAGE_SIZE,
        offset,
      })

      for (const user of page.data) {
        const role = extractStaffRoleFromUserMetadata(user)
        if (!role) continue

        const privateMetadata = asObject(user.privateMetadata)
        const pinHash = typeof privateMetadata.staffPinHash === "string" ? privateMetadata.staffPinHash : ""
        if (!pinHash) continue

        if (!isValidPinHash(pin, pinHash)) continue
        matchedUser = user
        matchedRole = role
        break
      }

      if (matchedUser) break
      if (page.data.length < STAFF_SCAN_PAGE_SIZE) break
    }
  }

  if (!matchedUser || !matchedRole) {
    return NextResponse.json({ error: "Invalid PIN." }, { status: 401 })
  }

  const now = new Date().toISOString()
  const privateMetadata = asObject(matchedUser.privateMetadata)
  const currentCount =
    typeof privateMetadata.staffCheckInCount === "number" && Number.isFinite(privateMetadata.staffCheckInCount)
      ? privateMetadata.staffCheckInCount
      : 0

  await client.users.updateUserMetadata(matchedUser.id, {
    privateMetadata: {
      ...privateMetadata,
      staffLastCheckInAt: now,
      staffCheckInCount: currentCount + 1,
      staffPresenceStatus: "online",
      staffPresenceUpdatedAt: now,
    },
  })

  const signInToken = await client.signInTokens.createSignInToken({
    userId: matchedUser.id,
    expiresInSeconds: 60,
  })

  const requestUrl = new URL(req.url)
  const redirectTo = `${requestUrl.origin}/staff/resolve`
  const signInUrl = new URL(signInToken.url)
  signInUrl.searchParams.set("redirect_url", redirectTo)
  const ticketFromUrl = signInUrl.searchParams.get("token")
  const ticket = typeof (signInToken as { token?: unknown }).token === "string"
    ? ((signInToken as { token: string }).token || "").trim()
    : (ticketFromUrl || "").trim()

  const name = `${matchedUser.firstName || ""} ${matchedUser.lastName || ""}`.trim() || matchedUser.primaryEmailAddress?.emailAddress || matchedUser.id
  const category = extractStaffCategoryFromUserMetadata(matchedUser)

  return NextResponse.json({
    ok: true,
    checkedInAt: now,
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
