/**
 * Shared schedule-rules parsing and day-specific time resolution.
 *
 * scheduleRules.rules[].weekday uses JS getDay() convention:
 * 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
 *
 * This matches the convention used by CourseCatalog.availableWeekdays in the DB.
 */

export type ScheduleRuleEntry = { weekday: number; times: string[] }

export type CourseScheduleRules = {
  mode?: string
  rules: ScheduleRuleEntry[]
  publication?: unknown
  specialEvents?: unknown[]
  recurrenceMode?: string
  repeatAllMonth?: boolean
  specialDiscount?: unknown
  recurrenceEndsAt?: string | null
  weeklyDaysTarget?: number
}

/**
 * Safely parse scheduleRules from unknown JSON value.
 */
export function parseScheduleRules(value: unknown): CourseScheduleRules | null {
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  if (!Array.isArray(obj.rules)) return null
  return obj as unknown as CourseScheduleRules
}

/**
 * Get the specific times for a given weekday from scheduleRules.
 * Returns null if no rules exist or no entry for that weekday — caller should fall back to availableTimes.
 *
 * @param scheduleRules - the raw JSON from CourseCatalog.scheduleRules
 * @param weekday - JS getDay() weekday (0=Sun, 1=Mon, ... 6=Sat)
 */
export function getTimesForWeekday(
  scheduleRules: unknown,
  weekday: number
): string[] | null {
  const parsed = parseScheduleRules(scheduleRules)
  if (!parsed?.rules?.length) return null
  const entry = parsed.rules.find((r) => r.weekday === weekday)
  if (!entry?.times?.length) return null
  return entry.times
}
