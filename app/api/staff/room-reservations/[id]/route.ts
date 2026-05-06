import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalBaseRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { decideReservationLifecycleAction, findAvailableRoomsForSlot, findRoomAvailabilityConflict } from "@/lib/room-availability"
import { expandCourseScheduleSlots, type CourseScheduleLike } from "@/lib/course-schedule-blocks"

export const runtime = "nodejs"

const toDate = (value: unknown) => {
  if (typeof value !== "string") return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

const SCHOOL_TIMEZONE = "America/New_York"
const ROOM_BUFFER_MINUTES = 15

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const rateLimit = consumeRateLimit({ key: buildRateLimitKey("staff:room-reservations:put", getClientIp(req)), limit: 60, windowMs: 60_000 })
  if (!rateLimit.ok) return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })

  const auth = await authorizeStaffPortalBaseRequest()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!auth.role) return NextResponse.json({ error: "Insufficient role" }, { status: 403 })

  const { id } = await context.params
  const current = await prisma.roomReservation.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: "Reservation not found." }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const startsAt = toDate(body.startsAt) ?? current.startsAt
  const endsAt = toDate(body.endsAt) ?? current.endsAt
  const roomId = typeof body.roomId === "string" ? body.roomId : current.roomId

  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { active: true } })
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
    action: "update",
    currentStatus: current.status,
    roomIsActive: room.active,
    startsAt,
    endsAt,
    roomId,
    sessions,
    reservations,
    excludeReservationId: id,
    bufferMinutes: ROOM_BUFFER_MINUTES,
    mode: "symmetric",
    virtualBlocks: virtualBlocks.length > 0 ? virtualBlocks : undefined,
  })
  if (!decision.allowed) {
    const availableRooms = decision.reasonCode === "CONFLICT"
      ? await findAvailableRoomsForSlot({ targetStartsAt: startsAt, targetEndsAt: endsAt, excludeRoomId: roomId, bufferMinutes: ROOM_BUFFER_MINUTES, prisma })
      : []
    const conflict = findRoomAvailabilityConflict(sessions, reservations, {
      roomId,
      startsAt,
      endsAt,
      excludeReservationId: id,
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
    const updated = await tx.roomReservation.update({
      where: { id },
      data: {
        roomId,
        startsAt,
        endsAt,
        title: typeof body.title === "string" ? body.title.trim().slice(0, 120) : current.title,
        reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 400) : current.reason,
        category: typeof body.category === "string" ? body.category : current.category,
        assignedStaffClerkUserId:
          typeof body.assignedStaffClerkUserId === "string" ? body.assignedStaffClerkUserId : current.assignedStaffClerkUserId,
      },
    })

    await tx.roomAuditLog.create({
      data: {
        roomId: updated.roomId,
        roomNameSnapshot: `reservation:${updated.title}`,
        action: "reservation_update",
        actorClerkUserId: auth.userId,
        actorRole: auth.role,
        outcome: "success",
        metadata: { reservationId: updated.id },
      },
    })

    return updated
  })

  return NextResponse.json({ ok: true, item })
}
