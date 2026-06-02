import { ISO_DATE_REGEX } from "./staffAdminConstants"

export const normalizeClockTime = (value: string) => {
  const [hours, minutes] = value.split(":")
  const h = Number(hours)
  const m = Number(minutes)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return ""
  if (h < 0 || h > 23 || m < 0 || m > 59) return ""
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export const formatClockLabel = (value: string) => {
  const normalized = normalizeClockTime(value)
  if (!normalized) return value
  const [hours, minutes] = normalized.split(":").map(Number)
  const suffix = hours >= 12 ? "PM" : "AM"
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`
}

export const formatReservationDateLabel = (isoDate: string) => {
  if (!ISO_DATE_REGEX.test(isoDate)) return ""
  const parsed = new Date(`${isoDate}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return ""
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed)
}

export const formatMoney = (amount: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format((amount || 0) / 100)

export const centsToUsdInput = (cents: number | null | undefined) => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return ""
  const value = (cents / 100).toFixed(2)
  return value.endsWith(".00") ? value.slice(0, -3) : value
}

export const formatUsdInputLabel = (value: string) => {
  const parsed = Number(value.trim().replace(",", "."))
  if (!Number.isFinite(parsed) || parsed < 0) return "—"
  return `$${parsed.toFixed(2)}`
}

export const formatMinutesLabel = (minutes: number) => {
  if (minutes <= 0) return "On time"
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (hours <= 0) return `${restMinutes}m`
  if (restMinutes <= 0) return `${hours}h`
  return `${hours}h ${restMinutes}m`
}

// Intentionally separate from formatMinutesLabel: live/work durations should show
// a concrete zero duration, while punctuality/delay labels use "On time".
export const formatDurationLabel = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m"
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  if (hours <= 0) return `${restMinutes}m`
  if (restMinutes <= 0) return `${hours}h`
  return `${hours}h ${restMinutes}m`
}

export const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

export const resolveHistoryDateIso = (referenceDate = new Date(), timeZone = "America/New_York") => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(referenceDate)
  } catch {
    return toLocalIsoDate(referenceDate)
  }
}

export const resolveHistoryRangeState = (start: string, end?: string | null) => ({
  historyFrom: start,
  historyTo: end ?? "",
})

export const formatIsoDate = (value: string | null) => {
  if (!value) return "—"
  const time = Date.parse(value)
  if (Number.isNaN(time)) return "—"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(time))
}

export const formatDateTime = (value: string | number | null | undefined) => {
  if (value == null || value === "") return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed)
  } catch {
    return "—"
  }
}
