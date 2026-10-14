import type { CourseData } from "@/constants/courses"
import { buildQrBookingUrl } from "@/lib/checkin/qr-booking-links"
import { getTimesForWeekday, parseScheduleRules } from "@/lib/schedule-rules"

const BOOKING_TIME_ZONE = "America/New_York"
const BOOKING_HORIZON_DAYS = 90
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type BookingClassType = "salsa-cubana" | "salsa-on2" | "bachata" | "other"
export type BookingClassTypeFilter = BookingClassType | "all"

export const BOOKING_CLASS_TYPE_LABELS: Record<BookingClassType, string> = {
  "salsa-cubana": "Salsa Cubana",
  "salsa-on2": "Salsa On2",
  bachata: "Bachata",
  other: "Other",
}

export type ShareableBookingOccurrence = {
  id: string
  slug: string
  title: string
  category: string | null
  level: string | null
  durationMinutes: number | null
  date: string
  monthKey: string
  time: string
  classType: BookingClassType
  coverImageUrl: string | null
  instructorName: string
  bookingUrl: string
}

export type BookingOccurrenceGroup = {
  date: string
  occurrences: ShareableBookingOccurrence[]
}

const getZonedParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export const getCurrentBookingDateKey = (date = new Date()) => {
  const parts = getZonedParts(date)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export const getCurrentBookingMonthKey = (date = new Date()) => getCurrentBookingDateKey(date).slice(0, 7)

const getCurrentMinuteKey = (date: Date) => {
  const parts = getZonedParts(date)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

const addDaysToDateKey = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days, 12))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

const getJsWeekdayForDateKey = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`).getUTCDay()

const parseDurationMinutes = (duration: string) => {
  const match = duration.match(/\d+/)
  if (!match) return null
  const value = Number.parseInt(match[0], 10)
  return Number.isFinite(value) && value >= 15 && value <= 240 ? value : null
}

const getRuleBoundaryDate = (value: unknown) => {
  if (typeof value !== "string") return null
  const date = value.slice(0, 10)
  return DATE_PATTERN.test(date) ? date : null
}

const getPublicationLaunchDate = (publication: unknown) => {
  if (!publication || typeof publication !== "object") return null
  return getRuleBoundaryDate((publication as Record<string, unknown>).launchDate)
}

const getCourseTimesForDate = (course: CourseData, dateKey: string) => {
  const jsWeekday = getJsWeekdayForDateKey(dateKey)
  const rules = parseScheduleRules(course.scheduleRules)
  const recurrenceEndsAt = getRuleBoundaryDate(rules?.recurrenceEndsAt)
  if (recurrenceEndsAt && dateKey > recurrenceEndsAt) return []
  const launchDate = getPublicationLaunchDate(rules?.publication)
  if (launchDate && dateKey < launchDate) return []

  if (rules?.rules?.length) {
    return (getTimesForWeekday(course.scheduleRules, jsWeekday) ?? []).filter((time) => TIME_PATTERN.test(time))
  }

  const monBasedWeekday = (jsWeekday + 6) % 7
  if (course.schedule.availableWeekdays?.length && !course.schedule.availableWeekdays.includes(monBasedWeekday)) {
    return []
  }
  return (course.schedule.availableTimes ?? []).filter((time) => TIME_PATTERN.test(time))
}

export const classifyBookingClass = (course: Pick<CourseData, "category" | "title" | "slug">): BookingClassType => {
  const source = `${course.category ?? ""} ${course.title} ${course.slug}`.toLowerCase()
  if (/\bbachata\b/.test(source)) return "bachata"
  if (/\bon\s*2\b|\bon2\b|\bmambo\b/.test(source)) return "salsa-on2"
  if (/\bsalsa\b|\btimba\b|\brueda\b|\bcuban(?:a)?\b/.test(source)) return "salsa-cubana"
  return "other"
}

export const buildShareableBookingOccurrences = (
  courses: readonly CourseData[],
  now = new Date(),
  horizonDays = BOOKING_HORIZON_DAYS
): ShareableBookingOccurrence[] => {
  const firstDate = getCurrentBookingDateKey(now)
  const currentMinuteKey = getCurrentMinuteKey(now)
  const boundedDays = Math.max(1, Math.min(BOOKING_HORIZON_DAYS, Math.floor(horizonDays)))
  const occurrences: ShareableBookingOccurrence[] = []

  for (let offset = 0; offset < boundedDays; offset += 1) {
    const date = addDaysToDateKey(firstDate, offset)
    for (const course of courses) {
      const durationMinutes = parseDurationMinutes(course.duration)
      for (const time of getCourseTimesForDate(course, date)) {
        if (`${date}T${time}` <= currentMinuteKey) continue
        occurrences.push({
          id: `${course.slug}:${date}:${time}`,
          slug: course.slug,
          title: course.title,
          category: course.category ?? null,
          level: course.level ?? null,
          durationMinutes,
          date,
          monthKey: date.slice(0, 7),
          time,
          classType: classifyBookingClass(course),
          coverImageUrl: course.heroMedia?.image ?? null,
          instructorName: course.instructors.map(({ name }) => name.trim()).find(Boolean) ?? "PLI Team",
          bookingUrl: buildQrBookingUrl({
            courseSlug: course.slug,
            date,
            time,
            durationMinutes: durationMinutes ?? undefined,
          }),
        })
      }
    }
  }

  return occurrences.sort((left, right) =>
    left.date.localeCompare(right.date) ||
    left.time.localeCompare(right.time) ||
    left.title.localeCompare(right.title) ||
    left.slug.localeCompare(right.slug)
  )
}

export const getBookingFilterOptions = (occurrences: readonly ShareableBookingOccurrence[]) => {
  const months = [...new Set(occurrences.map(({ monthKey }) => monthKey))].sort()
  const representedTypes = new Set(occurrences.map(({ classType }) => classType))
  const classTypes = (["salsa-cubana", "salsa-on2", "bachata", "other"] as const)
    .filter((classType) => representedTypes.has(classType))
  return { months, classTypes }
}

const normalizeSearchText = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim()

export const filterBookingOccurrences = (
  occurrences: readonly ShareableBookingOccurrence[],
  month: string | "all",
  classType: BookingClassTypeFilter,
  searchQuery = ""
) => {
  const query = normalizeSearchText(searchQuery)
  return occurrences.filter((occurrence) => {
    const matchesSearch = !query || normalizeSearchText([
      occurrence.title,
      occurrence.category ?? "",
      occurrence.slug,
      occurrence.instructorName,
      BOOKING_CLASS_TYPE_LABELS[occurrence.classType],
    ].join(" ")).includes(query)

    return (
      (month === "all" || occurrence.monthKey === month) &&
      (classType === "all" || occurrence.classType === classType) &&
      matchesSearch
    )
  })
}

export const groupBookingOccurrencesByDate = (
  occurrences: readonly ShareableBookingOccurrence[]
): BookingOccurrenceGroup[] => {
  const groups = new Map<string, ShareableBookingOccurrence[]>()
  for (const occurrence of occurrences) {
    const current = groups.get(occurrence.date)
    if (current) current.push(occurrence)
    else groups.set(occurrence.date, [occurrence])
  }
  return [...groups.entries()].map(([date, groupedOccurrences]) => ({ date, occurrences: groupedOccurrences }))
}
