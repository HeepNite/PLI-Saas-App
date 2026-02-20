import { demoCourses } from "@/constants/courses"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_REGEX = /^\d{2}:\d{2}$/

const toMonBasedWeekday = (date: Date) => (date.getDay() + 6) % 7 // Mon=0...Sun=6

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

export const getCourseBySlug = (courseSlug: string) => demoCourses.find((course) => course.slug === courseSlug) || null

export const getAvailableTimesForCourseDate = (courseSlug: string, dateIso: string) => {
  const date = parseIsoDate(dateIso)
  if (!date) return [] as string[]
  const course = getCourseBySlug(courseSlug)
  if (!course) return [] as string[]

  const weekday = toMonBasedWeekday(date)

  if (course.slug === "salsa-nocturno") {
    if (weekday === 0 || weekday === 3) return ["21:10"]
    if (weekday === 1 || weekday === 4) return ["20:10"]
    if (weekday === 6) return ["17:00"]
    return []
  }

  if (Array.isArray(course.schedule.availableWeekdays) && course.schedule.availableWeekdays.length > 0) {
    if (!course.schedule.availableWeekdays.includes(weekday)) return []
  }

  if (Array.isArray(course.schedule.availableTimes) && course.schedule.availableTimes.length > 0) {
    return course.schedule.availableTimes.filter((value) => Boolean(parseTime24(value)))
  }

  return [] as string[]
}

export const isTimeAllowedForCourseDate = (courseSlug: string, dateIso: string, time24: string) => {
  const times = getAvailableTimesForCourseDate(courseSlug, dateIso)
  return times.includes(time24)
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
