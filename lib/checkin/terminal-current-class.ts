import { parseQrCheckInContext } from "@/lib/checkin/qr"
import { getTimesForWeekday, parseScheduleRules } from "@/lib/schedule-rules"
import { SPECIAL_SALSA_CLASS, resolveSpecialClassPricing } from "@/lib/special-salsa-class/config"

export const TERMINAL_TIME_ZONE = "America/New_York"

const WEEKDAY_LABELS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const WEEKDAY_LABELS_JS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

export type TerminalCourseCatalogLike = {
  slug: string
  title: string
  category: string | null
  level: string | null
  durationMinutes: number | null
  availableWeekdays: number[]
  availableTimes: string[]
  scheduleRules: unknown
  dropInPriceCents: number | null
  firstClassPriceCents: number | null
  coverImageUrl: string | null
}

export type TerminalClassItem = {
  kind?: "special"
  slug: string
  specialClassSlug?: string
  title: string
  category: string | null
  level: string | null
  durationMinutes: number | null
  availableTimes: string[]
  dayLabel: string
  date: string
  dropInPriceCents: number | null
  firstClassPriceCents: number | null
  coverImageUrl: string | null
  currency?: string
}

export type TerminalSpecialClassLike = {
  slug: string
  status: string
  cancelledAt: Date | null
  title: string
  coverImageUrl: string | null
  priceCents: number
  currency: string
  classSession: {
    courseSlug: string
    startsAt: Date
    durationMinutes: number | null
  }
}

export type ResolvedTerminalClass = TerminalClassItem & {
  time: string
  startsAt: Date
}

export const getDateKeyForTerminal = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TERMINAL_TIME_ZONE }).format(date)

const addDays = (dateKey: string, days: number) => {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

const startOfTerminalDate = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day))
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: TERMINAL_TIME_ZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(guess).find((part) => part.type === "timeZoneName")?.value ?? "GMT"
  const match = zone.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/)
  const offset = match ? (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) : 0
  return new Date(guess.getTime() - offset * 60_000)
}

export const getTerminalDayRange = (now = new Date()) => {
  const dateKey = getDateKeyForTerminal(now)
  return { gte: startOfTerminalDate(dateKey), lt: startOfTerminalDate(addDays(dateKey, 1)) }
}

const getTimeKeyForTerminal = (date: Date) => new Intl.DateTimeFormat("en-GB", {
  timeZone: TERMINAL_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
}).format(date)

const getJsWeekdayInTimeZone = (date: Date) => {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TERMINAL_TIME_ZONE, weekday: "short" }).format(date)
  return WEEKDAY_LABELS_JS.findIndex((label) => label === weekday)
}

const getTerminalTimeMinutes = (date: Date) => {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TERMINAL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
  const [hour, minute] = time.split(":").map(Number)
  return (hour * 60) + minute
}

const parseTimeMinutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number)
  return (hour * 60) + minute
}

export const buildTodayTerminalClasses = (
  courses: TerminalCourseCatalogLike[],
  now = new Date(),
  specialClasses: TerminalSpecialClassLike[] = [],
): TerminalClassItem[] => {
  const todayKey = getDateKeyForTerminal(now)
  const todayJsWeekday = getJsWeekdayInTimeZone(now)
  const todayWeekdayMon = todayJsWeekday >= 0 ? (todayJsWeekday + 6) % 7 : (now.getDay() + 6) % 7
  const dayLabel = WEEKDAY_LABELS_MON[todayWeekdayMon] || "Today"
  const classes: TerminalClassItem[] = []

  for (const course of courses) {
    const parsedRules = parseScheduleRules(course.scheduleRules)
    const hasDaySpecificRules = Boolean(parsedRules?.rules?.length)
    if (!hasDaySpecificRules && !(course.availableWeekdays || []).includes(todayJsWeekday)) continue

    const ruleTimes = getTimesForWeekday(course.scheduleRules, todayJsWeekday)
    const times = (hasDaySpecificRules ? (ruleTimes ?? []) : (course.availableTimes ?? []))
      .filter((time) => /^\d{2}:\d{2}$/.test(time))
      .sort()
    if (times.length === 0) continue

    classes.push({
      slug: course.slug,
      title: course.title,
      category: course.category,
      level: course.level,
      durationMinutes: course.durationMinutes,
      availableTimes: times,
      dayLabel,
      date: todayKey,
      dropInPriceCents: course.dropInPriceCents,
      firstClassPriceCents: course.firstClassPriceCents,
      coverImageUrl: course.coverImageUrl,
    })
  }

  const specials = specialClasses
    .filter((item) => item.status === "published" && item.cancelledAt === null)
    .filter((item) => getDateKeyForTerminal(item.classSession.startsAt) === todayKey)
    .map<TerminalClassItem>((item) => ({
      kind: "special",
      slug: item.classSession.courseSlug,
      specialClassSlug: item.slug,
      title: item.title,
      category: "Special class",
      level: null,
      durationMinutes: item.classSession.durationMinutes,
      availableTimes: [getTimeKeyForTerminal(item.classSession.startsAt)],
      dayLabel,
      date: todayKey,
      dropInPriceCents: item.slug === SPECIAL_SALSA_CLASS.key
        ? resolveSpecialClassPricing(now).amountCents
        : item.priceCents,
      firstClassPriceCents: null,
      coverImageUrl: item.coverImageUrl,
      currency: item.currency,
    }))

  if (specials.length === 0) return classes
  const specialSlots = new Set(specials.map((item) => `${item.slug}:${item.availableTimes[0]}`))
  const regularWithoutSpecialSlots = classes.flatMap((item) => {
    const availableTimes = item.availableTimes.filter((time) => !specialSlots.has(`${item.slug}:${time}`))
    return availableTimes.length > 0 ? [{ ...item, availableTimes }] : []
  })
  return [...regularWithoutSpecialSlots, ...specials]
}

export const resolveCurrentTerminalClass = (
  classes: TerminalClassItem[],
  now = new Date()
): ResolvedTerminalClass | null => {
  const slots = classes
    .flatMap((item) => item.availableTimes.map((time) => ({ item, time })))
    .sort((a, b) => a.time.localeCompare(b.time))
  if (slots.length === 0) return null

  const nowMinutes = getTerminalTimeMinutes(now)
  const selected = slots.find(({ item, time }) => {
    const startMinutes = parseTimeMinutes(time)
    const duration = item.durationMinutes ?? 55
    return nowMinutes < startMinutes + duration - 15
  }) || slots[slots.length - 1]

  const context = parseQrCheckInContext({
    courseSlug: selected.item.slug,
    date: selected.item.date,
    time: selected.time,
    durationMinutes: selected.item.durationMinutes ?? 60,
  })
  if ("status" in context) return null

  return { ...selected.item, time: selected.time, startsAt: context.startsAt }
}
