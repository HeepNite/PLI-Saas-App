import type { Prisma } from "@prisma/client"

const STAFF_TIME_ZONE = "America/New_York"
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
export const STAFF_ATTENDANCE_BACKFILL_DAYS = 14

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

export const getSelectableSessionWindow = (now: Date) => ({
  startsAt: {
    gte: localDateTimeToUtc(getEarliestSelectableSessionDateKey(now), 0, 0),
    lt: localDateTimeToUtc(addDaysToDateKey(getTodaySessionDateKey(now), 1), 0, 0),
  },
})

export const findSelectableClassSessions = (
  client: Pick<Prisma.TransactionClient, "classSession">,
  now: Date,
  dateKey?: string
) => client.classSession.findMany({
  where: dateKey ? getSessionDateWindow(dateKey) : getSelectableSessionWindow(now),
  select: {
    id: true,
    courseSlug: true,
    title: true,
    startsAt: true,
    durationMinutes: true,
  },
  orderBy: { startsAt: "desc" },
  take: 50,
})

export type SelectableClassSession = Awaited<ReturnType<typeof findSelectableClassSessions>>[number]
