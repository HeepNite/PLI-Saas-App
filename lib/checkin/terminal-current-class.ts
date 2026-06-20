import { parseQrCheckInContext } from "@/lib/checkin/qr"
import { getTimesForWeekday, parseScheduleRules } from "@/lib/schedule-rules"

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
  slug: string
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
}

export type ResolvedTerminalClass = TerminalClassItem & {
  time: string
  startsAt: Date
}

export const getDateKeyForTerminal = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TERMINAL_TIME_ZONE }).format(date)

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
  now = new Date()
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

  return classes
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
