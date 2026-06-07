// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffScheduleAdmin } from "@/components/front/staff/useStaffScheduleAdmin"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffScheduleAdmin>

function HookHarness({ onState, canAccessSchoolNav = true }: { onState: (state: HookState) => void; canAccessSchoolNav?: boolean }) {
  const ensureMinimumLoadingTime = React.useCallback(async () => undefined, [])
  const handleStaffAuthFailure = React.useCallback(() => false, [])
  const state = useStaffScheduleAdmin({ canAccessSchoolNav, ensureMinimumLoadingTime, handleStaffAuthFailure })
  onState(state)
  return <div>{state.scheduleMonthLabel}</div>
}

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)

describe("useStaffScheduleAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let latestState: HookState | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    latestState = null
    vi.restoreAllMocks()
  })

  async function renderHookHarness(canAccessSchoolNav = true) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness canAccessSchoolNav={canAccessSchoolNav} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("fetches schedule events for the current month when school nav is accessible", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ eventsByDay: { "2026-05-29": [{ id: "event-1" }] } }) as unknown as Response)

    const state = await renderHookHarness()

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/staff/schedule"), expect.objectContaining({ headers: { "Content-Type": "application/json" } }))
    expect(Object.keys(state.scheduleEventsByDay)).toEqual(["2026-05-29"])
    expect(state.calendarCells.length).toBeGreaterThan(0)
    expect(state.scheduleMonthLabel).toMatch(/\d{4}/)
  })

  it("does not fetch schedule when school nav is inaccessible", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}) as unknown as Response)

    await renderHookHarness(false)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("navigates between months", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ eventsByDay: {} }) as unknown as Response)
    const state = await renderHookHarness()
    const initialMonth = latestState!.scheduleMonth.getMonth()

    await act(async () => {
      state.goToNextMonth()
    })
    expect(latestState!.scheduleMonth.getMonth()).toBe((initialMonth + 1) % 12)

    await act(async () => {
      latestState!.goToPreviousMonth()
    })
    expect(latestState!.scheduleMonth.getMonth()).toBe(initialMonth)
  })
})
