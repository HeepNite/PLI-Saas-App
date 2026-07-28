/**
 * Formats a date (YYYY-MM-DD) + 24h time (HH:MM) into a friendly English
 * long-form string, e.g. "Friday, July 24 · 8:10 PM".
 *
 * @param date ISO date string, e.g. "2026-07-24"
 * @param time 24h time string, e.g. "20:10"
 * @param to12h Converts a 24h time string ("20:10") to a 12h label ("8:10 PM")
 */
export function formatFriendlyDateTime(
  date: string,
  time: string,
  to12h: (value: string) => string,
): string {
  if (!date) return ""

  const [year, month, day] = date.split("-").map(Number)
  if (!year || !month || !day) return ""

  const parsed = new Date(year, month - 1, day)
  if (Number.isNaN(parsed.getTime())) return ""

  const weekdayMonthDay = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(parsed)

  const timeLabel = time ? to12h(time) : ""

  return timeLabel ? `${weekdayMonthDay} · ${timeLabel}` : weekdayMonthDay
}
