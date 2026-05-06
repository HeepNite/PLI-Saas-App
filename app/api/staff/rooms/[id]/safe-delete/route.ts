import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeOwnerOrAdminRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { buildRoomLifecycleAuditPayload, getSafeDeleteBlockers } from "@/lib/room-availability"
import { toRoomId } from "../../shared"

export const runtime = "nodejs"

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:rooms:safe-delete:post", getClientIp(req)),
    limit: 20,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })

  const auth = await authorizeOwnerOrAdminRequest()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await context.params
  const roomId = toRoomId(id)
  if (!roomId) return NextResponse.json({ error: "Invalid room id." }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { reason?: unknown }
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 400) : null

  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true, name: true } })
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 })

  const now = new Date()
  const [futureSessions, reservations, defaultCourses] = await Promise.all([
    prisma.classSession.findMany({ where: { roomId, startsAt: { gt: now } }, select: { id: true, startsAt: true }, take: 100 }),
    prisma.roomReservation.findMany({ where: { roomId }, select: { id: true, roomId: true, startsAt: true, endsAt: true, status: true }, take: 200 }),
    prisma.courseCatalog.findMany({ where: { defaultRoomId: roomId }, select: { slug: true }, take: 200 }),
  ])

  const blockers = getSafeDeleteBlockers({
    now,
    futureSessions,
    reservations,
    defaultCourses,
    historical: { hasAttendanceLinks: false, hasPaymentLinks: false, hasAuditLinks: false },
  })

  if (blockers.length > 0) {
    await prisma.roomAuditLog.create({
      data: buildRoomLifecycleAuditPayload({
        action: "room_safe_delete",
        actorClerkUserId: auth.userId,
        actorRole: auth.role,
        outcome: "denied",
        roomId: room.id,
        roomNameSnapshot: room.name,
        reason,
        blockers,
      }),
    })
    return NextResponse.json({ error: "Room cannot be safely deleted.", blockers }, { status: 409 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const audit = await tx.roomAuditLog.create({
      data: buildRoomLifecycleAuditPayload({
        action: "room_safe_delete",
        actorClerkUserId: auth.userId,
        actorRole: auth.role,
        outcome: "success",
        roomId: room.id,
        roomNameSnapshot: room.name,
        reason,
      }),
      select: { id: true },
    })

    await tx.room.delete({ where: { id: room.id } })
    return audit
  })

  return NextResponse.json({ ok: true, deletedRoom: { id: room.id, name: room.name }, auditId: result.id })
}
