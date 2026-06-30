// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS,
  STAFF_ASSISTANT_RAIL_EXIT_LAYOUT_DELAY_MS,
  resolveStaffAssistantColumnReservation,
  useStaffAssistantRailLayout,
} from "@/components/front/staff/useStaffAssistantRailLayout"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

function Probe({
  isRailCollapsed,
  onValue,
}: {
  isRailCollapsed: boolean
  onValue: (value: boolean) => void
}) {
  const shouldReserveAssistantColumn = useStaffAssistantRailLayout(isRailCollapsed)

  React.useEffect(() => {
    onValue(shouldReserveAssistantColumn)
  }, [onValue, shouldReserveAssistantColumn])

  return <div data-testid="reservation-probe" data-reserved={String(shouldReserveAssistantColumn)} />
}

describe("useStaffAssistantRailLayout", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.useRealTimers()
  })

  async function renderProbe(isRailCollapsed: boolean, onValue: (value: boolean) => void) {
    if (!container) {
      container = document.createElement("div")
      document.body.appendChild(container)
      root = createRoot(container)
    }

    await act(async () => root!.render(<Probe isRailCollapsed={isRailCollapsed} onValue={onValue} />))
  }

  it("keeps the assistant column reserved until the rail exit delay completes", async () => {
    const values: boolean[] = []

    await renderProbe(false, (value) => values.push(value))
    await renderProbe(true, (value) => values.push(value))

    expect(values.at(-1)).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(STAFF_ASSISTANT_RAIL_EXIT_LAYOUT_DELAY_MS - 1)
    })

    expect(values.at(-1)).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(1)
    })

    expect(values.at(-1)).toBe(false)
  })

  it("releases layout shortly after the faster rail exit timing", () => {
    expect(STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS).toBe(350)
    expect(STAFF_ASSISTANT_RAIL_EXIT_LAYOUT_DELAY_MS).toBe(360)
  })

  it("reserves the assistant column immediately when the rail reopens", async () => {
    const values: boolean[] = []

    await renderProbe(true, (value) => values.push(value))
    expect(values.at(-1)).toBe(false)

    await renderProbe(false, (value) => values.push(value))

    expect(values.at(-1)).toBe(true)
  })

  it("resolves the assistant column reservation on the first reopen render before passive effects", () => {
    const delayedReservationHeld = false

    expect(resolveStaffAssistantColumnReservation(true, delayedReservationHeld)).toBe(false)
    expect(resolveStaffAssistantColumnReservation(false, delayedReservationHeld)).toBe(true)
  })
})
