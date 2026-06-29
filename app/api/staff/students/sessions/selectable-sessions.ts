import type { Prisma } from "@prisma/client"
import { parseQrCheckInContext } from "@/lib/checkin/qr"
import { getTimesForWeekday } from "@/lib/schedule-rules"

const STAFF_TIME_ZONE = "America/New_York"
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const STAFF_ATTENDANCE_BACKFILL_DAYS = 14
const SCHEDULED_SESSION_PREFIX = "scheduled"

const addDaysToDateKey = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10))
  const value = new Date(Date.UTC(year, month - 1, day + days))
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`
}

const getTimeZoneOffsetMinutes = (value: Date, timeZone = STAFF_TIME_ZONE) => {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(value).find((part) => part.type === "timeZoneName")?.value || "GMT"
  const match = timeZoneName.match(/^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/)
  if (!match?.[1]) return 0
  const hours = Number.parseInt(match[2] || "0", 10)
  const minutes = Number.parseInt(match[3] || "0", 10)
  const sign = match[1] === "+" ? 1 : -1
  return sign * (hours * 60 + minutes)
}

const localDateTimeToUtc = (dateKey: string, hour: number, minute: number, timeZone = STAFF_TIME_ZONE) => {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10))
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute))
  return new Date(utcGuess.getTime() - getTimeZoneOffsetMinutes(utcGuess, timeZone) * 60_000)
}

export const isValidSessionDateKey = (dateKey: string) => {
  if (!DATE_KEY_PATTERN.test(dateKey)) return false
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10))
  const value = new Date(Date.UTC(year, month - 1, day))
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day
}

export const getTodaySessionDateKey = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STAFF_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const year = parts.find((part) => part.type === "year")?.value ?? ""
  const month = parts.find((part) => part.type === "month")?.value ?? ""
  const day = parts.find((part) => part.type === "day")?.value ?? ""
  return year && month && day ? `${year}-${month}-${day}` : now.toISOString().slice(0, 10)
}

export const getEarliestSelectableSessionDateKey = (now: Date) =>
  addDaysToDateKey(getTodaySessionDateKey(now), -STAFF_ATTENDANCE_BACKFILL_DAYS)

export const isSelectableSessionDateKey = (dateKey: string, now: Date) => {
  if (!isValidSessionDateKey(dateKey)) return false
  return dateKey >= getEarliestSelectableSessionDateKey(now) && dateKey <= getTodaySessionDateKey(now)
}

export const getSessionDateWindow = (dateKey: string) => ({
  startsAt: {
    gte: localDateTimeToUtc(dateKey, 0, 0),
    lt: localDateTimeToUtc(addDaysToDateKey(dateKey, 1), 0, 0),
  },
})

const getJsWeekdayForDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10))
  const value = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: STAFF_TIME_ZONE, weekday: "short" }).format(value)
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
  const index = labels.findIndex((label) => label === weekday)
  return index >= 0 ? index : value.getUTCDay()
}

const encodeScheduledSessionId = (courseSlug: string, dateKey: string, time: string) =>
  `${SCHEDULED_SESSION_PREFIX}:${courseSlug}:${dateKey}:${time}`

const decodeScheduledSessionId = (value: string) => {
  const [prefix, courseSlug, dateKey, ...timeParts] = value.split(":")
  const time = timeParts.join(":")
  if (prefix !== SCHEDULED_SESSION_PREFIX || !courseSlug || !dateKey || !/^\d{2}:\d{2}$/.test(time)) return null
  return { courseSlug, dateKey, time }
}

const getCourseTimesForDate = (course: {
  availableWeekdays: number[]
  availableTimes: string[]
  scheduleRules: unknown
}, dateKey: string) => {
  const jsWeekday = getJsWeekdayForDateKey(dateKey)
  const ruleTimes = getTimesForWeekday(course.scheduleRules, jsWeekday)
  const hasRules = Array.isArray(ruleTimes)
  if (!hasRules && Array.isArray(course.availableWeekdays) && course.availableWeekdays.length > 0 && !course.availableWeekdays.includes(jsWeekday)) {
    return [] as string[]
  }
  return (hasRules ? ruleTimes : course.availableTimes || [])
    .filter((time) => /^\d{2}:\d{2}$/.test(time))
    .sort()
}

export const getSelectableSessionWindow = (now: Date) => ({
  startsAt: {
    gte: localDateTimeToUtc(getEarliestSelectableSessionDateKey(now), 0, 0),
    lt: localDateTimeToUtc(addDaysToDateKey(getTodaySessionDateKey(now), 1), 0, 0),
  },
})

export const findSelectableClassSessions = (
  client: Pick<Prisma.TransactionClient, "classSession" | "courseCatalog">,
  now: Date,
  dateKey?: string
) => {
  const targetDateKey = dateKey || getTodaySessionDateKey(now)
  const classSessionWindow = dateKey ? getSessionDateWindow(dateKey) : getSelectableSessionWindow(now)
  return Promise.all([
    client.classSession.findMany({
      where: classSessionWindow,
      select: {
        id: true,
        courseSlug: true,
        title: true,
        startsAt: true,
        durationMinutes: true,
      },
      orderBy: { startsAt: "desc" },
      take: 50,
    }),
    client.courseCatalog.findMany({
      where: { active: true },
      select: {
        slug: true,
        title: true,
        durationMinutes: true,
        availableWeekdays: true,
        availableTimes: true,
        scheduleRules: true,
      },
      orderBy: [{ createdAt: "asc" }],
      take: 100,
    }),
  ]).then(([existingSessions, courses]) => {
    const existingBySlot = new Map(existingSessions.map((session) => [`${session.courseSlug}:${session.startsAt.toISOString()}`, session]))
    const scheduledSessions = courses.flatMap((course) =>
      getCourseTimesForDate(course, targetDateKey).flatMap((time) => {
        const context = parseQrCheckInContext({
          courseSlug: course.slug,
          date: targetDateKey,
          time,
          durationMinutes: course.durationMinutes ?? 60,
        })
        if ("status" in context) return []
        const key = `${course.slug}:${context.startsAt.toISOString()}`
        const existing = existingBySlot.get(key)
        const syntheticId = encodeScheduledSessionId(course.slug, targetDateKey, time)
        return [{
          id: existing?.id || syntheticId,
          syntheticId,
          courseSlug: course.slug,
          title: existing?.title || course.title,
          startsAt: existing?.startsAt || context.startsAt,
          durationMinutes: existing?.durationMinutes ?? course.durationMinutes ?? context.durationMinutes,
        }]
      })
    )
    const seen = new Set<string>()
    return [...scheduledSessions, ...existingSessions]
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .filter((session) => {
        const key = `${session.courseSlug}:${session.startsAt.toISOString()}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 50)
  })
}

export const materializeSelectableClassSession = async (
  client: Pick<Prisma.TransactionClient, "classSession" | "courseCatalog">,
  now: Date,
  sessionId: string,
  dateKey?: string
) => {
  const selectableSessions = await findSelectableClassSessions(client, now, dateKey)
  const selected = selectableSessions.find((candidate) => (
    candidate.id === sessionId || ("syntheticId" in candidate && candidate.syntheticId === sessionId)
  )) || null
  if (!selected) return null
  const decoded = decodeScheduledSessionId(sessionId)
  if (!decoded) return selected
  return client.classSession.upsert({
    where: {
      courseSlug_startsAt: {
        courseSlug: selected.courseSlug,
        startsAt: selected.startsAt,
      },
    },
    update: {
      title: selected.title,
      durationMinutes: selected.durationMinutes,
    },
    create: {
      courseSlug: selected.courseSlug,
      title: selected.title,
      startsAt: selected.startsAt,
      durationMinutes: selected.durationMinutes,
    },
    select: {
      id: true,
      courseSlug: true,
      title: true,
      startsAt: true,
      durationMinutes: true,
    },
  })
}

export type SelectableClassSession = Awaited<ReturnType<typeof findSelectableClassSessions>>[number]
