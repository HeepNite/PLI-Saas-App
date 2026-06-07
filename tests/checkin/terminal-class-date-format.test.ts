import { describe, expect, it } from "vitest"
import { formatTerminalClassDateTime } from "@/lib/checkin/class-date-format"

describe("terminal class date formatting", () => {
  it("formats a valid class date and time as a friendly terminal label", () => {
    expect(formatTerminalClassDateTime("2026-04-30", "21:10")).toBe(
      "Thursday, April 30, 2026 at 9:10 PM"
    )
  })

  it("does not normalize impossible dates into a different calendar day", () => {
    expect(formatTerminalClassDateTime("2026-04-40", "21:10")).toBe("2026-04-40 21:10")
  })
})
