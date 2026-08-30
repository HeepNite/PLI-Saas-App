import { getDateKeyForTerminal, TERMINAL_TIME_ZONE, type TerminalClassItem } from "@/lib/checkin/terminal-current-class"

const WEEKDAY_LABELS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

export const CHECKIN_TODAY_CLASSES_ERROR_MESSAGE = "Unable to fetch today's classes"
export const CHECKIN_TODAY_CLASSES_ERROR_STATUS = 500

export type CheckinTodayClassesClassDto = {
  kind?: "special"
  slug: string
  specialClassSlug?: string
  title: string
  category: string | null
  level: string | null
  durationMinutes: number | null
  availableTimes: string[]
  dayLabel: string
  dropInPriceCents: number | null
  firstClassPriceCents: number | null
  coverImageUrl: string | null
  currency?: string
}

export type CheckinTodayClassesResponse = {
  date: string
  weekday: number
  dayLabel: string
  classes: CheckinTodayClassesClassDto[]
}

export type CheckinTodayClassesErrorResponse = {
  error: typeof CHECKIN_TODAY_CLASSES_ERROR_MESSAGE
}

const getMonBasedWeekdayInTerminalZone = (date: Date) => {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TERMINAL_TIME_ZONE, weekday: "short" }).format(date)
  const jsLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
  const jsWeekday = jsLabels.findIndex((label) => label === weekday)
  return jsWeekday >= 0 ? (jsWeekday + 6) % 7 : (date.getDay() + 6) % 7
}

export const mapTerminalClassItemToTodayClassesDto = (
  item: Pick<
    TerminalClassItem,
    | "kind"
    | "slug"
    | "specialClassSlug"
    | "title"
    | "category"
    | "level"
    | "durationMinutes"
    | "availableTimes"
    | "dayLabel"
    | "dropInPriceCents"
    | "firstClassPriceCents"
    | "coverImageUrl"
    | "currency"
  >
): CheckinTodayClassesClassDto => ({
  slug: item.slug,
  title: item.title,
  category: item.category,
  level: item.level,
  durationMinutes: item.durationMinutes,
  availableTimes: [...item.availableTimes],
  dayLabel: item.dayLabel,
  dropInPriceCents: item.dropInPriceCents,
  firstClassPriceCents: item.firstClassPriceCents,
  coverImageUrl: item.coverImageUrl,
  ...(item.kind === "special" && item.specialClassSlug && item.currency
    ? { kind: "special" as const, specialClassSlug: item.specialClassSlug, currency: item.currency }
    : {}),
})

export const createCheckinTodayClassesResponse = ({
  classes,
  now = new Date(),
}: {
  classes: readonly TerminalClassItem[]
  now?: Date
}): CheckinTodayClassesResponse => {
  const weekday = getMonBasedWeekdayInTerminalZone(now)

  return {
    date: getDateKeyForTerminal(now),
    weekday,
    dayLabel: WEEKDAY_LABELS_MON[weekday] || "Today",
    classes: classes.map(mapTerminalClassItemToTodayClassesDto),
  }
}

export const createCheckinTodayClassesErrorResponse = (): CheckinTodayClassesErrorResponse => ({
  error: CHECKIN_TODAY_CLASSES_ERROR_MESSAGE,
})

export const createCheckinTodayClassesClassDto = (value: CheckinTodayClassesClassDto): CheckinTodayClassesClassDto => ({
  slug: value.slug,
  title: value.title,
  category: value.category,
  level: value.level,
  durationMinutes: value.durationMinutes,
  availableTimes: [...value.availableTimes],
  dayLabel: value.dayLabel,
  dropInPriceCents: value.dropInPriceCents,
  firstClassPriceCents: value.firstClassPriceCents,
  coverImageUrl: value.coverImageUrl,
  ...(value.kind === "special" && value.specialClassSlug && value.currency
    ? { kind: "special" as const, specialClassSlug: value.specialClassSlug, currency: value.currency }
    : {}),
})

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const isNullableString = (value: unknown): value is string | null => typeof value === "string" || value === null

const isNullableNumber = (value: unknown): value is number | null => typeof value === "number" || value === null

const isCheckinTodayClassesClassDto = (value: unknown): value is CheckinTodayClassesClassDto => {
  if (!isRecord(value)) return false

  return (
    (value.kind === undefined || value.kind === "special") &&
    typeof value.slug === "string" &&
    (value.specialClassSlug === undefined || typeof value.specialClassSlug === "string") &&
    typeof value.title === "string" &&
    isNullableString(value.category) &&
    isNullableString(value.level) &&
    isNullableNumber(value.durationMinutes) &&
    Array.isArray(value.availableTimes) &&
    value.availableTimes.every((time) => typeof time === "string") &&
    typeof value.dayLabel === "string" &&
    isNullableNumber(value.dropInPriceCents) &&
    isNullableNumber(value.firstClassPriceCents) &&
    isNullableString(value.coverImageUrl) &&
    (value.currency === undefined || typeof value.currency === "string") &&
    (value.kind !== "special" || (typeof value.specialClassSlug === "string" && typeof value.currency === "string"))
  )
}

export const isCheckinTodayClassesResponse = (value: unknown): value is CheckinTodayClassesResponse => {
  if (!isRecord(value)) return false

  return (
    typeof value.date === "string" &&
    typeof value.weekday === "number" &&
    Number.isInteger(value.weekday) &&
    value.weekday >= 0 &&
    value.weekday <= 6 &&
    typeof value.dayLabel === "string" &&
    Array.isArray(value.classes) &&
    value.classes.every(isCheckinTodayClassesClassDto)
  )
}

export const parseCheckinTodayClassesResponse = (value: unknown): CheckinTodayClassesResponse | null => {
  if (!isCheckinTodayClassesResponse(value)) return null

  return {
    date: value.date,
    weekday: value.weekday,
    dayLabel: value.dayLabel,
    classes: value.classes.map(createCheckinTodayClassesClassDto),
  }
}
