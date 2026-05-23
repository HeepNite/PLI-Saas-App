const normalizeClockTime = (value: string) => {
  const [hours, minutes] = value.split(":")
  const h = Number(hours)
  const m = Number(minutes)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return ""
  if (h < 0 || h > 23 || m < 0 || m > 59) return ""
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

const formatClockLabel = (value: string) => {
  const normalized = normalizeClockTime(value)
  if (!normalized) return value
  const [hours, minutes] = normalized.split(":").map(Number)
  const suffix = hours >= 12 ? "PM" : "AM"
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`
}

export const formatIsoDateLong = (value: string | null) => {
  if (!value) return "—"
  const time = Date.parse(value)
  if (Number.isNaN(time)) return "—"

  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(new Date(time))

  const weekday = parts.find((part) => part.type === "weekday")?.value
  const day = parts.find((part) => part.type === "day")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const year = parts.find((part) => part.type === "year")?.value

  if (!weekday || !day || !month || !year) return "—"
  return `${weekday}, ${day} ${month} ${year}`
}

export const formatStudentPaymentCardSlotLabel = (classDate: string | null, classTime: string | null) => {
  if (!classDate) return "No class slot"
  const dateLabel = formatIsoDateLong(`${classDate}T12:00:00`)
  if (!classTime) return dateLabel
  return `${dateLabel} · ${formatClockLabel(classTime)}`
}

export const formatStudentPaymentCardDateTimeLabel = (value: string | null) => {
  if (!value) return "—"
  const time = Date.parse(value)
  if (Number.isNaN(time)) return "—"
  const date = new Date(time)
  const dateLabel = formatIsoDateLong(date.toISOString())
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date)
  return `${dateLabel} · ${timeLabel}`
}
