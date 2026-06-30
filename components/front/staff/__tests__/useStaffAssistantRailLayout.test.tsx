// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  STAFF_ASSISTANT_LAYOUT_RELEASE_DELAY_MS,
  STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS,
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
  onValue: (value: { shouldReserveAssistantColumn: boolean }) => void
}) {
  const layout = useStaffAssistantRailLayout(isRailCollapsed)

  React.useEffect(() => {
    onValue(layout)
  }, [layout, onValue])

  return (
    <div
      data-testid="reservation-probe"
      data-reserved={String(layout.shouldReserveAssistantColumn)}
    />
  )
}

describe("useStaffAssistantRailLayout", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.useRealTimers()
  })

  async function renderProbe(
    isRailCollapsed: boolean,
    onValue: (value: { shouldReserveAssistantColumn: boolean }) => void
  ) {
    if (!container) {
      container = document.createElement("div")
      document.body.appendChild(container)
      root = createRoot(container)
    }

    await act(async () => root!.render(<Probe isRailCollapsed={isRailCollapsed} onValue={onValue} />))
  }

  it("keeps the assistant grid column reserved only during the quick content exit", async () => {
    vi.useFakeTimers()
    const values: boolean[] = []

    await renderProbe(false, (value) => values.push(value.shouldReserveAssistantColumn))
    await renderProbe(true, (value) => values.push(value.shouldReserveAssistantColumn))

    expect(values.at(-1)).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(STAFF_ASSISTANT_LAYOUT_RELEASE_DELAY_MS)
    })

    expect(values.at(-1)).toBe(false)
  })

  it("uses quick transform/opacity timing and a minimal discrete layout release delay", () => {
    expect(STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS).toBe(160)
    expect(STAFF_ASSISTANT_LAYOUT_RELEASE_DELAY_MS).toBe(140)
    expect(STAFF_ASSISTANT_LAYOUT_RELEASE_DELAY_MS).toBeLessThanOrEqual(160)
  })

  it("reserves the assistant column immediately when the rail reopens", async () => {
    vi.useFakeTimers()
    const values: boolean[] = []

    await renderProbe(true, (value) => values.push(value.shouldReserveAssistantColumn))
    await act(async () => {
      vi.advanceTimersByTime(STAFF_ASSISTANT_LAYOUT_RELEASE_DELAY_MS)
    })
    expect(values.at(-1)).toBe(false)

    await renderProbe(false, (value) => values.push(value.shouldReserveAssistantColumn))

    expect(values.at(-1)).toBe(true)
  })

  it("resolves reservation from open state or the short delayed hold", () => {
    expect(resolveStaffAssistantColumnReservation(true, false)).toBe(false)
    expect(resolveStaffAssistantColumnReservation(true, true)).toBe(true)
    expect(resolveStaffAssistantColumnReservation(false, false)).toBe(true)
  })
})
