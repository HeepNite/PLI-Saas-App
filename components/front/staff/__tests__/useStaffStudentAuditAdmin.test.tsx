// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffStudentAuditAdmin } from "@/components/front/staff/useStaffStudentAuditAdmin"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffStudentAuditAdmin>

function HookHarness({ onState }: { onState: (state: HookState) => void }) {
  const state = useStaffStudentAuditAdmin()
  React.useEffect(() => {
    onState(state)
  }, [onState, state])
  return null
}

describe("useStaffStudentAuditAdmin", () => {
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

  async function renderHook() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("opens and closes the override modal", async () => {
    const state = await renderHook()

    await act(async () => {
      state.openOverrideModal("student-1", "Ada Lovelace")
    })
    expect(latestState!.overrideModalOpen).toBe(true)
    expect(latestState!.overrideModalStudent).toEqual({ id: "student-1", name: "Ada Lovelace" })

    await act(async () => {
      latestState!.closeOverrideModal()
    })
    expect(latestState!.overrideModalOpen).toBe(false)
    expect(latestState!.overrideModalStudent).toBeNull()
  })

  it("marks users that have current-month audit entries", async () => {
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"))
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { entries: [{ createdAt: "2026-03-10T10:00:00.000Z" }] } }),
    })
    vi.stubGlobal("fetch", fetchMock)
    const state = await renderHook()

    await act(async () => {
      await state.checkUserHasAuditEntries("student-1")
    })

    expect(fetchMock).toHaveBeenCalledWith("/api/staff/students/student-1/audit-log?pageSize=50")
    expect(latestState!.usersWithAuditEntries.has("student-1")).toBe(true)
  })

  it("silently ignores audit lookup failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"))
    vi.stubGlobal("fetch", fetchMock)
    const state = await renderHook()

    await act(async () => {
      await state.checkUserHasAuditEntries("student-2")
    })

    expect(latestState!.usersWithAuditEntries.has("student-2")).toBe(false)
  })
})
