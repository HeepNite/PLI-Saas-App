import type { CourseData } from "@/constants/courses"
import { getAvailableTimesForCourseDate, getDateKeyInTimeZone, getTimeKeyInTimeZone } from "@/lib/class-schedule"

const CHECKIN_TIME_ZONE = "America/New_York"
const CHECKIN_LATE_GRACE_MINUTES = 20
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_24_REGEX = /^\d{2}:\d{2}$/

type EnrollCheckInContext = {
  date?: string
  time?: string
  durationMinutes?: number
}

const normalizeIsoDate = (value: unknown) => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return ISO_DATE_REGEX.test(trimmed) ? trimmed : ""
}

const normalizeTime24 = (value: unknown) => {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  return TIME_24_REGEX.test(trimmed) ? trimmed : ""
}

const pad = (value: number) => String(value).padStart(2, "0")

const toMinutes = (time24: string) => {
  if (!TIME_24_REGEX.test(time24)) return null
  const [hour, minute] = time24.split(":").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

const to12hLabel = (time24: string) => {
  const minutes = toMinutes(time24)
  if (minutes === null) return time24
  const hour24 = Math.floor(minutes / 60)
  const minute = minutes % 60
  const ampm = hour24 >= 12 ? "PM" : "AM"
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${pad(minute)} ${ampm}`
}

export const formatCheckInSummaryDateTime = (dateIso: string, time24: string, timeZone = CHECKIN_TIME_ZONE) => {
  const normalizedDate = normalizeIsoDate(dateIso)
  const normalizedTime = normalizeTime24(time24)
  if (!normalizedDate || !normalizedTime) return "—"

  const [year, month, day] = normalizedDate.split("-").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return `${normalizedDate} · ${to12hLabel(normalizedTime)}`
  }

  const stableDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(stableDate)

  return `${dateLabel} · ${to12hLabel(normalizedTime)}`
}

const sortTime24 = (values: string[]) =>
  [...new Set(values.filter((value) => TIME_24_REGEX.test(value)))].sort((a, b) => (toMinutes(a) ?? 0) - (toMinutes(b) ?? 0))

const shiftIsoDate = (isoDate: string, days: number) => {
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return isoDate
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

const pickSlotForNow = (sortedSlots: string[], nowMinutes: number | null) => {
  if (!sortedSlots.length) return ""
  if (nowMinutes === null) return sortedSlots[0]
  for (const slot of sortedSlots) {
    const slotMinutes = toMinutes(slot)
    if (slotMinutes === null) continue
    if (nowMinutes <= slotMinutes + CHECKIN_LATE_GRACE_MINUTES) {
      return slot
    }
  }
  return ""
}

const isEligibleForTodayCheckIn = (slot: string, nowMinutes: number | null) => {
  if (nowMinutes === null) return true
  const slotMinutes = toMinutes(slot)
  if (slotMinutes === null) return false
  return nowMinutes <= slotMinutes + CHECKIN_LATE_GRACE_MINUTES
}

const findNextCourseSlot = (courseSlug: string, baseDateIso: string, nowMinutes: number | null, courses: CourseData[], maxDays = 14) => {
  for (let offset = 0; offset <= maxDays; offset += 1) {
    const dateIso = shiftIsoDate(baseDateIso, offset)
    const daySlots = sortTime24(getAvailableTimesForCourseDate(courseSlug, dateIso, courses))
    if (!daySlots.length) continue
    const candidates = offset === 0 ? daySlots.filter((slot) => isEligibleForTodayCheckIn(slot, nowMinutes)) : daySlots
    if (!candidates.length) continue
    const selected = offset === 0 ? pickSlotForNow(candidates, nowMinutes) || candidates[0] : candidates[0]
    if (selected) {
      return { date: dateIso, time: selected }
    }
  }
  return null as null | { date: string; time: string }
}

const findNextDifferentCourseSlot = (courseSlug: string, dateIso: string, nowMinutes: number, courses: CourseData[]) => {
  let candidate: { title: string; time: string; minutes: number } | null = null
  for (const possibleCourse of courses) {
    if (possibleCourse.slug === courseSlug) continue
    const slots = sortTime24(getAvailableTimesForCourseDate(possibleCourse.slug, dateIso, courses))
    for (const slot of slots) {
      const slotMinutes = toMinutes(slot)
      if (slotMinutes === null || slotMinutes <= nowMinutes) continue
      if (!candidate || slotMinutes < candidate.minutes) {
        candidate = { title: possibleCourse.title, time: slot, minutes: slotMinutes }
      }
    }
  }
  return candidate
}

export const computeCheckInAutofill = (
  courseSlug: string,
  courses: CourseData[],
  context?: EnrollCheckInContext,
  referenceDate = new Date(),
  /** When true, restrict autofill to today only — never resolve a future date.
   *  Use for kiosk terminal and QR flows where purchases must be for the current day. */
  todayOnly = false,
) => {
  const nowDateIso = getDateKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  const nowTimeKey = getTimeKeyInTimeZone(referenceDate, CHECKIN_TIME_ZONE)
  const nowMinutes = toMinutes(nowTimeKey)
  const contextDate = normalizeIsoDate(context?.date)
  const contextTime = normalizeTime24(context?.time)

  if (contextDate && contextTime) {
    return { date: contextDate, time: contextTime, notice: null as string | null }
  }

  const todaySlots = nowDateIso ? sortTime24(getAvailableTimesForCourseDate(courseSlug, nowDateIso, courses)) : []
  const contextSlots = contextDate ? sortTime24(getAvailableTimesForCourseDate(courseSlug, contextDate, courses)) : []

  const contextIsValid =
    Boolean(contextDate && contextTime && contextSlots.includes(contextTime)) &&
    Boolean(!nowDateIso || contextDate > nowDateIso || (contextDate === nowDateIso && isEligibleForTodayCheckIn(contextTime, nowMinutes)))

  const maxDays = todayOnly ? 0 : 14
  const nextSlotFromNow = nowDateIso ? findNextCourseSlot(courseSlug, nowDateIso, nowMinutes, courses, maxDays) : null

  let targetDate = ""
  let targetTime = ""
  let notice: string | null = null

  if (contextIsValid && contextDate && contextTime) {
    targetDate = contextDate
    targetTime = contextTime
  } else if (nextSlotFromNow) {
    targetDate = nextSlotFromNow.date
    targetTime = nextSlotFromNow.time
  } else if (contextDate && contextSlots.length > 0) {
    targetDate = contextDate
    targetTime = contextTime && contextSlots.includes(contextTime) ? contextTime : contextSlots[0]
  } else if (todaySlots.length > 0 && nowDateIso) {
    targetDate = nowDateIso
    targetTime = pickSlotForNow(todaySlots, nowMinutes) || todaySlots[0]
  } else {
    targetDate = contextDate || nowDateIso || ""
    targetTime = contextTime || ""
  }

  if (!targetDate || !targetTime) {
    return { date: targetDate, time: targetTime, notice: null as string | null }
  }

  if (nowDateIso && nowMinutes !== null && targetDate !== nowDateIso && todaySlots.length > 0) {
    const hasAvailableTodaySlot = todaySlots.some((slot) => isEligibleForTodayCheckIn(slot, nowMinutes))
    if (!hasAvailableTodaySlot) {
      const nextDifferentCourse = findNextDifferentCourseSlot(courseSlug, nowDateIso, nowMinutes, courses)
      if (nextDifferentCourse) {
        notice = `A schedule is available later: ${nextDifferentCourse.title} at ${to12hLabel(nextDifferentCourse.time)}.`
      }
    }
  }

  return { date: targetDate, time: targetTime, notice }
}
