export type CheckInPayload = {
  userClerkId?: string
  email?: string
  courseSlug: string
  sessionTitle?: string
  startsAt?: Date
  durationMinutes: number
  location?: string
  roomId?: string
  notes?: string
}

export type CheckOutPayload = {
  attendanceId: string
}

type CheckInBody = {
  userClerkId?: unknown
  email?: unknown
  courseSlug?: unknown
  sessionTitle?: unknown
  startsAt?: unknown
  durationMinutes?: unknown
  location?: unknown
  roomId?: unknown
  notes?: unknown
}

type CheckOutBody = {
  attendanceId?: unknown
}

type ValidationError = { status: number; error: string }

import { EMAIL_REGEX, SLUG_REGEX } from "@/lib/shared"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const sanitizeString = (value: unknown, max = 180) => {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.length > max) return undefined
  return trimmed
}

const parseDate = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed
}

const parseDuration = (value: unknown) => {
  if (value === undefined || value === null) return 60
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  const rounded = Math.round(numeric)
  if (rounded < 15 || rounded > 240) return null
  return rounded
}

const parseOptionalUuid = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined
  const normalized = sanitizeString(value, 36)
  if (!normalized || !UUID_REGEX.test(normalized)) return null
  return normalized.toLowerCase()
}

const toCheckInBody = (body: unknown): CheckInBody | null => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  return body as CheckInBody
}

export const validateCheckInBody = (body: unknown): CheckInPayload | ValidationError => {
  const checkInBody = toCheckInBody(body)
  if (!checkInBody) {
    return { status: 400, error: "Invalid request body" }
  }

  const courseSlug = sanitizeString(checkInBody.courseSlug, 120)?.toLowerCase()
  if (!courseSlug || !SLUG_REGEX.test(courseSlug)) {
    return { status: 400, error: "Invalid courseSlug" }
  }

  const emailRaw = sanitizeString(checkInBody.email, 254)?.toLowerCase()
  const email = emailRaw && EMAIL_REGEX.test(emailRaw) ? emailRaw : undefined
  const userClerkId = sanitizeString(checkInBody.userClerkId, 128)

  if (!userClerkId && !email) {
    return { status: 400, error: "Missing userClerkId or valid email" }
  }

  const durationMinutes = parseDuration(checkInBody.durationMinutes)
  if (durationMinutes === null) {
    return { status: 400, error: "Invalid durationMinutes" }
  }

  const startsAt = parseDate(checkInBody.startsAt)
  if (checkInBody.startsAt !== undefined && !startsAt) {
    return { status: 400, error: "Invalid startsAt date" }
  }

  const sessionTitle = sanitizeString(checkInBody.sessionTitle, 140)
  const location = sanitizeString(checkInBody.location, 180)
  const roomId = parseOptionalUuid(checkInBody.roomId)
  if (roomId === null) {
    return { status: 400, error: "Invalid roomId" }
  }
  const notes = sanitizeString(checkInBody.notes, 500)

  return {
    userClerkId,
    email,
    courseSlug,
    sessionTitle,
    startsAt,
    durationMinutes,
    location,
    roomId,
    notes,
  }
}

export const validateCheckOutBody = (body: unknown): CheckOutPayload | ValidationError => {
  const checkOutBody = toCheckInBody(body) as CheckOutBody | null
  if (!checkOutBody) {
    return { status: 400, error: "Invalid request body" }
  }

  const attendanceId = sanitizeString(checkOutBody.attendanceId, 128)
  if (!attendanceId) {
    return { status: 400, error: "Invalid attendanceId" }
  }

  return { attendanceId }
}
