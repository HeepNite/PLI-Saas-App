import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { withStaffGuard } from "@/lib/security/with-staff-guard"
import {
  buildRoomListWhere,
  isUniqueConstraintError,
  parseActiveSearchParam,
  parsePositiveSearchParam,
  prismaRoomRouteError,
  type RoomRecord,
  ROOM_SELECT,
  serializeRoom,
  toOptionalBoolean,
  toOptionalRoomLocation,
  toPositiveInt,
  toSafeRoomText,
} from "./shared"

export const runtime = "nodejs"

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

type RoomDelegate = {
  count: (args: unknown) => Promise<number>
  findMany: (args: unknown) => Promise<RoomRecord[]>
  create: (args: unknown) => Promise<RoomRecord>
}

const getRoomDelegate = (): RoomDelegate | null => {
  const room = (prisma as typeof prisma & {
    room?: RoomDelegate
  }).room

  return room ?? null
}

export async function GET(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:rooms:get", limit: 120, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response

  const requestUrl = new URL(req.url)
  const query = toSafeRoomText(requestUrl.searchParams.get("q"), 100)
  const active = parseActiveSearchParam(requestUrl.searchParams.get("active"))
  const page = parsePositiveSearchParam(requestUrl.searchParams.get("page"), DEFAULT_PAGE)
  const pageSize = Math.min(parsePositiveSearchParam(requestUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)

  const where = buildRoomListWhere(query, active)

  const roomDelegate = getRoomDelegate()
  if (!roomDelegate) {
    return prismaRoomRouteError(
      { code: "P2021", name: "PrismaClientKnownRequestError" },
      "Failed to load rooms.",
      "Staff rooms GET failed"
    )
  }

  try {
    const [total, rooms] = await Promise.all([
      roomDelegate.count({ where }),
      roomDelegate.findMany({
        where,
        select: ROOM_SELECT,
        orderBy: [{ name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      items: rooms.map(serializeRoom),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
      filters: {
        q: query || null,
        active,
      },
    })
  } catch (error) {
    return prismaRoomRouteError(error, "Failed to load rooms.", "Staff rooms GET failed")
  }
}

export async function POST(req: Request) {
  const guard = await withStaffGuard(req, {
    rateLimit: { scope: "staff:rooms:post", limit: 60, windowMs: 60_000 },
    authorize: () => authorizeStaffPortalRequest(),
  })
  if (!guard.ok) return guard.response

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const body = payload as Record<string, unknown>
  const name = toSafeRoomText(body.name, 100)
  const capacity = toPositiveInt(body.capacity)
  const location = toOptionalRoomLocation(body.location)
  const active = toOptionalBoolean(body.active) ?? true

  if (!name) {
    return NextResponse.json({ error: "Room name is required." }, { status: 400 })
  }
  if (capacity === null) {
    return NextResponse.json({ error: "Room capacity must be an integer greater than 0." }, { status: 400 })
  }

  const roomDelegate = getRoomDelegate()
  if (!roomDelegate) {
    return prismaRoomRouteError(
      { code: "P2021", name: "PrismaClientKnownRequestError" },
      "Unable to create room.",
      "Staff rooms POST failed"
    )
  }

  try {
    const room = await roomDelegate.create({
      data: {
        name,
        capacity,
        location,
        active,
      },
      select: ROOM_SELECT,
    })

    return NextResponse.json(
      {
        ok: true,
        item: serializeRoom(room),
        message: "Room created.",
      },
      { status: 201 }
    )
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "A room with this name already exists." }, { status: 409 })
    }

    return prismaRoomRouteError(error, "Unable to create room.", "Staff rooms POST failed")
  }
}
