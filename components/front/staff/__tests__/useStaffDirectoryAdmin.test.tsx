// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffDirectoryAdmin } from "@/components/front/staff/useStaffDirectoryAdmin"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffDirectoryAdmin>
type HookHarnessState = HookState & { error: string | null }

function HookHarness({
  onState,
  canAccessUsersNav = true,
  canManageClerkSync = false,
  shouldFetchClerkSyncHealth = false,
}: {
  onState: (state: HookHarnessState) => void
  canAccessUsersNav?: boolean
  canManageClerkSync?: boolean
  shouldFetchClerkSyncHealth?: boolean
}) {
  const [error, setError] = React.useState<string | null>(null)
  const scheduleEventsByDay = React.useMemo(() => ({}), [])
  const ensureMinimumLoadingTime = React.useCallback(async () => undefined, [])
  const handleStaffAuthFailure = React.useCallback(() => false, [])
  const isInsideCriticalClassWindow = React.useCallback(() => false, [])
  const state = useStaffDirectoryAdmin({
    canAccessUsersNav,
    canManageClerkSync,
    shouldFetchClerkSyncHealth,
    scheduleEventsByDay,
    ensureMinimumLoadingTime,
    handleStaffAuthFailure,
    isInsideCriticalClassWindow,
    setError,
    enableAutoRefresh: false,
  })
  onState({ ...state, error })
  return <div>{state.rows.length}</div>
}

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500, headers = new Headers()) =>
  Promise.resolve({
    ok,
    status,
    headers,
    json: () => Promise.resolve(body),
  } as Response)

describe("useStaffDirectoryAdmin", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let latestState: HookHarnessState | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    latestState = null
    vi.restoreAllMocks()
  })

  async function renderHookHarness(props: Partial<React.ComponentProps<typeof HookHarness>> = {}) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness {...props} onState={(state) => { latestState = state }} />))
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

    const state = await renderHookHarness({ canAccessUsersNav: false })

    expect(state.loading).toBe(false)
    expect(state.rows).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not check Clerk sync health on load and preserves explicit manual checks", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/users/sync-clerk/health")) {
        return jsonResponse({ clerkUsers: 1, dbUsersWithClerkId: 1, missingCount: 0, missingUsers: [] })
      }
      if (url.includes("/api/staff/users") && !url.includes("payroll-model")) return jsonResponse({ items: [] })
      if (url.includes("/api/staff/payroll/payment-models")) return jsonResponse({ items: [] })
      return jsonResponse({})
    })

    const state = await renderHookHarness({ canManageClerkSync: true, shouldFetchClerkSyncHealth: false })

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/staff/users/sync-clerk/health",
      expect.anything(),
    )

    await act(async () => {
      await state.fetchClerkSyncHealth()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/staff/users/sync-clerk/health",
      expect.objectContaining({ cache: "no-store" }),
    )
  })

  it("treats degraded Clerk sync health as a visible non-blocking unavailable state", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/users/sync-clerk/health")) {
        return jsonResponse({
          status: "degraded",
          error: "User sync status is temporarily unavailable. Try checking again shortly.",
        })
      }
      if (url.includes("/api/staff/users") && !url.includes("payroll-model")) return jsonResponse({ items: [] })
      if (url.includes("/api/staff/payroll/payment-models")) return jsonResponse({ items: [] })
      return jsonResponse({})
    })

    const state = await renderHookHarness({ canManageClerkSync: true, shouldFetchClerkSyncHealth: false })

    await act(async () => {
      await state.fetchClerkSyncHealth()
    })

    expect(latestState!.clerkSyncError).toBe("User sync status is temporarily unavailable. Try checking again shortly.")
    expect(latestState!.clerkSyncHealth).toBeNull()
  })

  it("keeps rows and exposes non-blocking status when staff users response is degraded", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/users") && !url.includes("payroll-model")) {
        return jsonResponse({
          status: "degraded",
          presenceUnavailable: true,
          message: "Staff user presence is temporarily unavailable. Showing saved user rows.",
          items: [{ id: "saved-1", email: "saved@example.com", firstName: "Saved", lastName: "Staff" }],
        })
      }
      if (url.includes("/api/staff/payroll/payment-models")) return jsonResponse({ items: [] })
      return jsonResponse({})
    })

    const state = await renderHookHarness()

    expect(state.rows).toHaveLength(1)
    expect(state.directoryStatusMessage).toBe("Staff user presence is temporarily unavailable. Showing saved user rows.")
    expect(state.error).toBeNull()
  })

  it("preserves existing rows and avoids global service busy on later 429 users response", async () => {
    const retryHeaders = new Headers({ "Retry-After": "30" })
    let usersCallCount = 0
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input)
      if (url.includes("/api/staff/users") && !url.includes("payroll-model")) {
        usersCallCount += 1
        if (usersCallCount > 1) {
          return jsonResponse({ error: "Service temporarily busy. Please try again shortly." }, false, 429, retryHeaders)
        }
        return jsonResponse({ items: [{ id: "user-1", email: "ada@example.com", firstName: "Ada", lastName: "Teacher" }] })
      }
      if (url.includes("/api/staff/payroll/payment-models")) return jsonResponse({ items: [] })
      return jsonResponse({})
    })

    const state = await renderHookHarness()
    await act(async () => {
      await state.fetchRows(undefined, "all", { showLoader: false, enforceMinDelay: false })
    })

    expect(latestState!.rows).toEqual([{ id: "user-1", email: "ada@example.com", firstName: "Ada", lastName: "Teacher" }])
    expect(latestState!.directoryStatusMessage).toBe("Service temporarily busy. Please try again shortly.")
    expect(latestState!.error).toBeNull()
  })
})
