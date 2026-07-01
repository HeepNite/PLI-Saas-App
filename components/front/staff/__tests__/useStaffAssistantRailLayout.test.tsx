// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
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

  it("releases the assistant grid column immediately when the rail closes", async () => {
    const values: boolean[] = []

    await renderProbe(false, (value) => values.push(value.shouldReserveAssistantColumn))
    await renderProbe(true, (value) => values.push(value.shouldReserveAssistantColumn))

    expect(values.at(-1)).toBe(false)
  })

  it("keeps rail timing visual-only without an artificial layout handoff", () => {
    expect(STAFF_ASSISTANT_RAIL_EXIT_DURATION_MS).toBe(240)
  })

  it("reserves the assistant column immediately when the rail reopens", async () => {
    vi.useFakeTimers()
    const values: boolean[] = []

    await renderProbe(true, (value) => values.push(value.shouldReserveAssistantColumn))
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
