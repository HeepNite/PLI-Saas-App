import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { canViewReservationByScope, decideReservationLifecycleAction, findAvailableRoomsForSlot, findRoomAvailabilityConflict } from "@/lib/room-availability"
import { expandCourseScheduleSlots, type CourseScheduleLike } from "@/lib/course-schedule-blocks"

export const runtime = "nodejs"

const toDate = (value: unknown) => {
  if (typeof value !== "string") return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

const SCHOOL_TIMEZONE = "America/New_York"
const ROOM_BUFFER_MINUTES = 15

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({ key: buildRateLimitKey("staff:room-reservations:get", getClientIp(req)), limit: 120, windowMs: 60_000 })
  if (!rateLimit.ok) return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })

  const auth = await authorizeStaffPortalBaseRequest()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!auth.role) return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  const actorRole = auth.role as string

  const where = auth.role === "owner" || auth.role === "admin" || auth.category === "manager" || auth.category === "front_desk"
    ? {}
    : { assignedStaffClerkUserId: auth.userId }

  const rows = await prisma.roomReservation.findMany({
    where,
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true, roomId: true, title: true, reason: true, category: true, startsAt: true, endsAt: true,
      status: true, createdByClerkUserId: true, assignedStaffClerkUserId: true, cancellationReason: true,
    },
  })

  const items = rows.filter((row) =>
    canViewReservationByScope({ actor: { role: auth.role, category: auth.category }, actorClerkUserId: auth.userId, assignedStaffClerkUserId: row.assignedStaffClerkUserId })
  )
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const rateLimit = consumeRateLimit({ key: buildRateLimitKey("staff:room-reservations:post", getClientIp(req)), limit: 60, windowMs: 60_000 })
  if (!rateLimit.ok) return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })

  const auth = await authorizeStaffPortalBaseRequest()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!auth.role) return NextResponse.json({ error: "Insufficient role" }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const roomId = typeof body.roomId === "string" ? body.roomId : null
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : ""
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 400) : ""
  const startsAt = toDate(body.startsAt)
  const endsAt = toDate(body.endsAt)
  if (!roomId || !title || !reason || !startsAt || !endsAt) return NextResponse.json({ error: "Invalid reservation payload." }, { status: 400 })

  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true, active: true } })
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 })

  const [sessions, reservations, courses] = await Promise.all([
    prisma.classSession.findMany({ where: { roomId, startsAt: { lt: endsAt } }, select: { id: true, roomId: true, startsAt: true, durationMinutes: true } }),
    prisma.roomReservation.findMany({ where: { roomId }, select: { id: true, roomId: true, startsAt: true, endsAt: true, status: true } }),
    prisma.courseCatalog.findMany({ where: { defaultRoomId: roomId } }),
  ])

  // Expand course schedule rules into virtual blocking slots for this room
  const virtualBlocks = courses.flatMap((course) => {
    const courseLike: CourseScheduleLike = {
      scheduleRules: course.scheduleRules,
      availableWeekdays: course.availableWeekdays,
      availableTimes: course.availableTimes,
      defaultRoomId: course.defaultRoomId,
      durationMinutes: course.durationMinutes,
    }
    return expandCourseScheduleSlots(courseLike, startsAt, endsAt, SCHOOL_TIMEZONE)
  })

  const decision = decideReservationLifecycleAction({
    action: "create",
    roomIsActive: room.active,
    startsAt,
    endsAt,
    roomId,
    sessions,
    reservations,
    bufferMinutes: ROOM_BUFFER_MINUTES,
    mode: "symmetric",
    virtualBlocks: virtualBlocks.length > 0 ? virtualBlocks : undefined,
  })
  if (!decision.allowed) {
    // On conflict, find available alternative rooms
    const availableRooms = decision.reasonCode === "CONFLICT"
      ? await findAvailableRoomsForSlot({ targetStartsAt: startsAt, targetEndsAt: endsAt, excludeRoomId: roomId, bufferMinutes: ROOM_BUFFER_MINUTES, prisma })
      : []
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId,
      startsAt,
      endsAt,
      bufferMinutes: ROOM_BUFFER_MINUTES,
      mode: "symmetric",
      virtualBlocks: virtualBlocks.length > 0 ? virtualBlocks : undefined,
    })
    return NextResponse.json(
      { error: "Room is unavailable for the requested time slot.", conflict, availableRooms },
      { status: 409 }
    )
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.roomReservation.create({
      data: {
        roomId,
        title,
        reason,
        category: typeof body.category === "string" ? body.category : null,
        startsAt,
        endsAt,
        status: "active",
        createdByClerkUserId: auth.userId,
        assignedStaffClerkUserId: typeof body.assignedStaffClerkUserId === "string" ? body.assignedStaffClerkUserId : null,
      },
    })

    await tx.roomAuditLog.create({
      data: {
        roomId,
        roomNameSnapshot: `reservation:${title}`,
        action: "reservation_create",
        actorClerkUserId: auth.userId,
        actorRole,
        outcome: "success",
        metadata: { reservationId: created.id },
      },
    })

    return created
  })

  return NextResponse.json({ ok: true, item }, { status: 201 })
}
