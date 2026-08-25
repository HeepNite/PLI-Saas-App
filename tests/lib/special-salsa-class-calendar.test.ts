import { describe, expect, it } from "vitest"
import { createSpecialSalsaCalendarFile } from "@/lib/special-salsa-class/calendar"

describe("special salsa class calendar file", () => {
  it("creates an interoperable New York iCalendar event for Salsa de Cali", () => {
    const calendar = createSpecialSalsaCalendarFile()

    for (const line of [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PLI//Special Salsa Class//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VTIMEZONE",
      "TZID:America/New_York",
      "BEGIN:VEVENT",
      "SUMMARY:Salsa de Cali",
      "DTSTART;TZID=America/New_York:20260830T160000",
      "DTEND;TZID=America/New_York:20260830T170000",
      "LOCATION:54 Coles St\\, Jersey City",
      "END:VEVENT",
      "END:VCALENDAR",
    ]) expect(calendar).toContain(line)
    expect(calendar).toMatch(/\r\n$/)
  })
})
