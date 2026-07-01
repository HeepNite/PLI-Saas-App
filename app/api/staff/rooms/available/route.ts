import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import { findAvailableRoomsForSlot } from "@/lib/room-availability"

export const runtime = "nodejs"

const toDate = (value: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

export async function GET(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:rooms:available:get", limit: 120, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response

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
