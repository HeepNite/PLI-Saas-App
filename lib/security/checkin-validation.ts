export type CheckInPayload = {
  userClerkId?: string
  email?: string
  courseSlug: string
  sessionTitle?: string
  startsAt?: Date
  durationMinutes: number
  location?: string
  notes?: string
}

type CheckInBody = {
  userClerkId?: unknown
  email?: unknown
  courseSlug?: unknown
  sessionTitle?: unknown
  startsAt?: unknown
  durationMinutes?: unknown
  location?: unknown
  notes?: unknown
}

type ValidationError = { status: number; error: string }

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
  const notes = sanitizeString(checkInBody.notes, 500)

  return {
    userClerkId,
    email,
    courseSlug,
    sessionTitle,
    startsAt,
    durationMinutes,
    location,
    notes,
  }
}
