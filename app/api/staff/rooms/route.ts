import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authorizeStaffPortalRequest } from "@/lib/security/staff-portal-auth"
import { buildRateLimitKey, consumeRateLimit, getClientIp } from "@/lib/security/rate-limit"
import {
  isUniqueConstraintError,
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

const parsePositiveParam = (value: string | null, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

const parseActiveFilter = (value: string | null) => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === "true") return true
  if (normalized === "false") return false
  return null
}

export async function GET(req: Request) {
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:rooms:get", getClientIp(req)),
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

  const requestUrl = new URL(req.url)
  const query = toSafeRoomText(requestUrl.searchParams.get("q"), 100)
  const active = parseActiveFilter(requestUrl.searchParams.get("active"))
  const page = parsePositiveParam(requestUrl.searchParams.get("page"), DEFAULT_PAGE)
  const pageSize = Math.min(parsePositiveParam(requestUrl.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE)

  const where = {
    ...(active === null ? {} : { active }),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { location: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

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
  const rateLimit = consumeRateLimit({
    key: buildRateLimitKey("staff:rooms:post", getClientIp(req)),
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
