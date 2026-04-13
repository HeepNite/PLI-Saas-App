import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import {
  isUniqueConstraintError,
  prismaRoomRouteError,
  roomHasScheduledUsage,
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

const SESSION_LOOKBACK_MS = 24 * 60 * 60 * 1000

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
  findMany: (args: unknown) => Promise<Array<{ startsAt: Date; durationMinutes: number | null }>>
}

const hasBlockingScheduledSessions = async (roomId: string) => {
  const now = new Date()
  const sessions = await classSessionDelegate.findMany({
    where: {
      roomId,
      startsAt: {
        gte: new Date(now.getTime() - SESSION_LOOKBACK_MS),
      },
    },
    orderBy: [{ startsAt: "desc" }],
    take: 100,
    select: {
      startsAt: true,
      durationMinutes: true,
    },
  })

  return roomHasScheduledUsage(sessions, now)
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
  if (isDeactivation && (await hasBlockingScheduledSessions(roomId))) {
    return NextResponse.json({ error: "Cannot deactivate a room with active or future sessions." }, { status: 422 })
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

  if (currentRoom.active && (await hasBlockingScheduledSessions(roomId))) {
    return NextResponse.json({ error: "Cannot deactivate a room with active or future sessions." }, { status: 422 })
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

    return NextResponse.json({
      ok: true,
      item: serializeRoom(room),
      message: "Room disabled.",
    })
  } catch (error) {
    return prismaRoomRouteError(error, "Unable to disable room.", "Staff rooms DELETE failed")
  }
}
