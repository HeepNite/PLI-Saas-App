// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffDirectoryAdmin } from "@/components/front/staff/useStaffDirectoryAdmin"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffDirectoryAdmin>

function HookHarness({ onState, canAccessUsersNav = true }: { onState: (state: HookState) => void; canAccessUsersNav?: boolean }) {
  const [error, setError] = React.useState<string | null>(null)
  const scheduleEventsByDay = React.useMemo(() => ({}), [])
  const ensureMinimumLoadingTime = React.useCallback(async () => undefined, [])
  const handleStaffAuthFailure = React.useCallback(() => false, [])
  const isInsideCriticalClassWindow = React.useCallback(() => false, [])
  const state = useStaffDirectoryAdmin({
    canAccessUsersNav,
    canManageClerkSync: false,
    shouldFetchClerkSyncHealth: false,
    scheduleEventsByDay,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    isInsideCriticalClassWindow,
    setError,
    enableAutoRefresh: false,
  })
  onState({ ...state, error } as HookState)
  return <div>{state.rows.length}</div>
}

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  Promise.resolve({
    ok,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as Response)

describe("useStaffDirectoryAdmin", () => {
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

  async function renderHookHarness(canAccessUsersNav = true) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness canAccessUsersNav={canAccessUsersNav} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("loads staff rows and payroll model options on accessible users nav", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/users") && !url.includes("payroll-model")) {
        return jsonResponse({ items: [{ id: "user-1", email: "ada@example.com", firstName: "Ada", lastName: "Teacher" }] })
      }
      if (url.includes("/api/staff/payroll/payment-models")) {
        return jsonResponse({ items: [{ id: "model-1", name: "Hourly", active: true, isDefault: true }] })
      }
      return jsonResponse({})
    })

    const state = await renderHookHarness()

    expect(state.rows).toHaveLength(1)
    expect(state.payrollModelOptions).toEqual([{ id: "model-1", name: "Hourly", active: true, isDefault: true }])
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/staff/users"), expect.objectContaining({ cache: "no-store" }))
    expect(fetchMock).toHaveBeenCalledWith("/api/staff/payroll/payment-models", expect.objectContaining({ cache: "no-store" }))
  })

  it("updates a row avatar through the exposed row updater", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/users") && !url.includes("payroll-model")) {
        return jsonResponse({ items: [{ id: "user-1", avatarUrl: "old.png" }] })
      }
      if (url.includes("/api/staff/payroll/payment-models")) return jsonResponse({ items: [] })
      return jsonResponse({})
    })
    const state = await renderHookHarness()

    await act(async () => {
      state.updateRowAvatar("user-1", "new.png")
    })

    expect(latestState!.rows[0]?.avatarUrl).toBe("new.png")
  })

  it("clears directory state when users nav is inaccessible", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({} as Response)

    const state = await renderHookHarness(false)

    expect(state.loading).toBe(false)
    expect(state.rows).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
