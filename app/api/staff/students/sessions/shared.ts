const TIME_ZONE = "America/New_York"
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

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
