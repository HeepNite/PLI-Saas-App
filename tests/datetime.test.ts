import { describe, it, expect } from "vitest"
import { formatFriendlyDateTime } from "@/components/front/courses/utils/datetime"

const to12h = (time24: string) => {
  const [h, m] = time24.split(":").map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time24
  const ampm = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`
}

describe("formatFriendlyDateTime", () => {
  it("formats a standard date and time", () => {
    expect(formatFriendlyDateTime("2026-07-24", "20:10", to12h)).toBe("Friday, July 24 · 8:10 PM")
  })

  it("returns an empty string when date is missing", () => {
    expect(formatFriendlyDateTime("", "20:10", to12h)).toBe("")
  })

  it("formats a second date/time to catch weekday/month drift", () => {
    expect(formatFriendlyDateTime("2026-01-05", "09:05", to12h)).toBe("Monday, January 5 · 9:05 AM")
  })

  it("omits the time separator when time is empty", () => {
    expect(formatFriendlyDateTime("2026-07-24", "", to12h)).toBe("Friday, July 24")
  })
})
