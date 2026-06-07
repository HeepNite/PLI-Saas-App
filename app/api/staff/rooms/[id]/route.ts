import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import { buildRoomLifecycleAuditPayload, canDisableOrReassignRoom, getDisableRoomBlockers } from "@/lib/room-availability"
import {
  isUniqueConstraintError,
  prismaRoomRouteError,
  type RoomRecord,
  ROOM_SELECT,
  serializeRoom,
  toOptionalBoolean,
  toOptionalRoomLocation,
  toPositiveInt,
  toRoomId,
  toSafeRoomText,
} from "../shared"

export const runtime = "nodejs"

type RoomDelegate = {
  findUnique: (args: unknown) => Promise<RoomRecord | null>
  update: (args: unknown) => Promise<RoomRecord>
}

const getRoomDelegate = (): RoomDelegate | null => {
  const room = (prisma as typeof prisma & {
    room?: RoomDelegate
  }).room

  return room ?? null
}

const classSessionDelegate = prisma.classSession as {
  findMany: (args: unknown) => Promise<Array<{ id: string; startsAt: Date; durationMinutes: number | null }>>
}

const roomReservationDelegate = (prisma as typeof prisma & {
  roomReservation?: {
    findMany: (args: unknown) => Promise<Array<{ id: string; startsAt: Date; endsAt: Date; status: string }>>
  }
}).roomReservation

const roomAuditLogDelegate = (prisma as typeof prisma & {
  roomAuditLog?: {
    create: (args: unknown) => Promise<{ id: string }>
  }
}).roomAuditLog

const hasBlockingScheduledSessions = async (roomId: string) => {
  const now = new Date()
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const sessions = await classSessionDelegate.findMany({
    where: {
      roomId,
      startsAt: {
        gte: now,
        lt: next24h,
      },
    },
    orderBy: [{ startsAt: "asc" }],
    take: 100,
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
    },
  })

  const blockers = getDisableRoomBlockers(
    sessions.map((session) => ({
      id: session.id,
      roomId,
      startsAt: session.startsAt,
      durationMinutes: session.durationMinutes,
    })),
    now
  )

  const reservations = roomReservationDelegate
    ? await roomReservationDelegate.findMany({
        where: {
          roomId,
          status: { notIn: ["cancelled", "canceled"] },
          startsAt: { gte: now, lt: next24h },
        },
        orderBy: [{ startsAt: "asc" }],
        select: { id: true, startsAt: true, endsAt: true, status: true },
      })
    : []

  return {
    hasBlockingUsage: blockers.length > 0 || reservations.length > 0,
    blockers,
    reservationBlockers: reservations.map((reservation) => ({
      code: "RESERVATION_IN_NEXT_24H" as const,
      reservationId: reservation.id,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
    })),
  }
}

const loadRoom = async (roomDelegate: RoomDelegate, roomId: string) =>
  roomDelegate.findUnique({
    where: { id: roomId },
    select: ROOM_SELECT,
  })

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:rooms:put", getClientIp(req)),
    limit: 60,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await context.params
  const roomId = toRoomId(id)
  if (!roomId) {
    return NextResponse.json({ error: "Invalid room id." }, { status: 400 })
  }

  const roomDelegate = getRoomDelegate()
  if (!roomDelegate) {
    return prismaRoomRouteError(
      { code: "P2021", name: "PrismaClientKnownRequestError" },
      "Unable to update room.",
      "Staff rooms PUT failed"
    )
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const currentRoom = await loadRoom(roomDelegate, roomId)
  if (!currentRoom) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 })
  }

  const body = payload as Record<string, unknown>
  const hasName = Object.prototype.hasOwnProperty.call(body, "name")
  const hasCapacity = Object.prototype.hasOwnProperty.call(body, "capacity")
  const hasLocation = Object.prototype.hasOwnProperty.call(body, "location")
  const nextActive = toOptionalBoolean(body.active) ?? currentRoom.active
  const nextName = hasName ? toSafeRoomText(body.name, 100) : currentRoom.name
  const nextCapacity = hasCapacity ? toPositiveInt(body.capacity) : currentRoom.capacity
  const nextLocation = hasLocation ? toOptionalRoomLocation(body.location) : currentRoom.location

  if (!nextName) {
    return NextResponse.json({ error: "Room name is required." }, { status: 400 })
  }
  if (nextCapacity === null) {
    return NextResponse.json({ error: "Room capacity must be an integer greater than 0." }, { status: 400 })
  }

  const isDeactivation = currentRoom.active && !nextActive
  if (isDeactivation) {
    if (!canDisableOrReassignRoom({ role: authResult.role, category: authResult.category })) {
      return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
    }

    const usage = await hasBlockingScheduledSessions(roomId)
    if (usage.hasBlockingUsage) {
      return NextResponse.json(
        {
          error: "Cannot disable room while there are sessions or reservations in the next 24 hours.",
          blockers: [...usage.blockers, ...usage.reservationBlockers],
        },
        { status: 409 }
      )
    }
  }

  try {
    const room = await roomDelegate.update({
      where: { id: roomId },
      data: {
        name: nextName,
        capacity: nextCapacity,
        location: nextLocation,
        active: nextActive,
      },
      select: ROOM_SELECT,
    })

    return NextResponse.json({
      ok: true,
      item: serializeRoom(room),
      message: "Room updated.",
    })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "A room with this name already exists." }, { status: 409 })
    }

    return prismaRoomRouteError(error, "Unable to update room.", "Staff rooms PUT failed")
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:rooms:delete", getClientIp(req)),
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again in a moment." }, { status: 429 })
  }

  const authResult = await authorizeStaffPortalRequest()
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { id } = await context.params
  const roomId = toRoomId(id)
  if (!roomId) {
    return NextResponse.json({ error: "Invalid room id." }, { status: 400 })
  }

  const roomDelegate = getRoomDelegate()
  if (!roomDelegate) {
    return prismaRoomRouteError(
      { code: "P2021", name: "PrismaClientKnownRequestError" },
      "Unable to disable room.",
      "Staff rooms DELETE failed"
    )
  }

  const currentRoom = await loadRoom(roomDelegate, roomId)
  if (!currentRoom) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 })
  }

  if (!canDisableOrReassignRoom({ role: authResult.role, category: authResult.category })) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 })
  }

  if (currentRoom.active) {
    const usage = await hasBlockingScheduledSessions(roomId)
    if (usage.hasBlockingUsage) {
      if (roomAuditLogDelegate) {
        await roomAuditLogDelegate.create({
          data: buildRoomLifecycleAuditPayload({
            action: "room_disable",
            actorClerkUserId: authResult.userId,
            actorRole: authResult.role,
            outcome: "denied",
            roomId: currentRoom.id,
            roomNameSnapshot: currentRoom.name,
            blockers: [...usage.blockers, ...usage.reservationBlockers],
          }),
        })
      }
      return NextResponse.json(
        {
          error: "Cannot disable room while there are sessions or reservations in the next 24 hours.",
          blockers: [...usage.blockers, ...usage.reservationBlockers],
        },
        { status: 409 }
      )
    }
  }

  if (!currentRoom.active) {
    return NextResponse.json({
      ok: true,
      item: serializeRoom(currentRoom),
      message: "Room already inactive.",
    })
  }

  try {
    const room = await roomDelegate.update({
      where: { id: roomId },
      data: { active: false },
      select: ROOM_SELECT,
    })

    if (roomAuditLogDelegate) {
      await roomAuditLogDelegate.create({
        data: buildRoomLifecycleAuditPayload({
          action: "room_disable",
          actorClerkUserId: authResult.userId,
          actorRole: authResult.role,
          outcome: "success",
          roomId: room.id,
          roomNameSnapshot: room.name,
        }),
      })
    }

    return NextResponse.json({
      ok: true,
      item: serializeRoom(room),
      message: "Room disabled.",
    })
  } catch (error) {
    return prismaRoomRouteError(error, "Unable to disable room.", "Staff rooms DELETE failed")
  }
}
