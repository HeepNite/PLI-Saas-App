import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const ROOM_SELECT = {
  id: true,
  name: true,
  capacity: true,
  location: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const

export type RoomRecord = {
  id: string
  name: string
  capacity: number
  location: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export const toSafeRoomText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : ""

export const toOptionalRoomLocation = (value: unknown) => {
  const normalized = toSafeRoomText(value, 200)
  return normalized ? normalized : null
}

export const toPositiveInt = (value: unknown) => {
  const normalized = typeof value === "string" ? value.trim() : value
  if (normalized === "" || normalized === null || normalized === undefined) return null

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

export const toOptionalBoolean = (value: unknown) => (typeof value === "boolean" ? value : null)

export const toRoomId = (value: unknown) => {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  return UUID_REGEX.test(normalized) ? normalized : null
}

export const serializeRoom = (room: RoomRecord) => ({
  id: room.id,
  name: room.name,
  capacity: room.capacity,
  location: room.location,
  active: room.active,
})

export const isPrismaSchemaOutOfSyncError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022"
  }

  if (!error || typeof error !== "object") return false

  const fallbackName = "name" in error ? String(error.name) : ""
  const fallbackCode = "code" in error ? String(error.code) : ""
  return fallbackName === "PrismaClientKnownRequestError" && (fallbackCode === "P2021" || fallbackCode === "P2022")
}

export const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"

export const prismaRoomRouteError = (error: unknown, fallbackMessage: string, logLabel: string) => {
  if (isPrismaSchemaOutOfSyncError(error)) {
    return NextResponse.json(
      { error: "Database schema is out of sync. Run Prisma migrations (npx prisma migrate deploy)." },
      { status: 503 }
    )
  }

  console.error(logLabel, error)
  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}

export const roomHasScheduledUsage = (sessions: Array<{ startsAt: Date; durationMinutes: number | null }>, now: Date) =>
  sessions.some((session) => {
    if (session.startsAt >= now) return true
    if (!session.durationMinutes || session.durationMinutes <= 0) return false

    const endsAt = new Date(session.startsAt.getTime() + session.durationMinutes * 60_000)
    return endsAt > now
  })

export const parsePositiveSearchParam = (value: string | null, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

export const parseActiveSearchParam = (value: string | null) => {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  if (normalized === "true") return true
  if (normalized === "false") return false
  return null
}

export const buildRoomListWhere = (query: string, active: boolean | null) => ({
  ...(active === null ? {} : { active }),
  ...(query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { location: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {}),
})
