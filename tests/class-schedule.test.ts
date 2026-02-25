import { describe, expect, it } from "vitest"
import { isSlotInPastForTimeZone } from "@/lib/class-schedule"

describe("class schedule time-zone helpers", () => {
  it("marks slots as past in New York time", () => {
    const reference = new Date("2026-02-18T22:05:00.000Z") // 5:05 PM in New York (EST)
    expect(isSlotInPastForTimeZone("2026-02-18", "11:00", "America/New_York", reference)).toBe(true)
    expect(isSlotInPastForTimeZone("2026-02-18", "17:05", "America/New_York", reference)).toBe(true)
  })

  it("keeps future slots available in New York time", () => {
    const reference = new Date("2026-02-18T22:05:00.000Z")
    expect(isSlotInPastForTimeZone("2026-02-18", "17:10", "America/New_York", reference)).toBe(false)
    expect(isSlotInPastForTimeZone("2026-02-19", "10:00", "America/New_York", reference)).toBe(false)
  })

  it("returns false for invalid slot input", () => {
    const reference = new Date("2026-02-18T22:05:00.000Z")
    expect(isSlotInPastForTimeZone("bad-date", "11:00", "America/New_York", reference)).toBe(false)
    expect(isSlotInPastForTimeZone("2026-02-18", "99:00", "America/New_York", reference)).toBe(false)
  })
})
