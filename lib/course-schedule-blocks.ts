import { getTimesForWeekday } from "@/lib/schedule-rules"

const TIME_REGEX = /^\d{2}:\d{2}$/
const SCHOOL_TIMEZONE = "America/New_York"
const HORIZON_DAYS = 90

export type CourseScheduleLike = {
  scheduleRules: unknown
  availableWeekdays: number[]
  availableTimes: string[]
  defaultRoomId: string | null
  durationMinutes: number | null
}

export type ScheduleSlot = {
  startsAt: Date
  endsAt: Date
}

/**
 * Get the date string (YYYY-MM-DD) for a UTC Date in a specific timezone.
 */
function getDateKeyInTz(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const year = parts.find((p) => p.type === "year")?.value ?? ""
  const month = parts.find((p) => p.type === "month")?.value ?? ""
  const day = parts.find((p) => p.type === "day")?.value ?? ""
  if (!year || !month || !day) return ""
  return `${year}-${month}-${day}`
}

/**
 * Compute the start of a given day in the specified timezone as a UTC Date.
 * Dynamically handles DST transitions.
 */
function getStartOfDayInTz(dateStr: string, timeZone: string): Date {
  // Use noon UTC as reference point (safe from DST transition edges)
  const ref = new Date(`${dateStr}T12:00:00Z`)
  const tzHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).format(ref)
  const tzHour = parseInt(tzHourStr, 10)
  // At noon UTC (12:00), the tz hour tells us the offset
  const offsetHours = 12 - tzHour
  return new Date(`${dateStr}T${String(offsetHours).padStart(2, "0")}:00:00Z`)
}

/**
 * Expand a course's schedule rules into concrete UTC time slots within a window.
 *
 * @param course — course with scheduleRules or availableWeekdays/availableTimes
 * @param windowStart — start of the search window (UTC)
 * @param windowEnd — end of the search window (UTC)
 * @param timezone — timezone for wall-clock interpretation (default: America/New_York)
 * @returns array of { startsAt, endsAt } sorted by startsAt
 */
export function expandCourseScheduleSlots(
  course: CourseScheduleLike,
  windowStart: Date,
  windowEnd: Date,
  timezone = SCHOOL_TIMEZONE
): ScheduleSlot[] {
  const slots: ScheduleSlot[] = []

  // Determine the effective horizon: min of windowEnd and windowStart + 90 days
  const horizonMs = windowStart.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000
  const effectiveEnd = new Date(Math.min(windowEnd.getTime(), horizonMs))

  // Resolve schedule rules: scheduleRules (priority) or fallback to availableWeekdays + availableTimes
  const ruleTimes = getTimesForWeekday // we'll use this per-day
  const parsedRules = parseScheduleRules(course.scheduleRules)
  const hasRules = parsedRules !== null && parsedRules.rules.length > 0
  const hasFallback =
    Array.isArray(course.availableWeekdays) &&
    course.availableWeekdays.length > 0 &&
    Array.isArray(course.availableTimes) &&
    course.availableTimes.length > 0

  if (!hasRules && !hasFallback) return slots

  const durationMinutes = Number.isFinite(course.durationMinutes)
    ? Math.max(1, Math.round(course.durationMinutes as number))
    : 60

  // Iterate day by day from windowStart to effectiveEnd
  const current = new Date(windowStart)
  // Normalize to start of day in the target timezone
  const startDayKey = getDateKeyInTz(current, timezone)
  if (!startDayKey) return slots

  let dayKey = startDayKey
  let dayStart = getStartOfDayInTz(dayKey, timezone)

  while (dayStart < effectiveEnd) {
    const jsWeekday = dayStart.getDay() // 0=Sun, 1=Mon, ... 6=Sat

    // Get times for this weekday
    let times: string[] | null = null
    if (hasRules) {
      times = getTimesForWeekday(course.scheduleRules, jsWeekday)
    }
    if (!times && hasFallback && course.availableWeekdays.includes(jsWeekday)) {
      times = course.availableTimes
    }

    if (times && times.length > 0) {
      for (const timeStr of times) {
        if (!TIME_REGEX.test(timeStr)) continue

        const [hour, minute] = timeStr.split(":").map((n) => parseInt(n, 10))
        const slotStart = new Date(dayStart.getTime() + hour * 3600000 + minute * 60000)
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)

        // Only include slots within the original window
        if (slotStart >= windowStart && slotStart < windowEnd) {
          slots.push({ startsAt: slotStart, endsAt: slotEnd })
        }
      }
    }

    // Advance to next day
    dayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    dayKey = getDateKeyInTz(dayStart, timezone)
    if (!dayKey) break
    dayStart = getStartOfDayInTz(dayKey, timezone)
  }

  // Sort by startsAt
  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  return slots
}

/**
 * Safely parse scheduleRules from unknown JSON value.
 */
function parseScheduleRules(value: unknown): { rules: Array<{ weekday: number; times: string[] }> } | null {
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  if (!Array.isArray(obj.rules)) return null
  return obj as unknown as { rules: Array<{ weekday: number; times: string[] }> }
}
