import { buildSessionStartsAt, getCourseBySlug, getDateKeyInTimeZone } from "@/lib/class-schedule"
import { SLUG_REGEX } from "@/lib/shared"

export const QR_CHECKIN_OPEN_BEFORE_MS = 2 * 60 * 60 * 1000
export const QR_CHECKIN_CLOSE_AFTER_END_MS = 2 * 60 * 60 * 1000

export const DEFAULT_DURATION_MINUTES = 60
const MIN_DURATION_MINUTES = 15
const MAX_DURATION_MINUTES = 240
const isDevCheckInBypassEnabled = () => process.env.NODE_ENV !== "production"

export type QrCheckInContext = {
  courseSlug: string
  date: string
  time: string
  durationMinutes: number
  startsAt: Date
  endsAt: Date
  opensAt: Date
  closesAt: Date
}

type ValidationError = { status: number; error: string }

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return ""
  return value.trim()
}

const parseDurationMinutes = (value: unknown) => {
  if (value === undefined || value === null || value === "") return DEFAULT_DURATION_MINUTES
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const rounded = Math.round(parsed)
  if (rounded < MIN_DURATION_MINUTES || rounded > MAX_DURATION_MINUTES) return null
  return rounded
}

export const parseQrCheckInContext = (
  input: {
    courseSlug?: unknown
    date?: unknown
    time?: unknown
    durationMinutes?: unknown
  },
  options?: { requireKnownCourse?: boolean }
): QrCheckInContext | ValidationError => {
  const courseSlug = normalizeString(input.courseSlug).toLowerCase()
  if (!courseSlug || !SLUG_REGEX.test(courseSlug)) {
    return { status: 400, error: "Invalid courseSlug" }
  }

  if (options?.requireKnownCourse && !getCourseBySlug(courseSlug)) {
    return { status: 404, error: "Course not found" }
  }

  const date = normalizeString(input.date)
  const time = normalizeString(input.time)
  const startsAt = buildSessionStartsAt(date, time)
  if (!startsAt) {
    return { status: 400, error: "Invalid date/time" }
  }

  const durationMinutes = parseDurationMinutes(input.durationMinutes)
  if (durationMinutes === null) {
    return { status: 400, error: "Invalid durationMinutes" }
  }

  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000)
  const opensAt = new Date(startsAt.getTime() - QR_CHECKIN_OPEN_BEFORE_MS)
  const closesAt = new Date(endsAt.getTime() + QR_CHECKIN_CLOSE_AFTER_END_MS)

  return {
    courseSlug,
    date,
    time,
    durationMinutes,
    startsAt,
    endsAt,
    opensAt,
    closesAt,
  }
}

export const isQrCheckInWindowOpen = (context: QrCheckInContext, now = new Date()) => {
  if (isDevCheckInBypassEnabled()) return true
  const nowMs = now.getTime()
  return nowMs >= context.opensAt.getTime() && nowMs <= context.closesAt.getTime()
}

export const isQrCheckInWindowAllowed = (context: QrCheckInContext, now = new Date()) => {
  if (isDevCheckInBypassEnabled()) return true
  return isQrCheckInWindowOpen(context, now)
}

export const isQrActionWindowAllowed = (
  mode: "standard" | "terminal" | "consecutive-add-on",
  context: QrCheckInContext,
  now = new Date()
) => {
  if (mode === "terminal") return isTerminalCheckInAllowed(context, now)
  if (mode === "consecutive-add-on") return isConsecutiveAddOnPurchaseAllowed(context, now)
  return isQrCheckInWindowAllowed(context, now)
}

// The ONLY window is the class DAY (America/New_York). The consecutive add-on
// stays available the whole day of the class and closes only when the NY day
// ends (midnight) — no lower bound, no end-of-class (`endsAt`) or grace
// (`closesAt`) cutoff. `context.date` is the class's NY calendar day (YYYY-MM-DD).
export const isConsecutiveAddOnPurchaseAllowed = (context: QrCheckInContext, now = new Date()) => {
  if (isDevCheckInBypassEnabled()) return true
  return getDateKeyInTimeZone(now) === context.date
}

// The ONLY window is the class DAY (America/New_York): terminal check-in is
// open the whole day of the class and closes only when the NY day ends. No
// pre-class lower bound and no post-class grace cutoff — the kiosk is on the
// owner's premises with cash/physical purchases only, so there is no abuse risk.
export const isTerminalCheckInAllowed = (context: QrCheckInContext, now = new Date()) => {
  if (isDevCheckInBypassEnabled()) return true
  return getDateKeyInTimeZone(now) === context.date
}
