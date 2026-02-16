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

export const validateCheckInBody = (body: CheckInBody): CheckInPayload | ValidationError => {
  const courseSlug = sanitizeString(body.courseSlug, 120)?.toLowerCase()
  if (!courseSlug || !SLUG_REGEX.test(courseSlug)) {
    return { status: 400, error: "Invalid courseSlug" }
  }

  const emailRaw = sanitizeString(body.email, 254)?.toLowerCase()
  const email = emailRaw && EMAIL_REGEX.test(emailRaw) ? emailRaw : undefined
  const userClerkId = sanitizeString(body.userClerkId, 128)

  if (!userClerkId && !email) {
    return { status: 400, error: "Missing userClerkId or valid email" }
  }

  const durationMinutes = parseDuration(body.durationMinutes)
  if (durationMinutes === null) {
    return { status: 400, error: "Invalid durationMinutes" }
  }

  const startsAt = parseDate(body.startsAt)
  if (body.startsAt !== undefined && !startsAt) {
    return { status: 400, error: "Invalid startsAt date" }
  }

  const sessionTitle = sanitizeString(body.sessionTitle, 140)
  const location = sanitizeString(body.location, 180)
  const notes = sanitizeString(body.notes, 500)

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
