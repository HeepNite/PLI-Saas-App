import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { findAvailableRoomsForSlot } from "@/lib/room-availability"

export const runtime = "nodejs"

const toDate = (value: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:rooms:available:get", getClientIp(req)),
    limit: 120,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const url = new URL(req.url)
  const startsAt = toDate(url.searchParams.get("startsAt"))
  const endsAt = toDate(url.searchParams.get("endsAt"))
  const excludeRoomId = url.searchParams.get("excludeRoomId") || undefined

  if (!startsAt || !endsAt) {
    return NextResponse.json({ error: "Query params 'startsAt' and 'endsAt' are required (ISO 8601)." }, { status: 400 })
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    return NextResponse.json({ error: "'endsAt' must be after 'startsAt'." }, { status: 400 })
  }

  const rooms = await findAvailableRoomsForSlot({
    targetStartsAt: startsAt,
    targetEndsAt: endsAt,
    excludeRoomId,
    bufferMinutes: 15,
    prisma,
  })

  return NextResponse.json({ rooms })
}
