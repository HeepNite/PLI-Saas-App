import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { extractStaffCategoryFromUserMetadata } from "@/lib/security/staff-category"
import { extractStaffRoleFromUserMetadata } from "@/lib/security/staff-role"
import { isValidPinHash } from "@/lib/security/staff-pin-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { createTeacherClockEntryWithSlugs } from "@/lib/clock/teacher-clock"
import { asObject } from "@/lib/shared"

export const runtime = "nodejs"

const STAFF_SCAN_PAGE_SIZE = 100
const STAFF_SCAN_MAX_USERS = 5000

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
  const preferredUserId = typeof payload.preferUserId === "string" ? payload.preferUserId.trim() : ""
  const skipSession = payload.skipSession === true

  // Check-in endpoint is check-in only. Reject if caller did not explicitly
  // signal check-in intent via skipSession=true. Use /api/staff/login/pin for
  // authentication/session creation.
  if (!skipSession) {
    return NextResponse.json(
      {
        error:
          "This endpoint is check-in only. Set skipSession=true to record attendance, or use /api/staff/login/pin for sign-in.",
      },
      { status: 400 }
    )
  }

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
    if (preferredUserId) {
      try {
        const preferredUser = await client.users.getUser(preferredUserId)
        const preferredRole = extractStaffRoleFromUserMetadata(preferredUser)
        const privateMetadata = asObject(preferredUser.privateMetadata)
        const pinHash = typeof privateMetadata.staffPinHash === "string" ? privateMetadata.staffPinHash : ""
        if (preferredRole && pinHash && isValidPinHash(pin, pinHash)) {
          matchedUser = preferredUser
          matchedRole = preferredRole
        }
      } catch {
        // ignore and fall back to global scan
      }
    }

    const pinMatches: Array<{
      user: Awaited<ReturnType<typeof client.users.getUser>>
      role: string
    }> = []

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
        if (!pinMatches.some((entry) => entry.user.id === user.id)) {
          pinMatches.push({ user, role })
        }
      }

      if (page.data.length < STAFF_SCAN_PAGE_SIZE) break
    }

    if (!matchedUser) {
      if (pinMatches.length === 1) {
        matchedUser = pinMatches[0]!.user
        matchedRole = pinMatches[0]!.role
      } else if (pinMatches.length > 1) {
        return NextResponse.json(
          {
            error: "This PIN is assigned to multiple staff users. Set unique PINs before using PIN sign-in.",
          },
          { status: 409 }
        )
      }
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

  const category = extractStaffCategoryFromUserMetadata(matchedUser)
  if (category === "teacher") {
    const publicMetadata = asObject(matchedUser.publicMetadata)
    const teaching = asObject(publicMetadata.staffTeaching)
    const courseSlugs = Array.isArray(teaching.courseSlugs)
      ? teaching.courseSlugs.filter((s): s is string => typeof s === "string")
      : []
    
    createTeacherClockEntryWithSlugs(matchedUser.id, new Date(now), courseSlugs)
      .catch((err) => console.error("Failed to create teacher clock entry", err))
  }

  const name = `${matchedUser.firstName || ""} ${matchedUser.lastName || ""}`.trim() || matchedUser.primaryEmailAddress?.emailAddress || matchedUser.id

  console.info("staff/checkin/pin matched user", {
    userId: matchedUser.id,
    role: matchedRole,
    category,
    requestedUserId: requestedUserId || null,
    preferredUserId: preferredUserId || null,
  })

  // Check-in only: return attendance confirmation, never session tokens
  return NextResponse.json({
    ok: true,
    checkedInAt: now,
    staff: {
      id: matchedUser.id,
      name,
      role: matchedRole,
      category,
    },
  })
}
