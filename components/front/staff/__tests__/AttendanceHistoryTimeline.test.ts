import { describe, expect, it } from "vitest"
import { formatDate, formatTime } from "@/components/front/staff/AttendanceHistoryTimeline"

describe("formatDate", () => {
  it("formats a date in short month format", () => {
    const date = new Date("2026-04-20T19:00:00")
    const result = formatDate(date)
    expect(result).toContain("Apr")
    expect(result).toContain("20")
    expect(result).toContain("2026")
  })

  it("does not include time in the output", () => {
    const date = new Date("2026-04-20T14:00:00")
    const result = formatDate(date)
    expect(result).not.toMatch(/\d{1,2}:\d{2}/)
  })

  it("returns the em-dash fallback for an Invalid Date without throwing", () => {
    const invalid = new Date("not-a-date")
    expect(() => formatDate(invalid)).not.toThrow()
    expect(formatDate(invalid)).toBe("—")
  })
})

describe("formatTime", () => {
  it("formats 24h time to 12h format with AM", () => {
    expect(formatTime("10:30")).toBe("10:30 AM")
  })

  it("formats 24h time to 12h format with PM", () => {
    expect(formatTime("19:00")).toBe("7:00 PM")
  })

  it("formats noon correctly", () => {
    expect(formatTime("12:00")).toBe("12:00 PM")
  })

  it("formats midnight correctly", () => {
    expect(formatTime("00:00")).toBe("12:00 AM")
  })

  it("formats early morning times", () => {
    expect(formatTime("07:00")).toBe("7:00 AM")
  })

  it("includes minutes in output", () => {
    expect(formatTime("14:30")).toContain("30")
  })
})
