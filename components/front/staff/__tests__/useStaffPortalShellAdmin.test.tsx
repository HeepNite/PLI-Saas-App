// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { StaffPortalNavItem } from "@/components/front/staff/StaffPortalNavButton"
import { useStaffPortalShellAdmin } from "@/components/front/staff/useStaffPortalShellAdmin"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const getTokenMock = vi.fn<(options?: { skipCache?: boolean }) => Promise<string | null>>()

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

const Icon = () => null
const navItems: StaffPortalNavItem[] = [
  { key: "users", label: "User Management", icon: Icon },
  { key: "students", label: "Students", icon: Icon },
  { key: "schedule", label: "School", icon: Icon },
  { key: "assistant", label: "AI Assistant", icon: Icon },
  { key: "profile", label: "Profile", icon: Icon },
]

type HookOptions = Parameters<typeof useStaffPortalShellAdmin>[0]
type HookState = ReturnType<typeof useStaffPortalShellAdmin>

const createOptions = (overrides: Partial<HookOptions> = {}): HookOptions => ({
  currentRole: "admin",
  resolvedCurrentCategory: "manager",
  navItems,
  searchParams: { get: () => null },
  expandAssistantRail: vi.fn(),
  setError: vi.fn(),
  ...overrides,
})

function HookHarness({ options, onState }: { options: HookOptions; onState: (state: HookState) => void }) {
  const state = useStaffPortalShellAdmin(options)
  React.useEffect(() => {
    onState(state)
  }, [onState, state])
  return null
}

describe("useStaffPortalShellAdmin", () => {
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
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function renderHook(options: HookOptions = createOptions()) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness options={options} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("derives visible navigation and role permissions", async () => {
    const state = await renderHook(createOptions({ currentRole: "admin", resolvedCurrentCategory: "manager" }))

    expect(state.visibleNavItems.map((item) => item.key)).toContain("users")
    expect(state.canManageClerkSync).toBe(true)
    expect(state.canManageTerminalSetup).toBe(true)
    expect(state.assignableRoles).toEqual(["admin", "staff"])
    expect(state.canManageTarget({ role: "owner" } as Parameters<typeof state.canManageTarget>[0])).toBe(false)
  })

  it("selects nav from query params and expands assistant rail on assistant selection", async () => {
    const expandAssistantRail = vi.fn()
    const state = await renderHook(createOptions({
      searchParams: { get: (name) => name === "nav" ? "students" : null },
      expandAssistantRail,
    }))

    expect(state.activeNav).toBe("students")

    await act(async () => {
      latestState!.handleNavSelection("assistant")
    })

    expect(expandAssistantRail).toHaveBeenCalledTimes(1)
    expect(latestState!.activeNav).toBe("assistant")
  })

  it("routes auth failures with nav suffix", async () => {
    const setError = vi.fn()
    const state = await renderHook(createOptions({ setError }))
    window.history.pushState({}, "", "/staff/admin?nav=students")

    const handled = state.handleStaffAuthFailure(401)

    expect(handled).toBe(true)
    expect(setError).toHaveBeenCalledWith("Staff session expired. Please validate your PIN again.")
  })

  it("exposes a stable staffAuthedFetch function alongside handleStaffAuthFailure", async () => {
    const state = await renderHook()

    expect(typeof state.staffAuthedFetch).toBe("function")

    const firstReference = latestState!.staffAuthedFetch
    await act(async () => {
      latestState!.handleNavSelection("students")
    })

    expect(latestState!.staffAuthedFetch).toBe(firstReference)
  })
})
