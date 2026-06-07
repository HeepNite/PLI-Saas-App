import { describe, expect, it } from "vitest"

import { resolveCalendarRangeSelection } from "@/components/front/ui/calendarPickerRange"

describe("calendarPickerRange selection flow", () => {
  it("starts with open range and only closes on second click", () => {
    const firstClick = resolveCalendarRangeSelection(undefined, undefined, "2026-05-09")
    expect(firstClick).toEqual({ rangeStart: "2026-05-09", rangeEnd: undefined })

    const secondClick = resolveCalendarRangeSelection(firstClick.rangeStart, firstClick.rangeEnd, "2026-05-10")
    expect(secondClick).toEqual({ rangeStart: "2026-05-09", rangeEnd: "2026-05-10" })
  })

  it("allows same-day range when clicking same date twice", () => {
    const firstClick = resolveCalendarRangeSelection(undefined, undefined, "2026-05-09")
    const secondClick = resolveCalendarRangeSelection(firstClick.rangeStart, firstClick.rangeEnd, "2026-05-09")
    expect(secondClick).toEqual({ rangeStart: "2026-05-09", rangeEnd: "2026-05-09" })
  })
})
