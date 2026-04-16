import { demoCourses, type CourseData } from "@/constants/courses"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^\d{2}:\d{2}$/

const toMonBasedWeekday = (date: Date) => (date.getDay() + 6) % 7 // Mon=0...Sun=6
type ScheduleCourseLike = Pick<CourseData, "slug" | "schedule" | "title">

export const parseIsoDate = (value: string) => {
  if (!DATE_REGEX.test(value)) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const parseTime24 = (value: string) => {
  if (!TIME_REGEX.test(value)) return null
  const [hour, minute] = value.split(":").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

export const buildSessionStartsAt = (dateIso: string, time24: string) => {
  const date = parseIsoDate(dateIso)
  const time = parseTime24(time24)
  if (!date || !time) return null
  const startsAt = new Date(date)
  startsAt.setHours(time.hour, time.minute, 0, 0)
  return Number.isNaN(startsAt.getTime()) ? null : startsAt
}

export const formatTime12h = (time24: string) => {
  const parsed = parseTime24(time24)
  if (!parsed) return time24
  const ampm = parsed.hour >= 12 ? "PM" : "AM"
  const h = parsed.hour % 12 || 12
  const mm = String(parsed.minute).padStart(2, "0")
  return `${h}:${mm} ${ampm}`
}

export const formatReadableDate = (dateIso: string) => {
  const parsed = parseIsoDate(dateIso)
  if (!parsed) return dateIso

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).formatToParts(parsed)

    const weekday = parts.find((part) => part.type === "weekday")?.value ?? ""
    const day = parts.find((part) => part.type === "day")?.value ?? ""
    const month = parts.find((part) => part.type === "month")?.value ?? ""
    const year = parts.find((part) => part.type === "year")?.value ?? ""

    if (!weekday || !day || !month || !year) return dateIso
    return `${weekday} ${day} ${month} ${year}`
  } catch {
    return dateIso
  }
}

const getLegacyFallbackTimes = (courseSlug: string, weekday: number) => {
  if (courseSlug === "salsa-nocturno") {
    if (weekday === 0 || weekday === 3) return ["21:10"]
    if (weekday === 1 || weekday === 4) return ["20:10"]
    if (weekday === 6) return ["17:00"]
  }
  return [] as string[]
}

export const getCourseBySlug = (
  courseSlug: string,
  courses: ScheduleCourseLike[] = demoCourses
) => courses.find((course) => course.slug === courseSlug) || null

export const getAvailableTimesForCourseDateFromCourse = (course: ScheduleCourseLike, dateIso: string) => {
  const date = parseIsoDate(dateIso)
  if (!date) return [] as string[]
  const weekday = toMonBasedWeekday(date)
  const schedule = course.schedule

  if (
    (!Array.isArray(schedule.availableWeekdays) || !schedule.availableWeekdays.length) &&
    (!Array.isArray(schedule.availableTimes) || !schedule.availableTimes.length)
  ) {
    return getLegacyFallbackTimes(course.slug, weekday)
  }

  if (Array.isArray(schedule.availableWeekdays) && schedule.availableWeekdays.length > 0) {
    if (!schedule.availableWeekdays.includes(weekday)) return []
  }

  if (Array.isArray(schedule.availableTimes) && schedule.availableTimes.length > 0) {
    return schedule.availableTimes.filter((value) => Boolean(parseTime24(value)))
  }

  return [] as string[]
}

export const getAvailableTimesForCourseDate = (
  courseSlug: string,
  dateIso: string,
  courses: ScheduleCourseLike[] = demoCourses
) => {
  const course = getCourseBySlug(courseSlug, courses)
  if (!course) return [] as string[]
  return getAvailableTimesForCourseDateFromCourse(course, dateIso)
}

export const isTimeAllowedForCourseDate = (courseSlug: string, dateIso: string, time24: string) => {
  const times = getAvailableTimesForCourseDate(courseSlug, dateIso)
  return times.includes(time24)
}

/**
 * Returns today's date in YYYY-MM-DD format using America/New_York timezone.
 * Uses Intl.DateTimeFormat with 'en-CA' locale for ISO format (no external deps).
 */
export function getTodayNewYork(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date())
}

export const getDateKeyInTimeZone = (value: Date, timeZone = "America/New_York") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value ?? ""
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""
  if (!year || !month || !day) return ""
  return `${year}-${month}-${day}`
}

export const getTimeKeyInTimeZone = (value: Date, timeZone = "America/New_York") => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value)
  const hour = parts.find((part) => part.type === "hour")?.value ?? ""
  const minute = parts.find((part) => part.type === "minute")?.value ?? ""
  if (!hour || !minute) return ""
  return `${hour}:${minute}`
}

export const isSlotInPastForTimeZone = (
  dateIso: string,
  time24: string,
  timeZone = "America/New_York",
  referenceDate = new Date()
) => {
  if (!DATE_REGEX.test(dateIso) || !parseTime24(time24)) return false
  const nowDateKey = getDateKeyInTimeZone(referenceDate, timeZone)
  const nowTimeKey = getTimeKeyInTimeZone(referenceDate, timeZone)
  if (!nowDateKey || !nowTimeKey) return false
  if (dateIso < nowDateKey) return true
  if (dateIso > nowDateKey) return false
  return time24 <= nowTimeKey
}

export type RoomOverlapSessionLike = {
  id: string
  roomId: string | null
  startsAt: Date
  durationMinutes: number | null
}

const isValidDate = (value: Date) => Number.isFinite(value.getTime())

export const buildSessionEndsAtUtc = (startsAt: Date, durationMinutes: number | null | undefined) => {
  if (!isValidDate(startsAt)) return null

  const normalizedDuration = Number.isFinite(durationMinutes)
    ? Math.max(0, Math.round(durationMinutes as number))
    : 0

  return new Date(startsAt.getTime() + normalizedDuration * 60_000)
}

export const doUtcIntervalsOverlap = (
  leftStartsAt: Date,
  leftEndsAt: Date,
  rightStartsAt: Date,
  rightEndsAt: Date
) => {
  if (!isValidDate(leftStartsAt) || !isValidDate(leftEndsAt) || !isValidDate(rightStartsAt) || !isValidDate(rightEndsAt)) {
    return false
  }

  const leftStartMs = leftStartsAt.getTime()
  const leftEndMs = leftEndsAt.getTime()
  const rightStartMs = rightStartsAt.getTime()
  const rightEndMs = rightEndsAt.getTime()

  if (leftEndMs <= leftStartMs || rightEndMs <= rightStartMs) return false
  return leftStartMs < rightEndMs && leftEndMs > rightStartMs
}

/**
 * Compute the start of a given day in America/New_York as a UTC Date.
 * Dynamically handles EDT (UTC-4) and EST (UTC-5).
 */
export function getStartOfDayNY(dateStr: string): Date {
  // Use noon UTC as reference point (safe from DST transition edges)
  const ref = new Date(`${dateStr}T12:00:00Z`)
  // Determine what hour it is in NY when it's noon UTC
  const nyHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  }).format(ref)
  const nyHour = parseInt(nyHourStr, 10)
  // At noon UTC (12:00), NY shows 8 (EDT=UTC-4) or 7 (EST=UTC-5)
  const offsetHours = 12 - nyHour
  // Midnight NY = offsetHours:00:00 UTC on that date
  return new Date(`${dateStr}T${String(offsetHours).padStart(2, "0")}:00:00Z`)
}

export const findOverlappingRoomSession = <Session extends RoomOverlapSessionLike>(
  sessions: Session[],
  options: {
    roomId: string | null | undefined
    startsAt: Date
    durationMinutes: number | null | undefined
    excludeSessionId?: string
  }
) => {
  if (!options.roomId || !isValidDate(options.startsAt)) return null

  const requestedEndsAt = buildSessionEndsAtUtc(options.startsAt, options.durationMinutes)
  if (!requestedEndsAt) return null

  for (const session of sessions) {
    if (session.roomId !== options.roomId) continue
    if (options.excludeSessionId && session.id === options.excludeSessionId) continue

    const existingEndsAt = buildSessionEndsAtUtc(session.startsAt, session.durationMinutes)
    if (!existingEndsAt) continue

    if (doUtcIntervalsOverlap(options.startsAt, requestedEndsAt, session.startsAt, existingEndsAt)) {
      return session
    }
  }

  return null
}
