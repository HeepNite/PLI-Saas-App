import type { Prisma } from "@prisma/client"
import { parseQrCheckInContext } from "@/lib/checkin/qr"
import { getTimesForWeekday } from "@/lib/schedule-rules"

const TIME_ZONE = "America/New_York"
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const SCHEDULED_SESSION_PREFIX = "scheduled"

export const getNewYorkDateKey = (value: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

export const addDays = (value: string, days: number) => {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export const startOfNewYorkDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day))
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "shortOffset" }).formatToParts(guess).find((part) => part.type === "timeZoneName")?.value || "GMT"
  const match = zone.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/)
  const offset = match ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] || 0)) : 0
  return new Date(guess.getTime() - offset * 60_000)
}

export const isValidStudentSessionDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export const isSelectableStudentSessionDate = (value: string, now = new Date()) => {
  const today = getNewYorkDateKey(now)
  return isValidStudentSessionDate(value) && value >= addDays(today, -14) && value <= today
}

type PersistedSession = {
  id: string
  courseSlug: string
  title: string | null
  startsAt: Date
  durationMinutes: number | null
}

export type SelectableStudentSession = PersistedSession & { syntheticId?: string }

const scheduledSessionId = (courseSlug: string, date: string, time: string) =>
  `${SCHEDULED_SESSION_PREFIX}:${courseSlug}:${date}:${time}`

const isSyntheticScheduledSessionId = (value: string) =>
  /^scheduled:[a-z0-9-]+:\d{4}-\d{2}-\d{2}:\d{2}:\d{2}$/.test(value)

const courseTimesForDate = (course: {
  availableWeekdays: number[]
  availableTimes: string[]
  scheduleRules: unknown
}, date: string) => {
  const [year, month, day] = date.split("-").map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()
  const ruleTimes = getTimesForWeekday(course.scheduleRules, weekday)
  if (!ruleTimes && course.availableWeekdays.length > 0 && !course.availableWeekdays.includes(weekday)) return []
  return (ruleTimes || course.availableTimes).filter((time) => /^\d{2}:\d{2}$/.test(time)).sort()
}

const sessionWindow = (date: string) => ({
  startsAt: { gte: startOfNewYorkDate(date), lt: startOfNewYorkDate(addDays(date, 1)) },
})

export const findSelectableStudentSessions = async (
  client: Pick<Prisma.TransactionClient, "classSession" | "courseCatalog">,
  date: string,
): Promise<SelectableStudentSession[]> => {
  const [persisted, courses] = await Promise.all([
    client.classSession.findMany({
      where: sessionWindow(date),
      select: { id: true, courseSlug: true, title: true, startsAt: true, durationMinutes: true },
      orderBy: { startsAt: "asc" },
    }),
    client.courseCatalog.findMany({
      where: { active: true },
      select: { slug: true, title: true, durationMinutes: true, availableWeekdays: true, availableTimes: true, scheduleRules: true },
    }),
  ])
  const persistedBySlot = new Map(persisted.map((session) => [`${session.courseSlug}:${session.startsAt.toISOString()}`, session]))
  const scheduled = courses.flatMap((course) => courseTimesForDate(course, date).flatMap((time) => {
    const context = parseQrCheckInContext({ courseSlug: course.slug, date, time, durationMinutes: course.durationMinutes ?? undefined })
    if ("status" in context) return []
    const existing = persistedBySlot.get(`${course.slug}:${context.startsAt.toISOString()}`)
    if (existing) return [existing]
    return [{
      id: scheduledSessionId(course.slug, date, time),
      syntheticId: scheduledSessionId(course.slug, date, time),
      courseSlug: course.slug,
      title: course.title,
      startsAt: context.startsAt,
      durationMinutes: course.durationMinutes ?? context.durationMinutes,
    }]
  }))
  const scheduledSlots = new Set(scheduled.map((session) => `${session.courseSlug}:${session.startsAt.toISOString()}`))
  return [...scheduled, ...persisted.filter((session) => !scheduledSlots.has(`${session.courseSlug}:${session.startsAt.toISOString()}`))]
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
}

export const materializeSelectableStudentSession = async (
  client: Pick<Prisma.TransactionClient, "classSession" | "courseCatalog">,
  sessionId: string,
  date: string,
) => {
  const selected = (await findSelectableStudentSessions(client, date)).find((session) => session.id === sessionId)
  if (!selected) return null
  if (!isSyntheticScheduledSessionId(sessionId)) return selected
  return client.classSession.upsert({
    where: { courseSlug_startsAt: { courseSlug: selected.courseSlug, startsAt: selected.startsAt } },
    update: {},
    create: {
      courseSlug: selected.courseSlug,
      title: selected.title,
      startsAt: selected.startsAt,
      durationMinutes: selected.durationMinutes,
    },
    select: { id: true, courseSlug: true, title: true, startsAt: true, durationMinutes: true },
  })
}
