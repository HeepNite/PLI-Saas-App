// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import CalendarPicker from "@/components/front/ui/CalendarPicker"

type HarnessProps = {
  anchorValue?: string
  initialRangeStart?: string
  initialRangeEnd?: string
  onChange?: (value: string) => void
  onRangeChange?: (rangeStart: string, rangeEnd?: string) => void
}

function CalendarPickerHarness({
  anchorValue = "2026-03-10",
  initialRangeStart,
  initialRangeEnd,
  onChange,
  onRangeChange,
}: HarnessProps) {
  const [value, setValue] = React.useState(anchorValue)
  const [rangeStart, setRangeStart] = React.useState(initialRangeStart)
  const [rangeEnd, setRangeEnd] = React.useState(initialRangeEnd)

  return (
    <CalendarPicker
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue)
        onChange?.(nextValue)
      }}
      rangeMode
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      onRangeChange={(nextRangeStart, nextRangeEnd) => {
        setRangeStart(nextRangeStart || undefined)
        setRangeEnd(nextRangeEnd)
        onRangeChange?.(nextRangeStart, nextRangeEnd)
      }}
      minDate="2026-03-01"
    />
  )
}

let container: HTMLDivElement | null = null
let root: Root | null = null

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function renderCalendar(props: HarnessProps = {}) {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)

  await act(async () => {
    root?.render(<CalendarPickerHarness {...props} />)
  })

  return container
}

function getDayButton(dayLabel: string) {
  const buttons = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[]
  const match = buttons.find(
    (button) => !button.getAttribute("aria-label") && button.textContent?.trim() === dayLabel
  )

  if (!match) {
    throw new Error(`Day button ${dayLabel} not found`)
  }

  return match
}

function getRangePosition(dayLabel: string) {
  return getDayButton(dayLabel).parentElement?.getAttribute("data-range-position")
}

function getRangeHighlight(dayLabel: string) {
  return getDayButton(dayLabel).getAttribute("data-range-highlight")
}

async function clickDay(dayLabel: string) {
  const button = getDayButton(dayLabel)

  await act(async () => {
    button.click()
  })

  return button
}

afterEach(async () => {
  await act(async () => {
    root?.unmount()
  })
  container?.remove()
  root = null
  container = null
})

describe("CalendarPicker range mode", () => {
  it("sets the range start on the first click", async () => {
    const onChange = vi.fn()
    const onRangeChange = vi.fn()

    await renderCalendar({ onChange, onRangeChange })

    const day10 = await clickDay("10")

    expect(onRangeChange).toHaveBeenLastCalledWith("2026-03-10", undefined)
    expect(onChange).toHaveBeenLastCalledWith("2026-03-10")
    expect(day10.parentElement?.getAttribute("data-range-position")).toBe("single")
    expect(day10.getAttribute("data-range-highlight")).toBe("true")
  })

  it("sets the range end on the second click", async () => {
    const onChange = vi.fn()
    const onRangeChange = vi.fn()

    await renderCalendar({ onChange, onRangeChange })

    await clickDay("10")
    const day13 = await clickDay("13")

    expect(onRangeChange).toHaveBeenLastCalledWith("2026-03-10", "2026-03-13")
    expect(onChange).toHaveBeenLastCalledWith("2026-03-13")
    expect(getRangePosition("10")).toBe("start")
    expect(getRangePosition("11")).toBe("middle")
    expect(getRangePosition("12")).toBe("middle")
    expect(day13.parentElement?.getAttribute("data-range-position")).toBe("end")
  })

  it("supports same-day ranges", async () => {
    const onRangeChange = vi.fn()

    await renderCalendar({ onRangeChange })

    const day10 = await clickDay("10")
    await clickDay("10")

    expect(onRangeChange).toHaveBeenLastCalledWith("2026-03-10", "2026-03-10")
    expect(day10.parentElement?.getAttribute("data-range-position")).toBe("single")
    expect(day10.getAttribute("data-range-highlight")).toBe("true")
  })

  it("restarts the range when clicking a new day after selecting start and end", async () => {
    const onChange = vi.fn()
    const onRangeChange = vi.fn()

    await renderCalendar({ onChange, onRangeChange })

    await clickDay("10")
    await clickDay("13")
    const day15 = await clickDay("15")

    expect(onRangeChange).toHaveBeenLastCalledWith("2026-03-15", undefined)
    expect(onChange).toHaveBeenLastCalledWith("2026-03-15")
    expect(getRangePosition("10")).toBeNull()
    expect(getRangePosition("13")).toBeNull()
    expect(day15.parentElement?.getAttribute("data-range-position")).toBe("single")
    expect(day15.getAttribute("data-range-highlight")).toBe("true")
  })

  it("renders highlight metadata across the selected range", async () => {
    await renderCalendar({
      initialRangeStart: "2026-03-10",
      initialRangeEnd: "2026-03-13",
    })

    expect(getRangeHighlight("9")).toBeNull()
    expect(getRangeHighlight("10")).toBe("true")
    expect(getRangeHighlight("11")).toBe("true")
    expect(getRangeHighlight("12")).toBe("true")
    expect(getRangeHighlight("13")).toBe("true")
    expect(getRangeHighlight("14")).toBeNull()
    expect(getRangePosition("10")).toBe("start")
    expect(getRangePosition("11")).toBe("middle")
    expect(getRangePosition("12")).toBe("middle")
    expect(getRangePosition("13")).toBe("end")
  })
})
