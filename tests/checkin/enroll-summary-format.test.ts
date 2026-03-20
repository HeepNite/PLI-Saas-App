import { describe, expect, it } from "vitest"
import { formatCheckInSummaryDateTime } from "@/components/front/courses/EnrollModal"

describe("enroll summary date formatting", () => {
  it("formats terminal date and time in human-readable english", () => {
    expect(formatCheckInSummaryDateTime("2026-03-20", "20:10")).toBe("Friday, March 20 · 8:10 PM")
  })
})
