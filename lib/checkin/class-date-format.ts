const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_24_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

const parseIsoDateParts = (dateIso: string) => {
  const match = ISO_DATE_REGEX.exec(dateIso.trim())
  if (!match) return null

  const year = Number.parseInt(match[1]!, 10)
  const month = Number.parseInt(match[2]!, 10)
  const day = Number.parseInt(match[3]!, 10)
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { date, year, month, day }
}

const formatTime = (time24: string) => {
  const match = TIME_24_REGEX.exec(time24.trim())
  if (!match) return null

  const hour24 = Number.parseInt(match[1]!, 10)
  const minute = Number.parseInt(match[2]!, 10)
  const hour12 = hour24 % 12 || 12
  const suffix = hour24 >= 12 ? "PM" : "AM"

  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`
}

export const formatTerminalClassDateTime = (dateIso: string, time24: string, timeZone = "America/New_York") => {
  const parsedDate = parseIsoDateParts(dateIso)
  const timeLabel = formatTime(time24)

  if (!parsedDate || !timeLabel) {
    const fallback = [dateIso, time24].filter(Boolean).join(" ").trim()
    return fallback || "Class time to be confirmed"
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate.date)

  return `${dateLabel} at ${timeLabel}`
}
