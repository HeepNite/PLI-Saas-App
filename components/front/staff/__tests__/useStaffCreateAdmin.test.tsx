// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffCreateAdmin } from "@/components/front/staff/useStaffCreateAdmin"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

type HookState = ReturnType<typeof useStaffCreateAdmin>

function HookHarness({
  refreshRows,
  setError,
  onState,
}: {
  refreshRows: () => Promise<void>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  onState: (state: HookState) => void
}) {
  const state = useStaffCreateAdmin({ refreshRows, setError })
  onState(state)
  return <div>{state.createMessage}</div>
}

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)

const submitEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>

describe("useStaffCreateAdmin", () => {
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

  async function renderHookHarness(refreshRows = vi.fn(async () => undefined), setError = vi.fn()) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness refreshRows={refreshRows} setError={setError} onState={(state) => { latestState = state }} />))
    return { state: latestState!, refreshRows, setError }
  }

  it("creates/promotes staff users with normalized category and optional PIN", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ mode: "promoted" }) as unknown as Response)
    const { state, refreshRows } = await renderHookHarness()

    await act(async () => {
      state.setEmail("ada@example.com")
      state.setFirstName("Ada")
      state.setLastName("Teacher")
      state.setNewRole("admin")
      state.setNewCategory("guest")
      state.setNewPin("1234")
    })
    await act(async () => {
      await latestState!.createStaff(submitEvent)
    })

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/staff/users", expect.objectContaining({ method: "POST" }))
    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body).toMatchObject({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Teacher",
      role: "admin",
      category: "manager",
      pin: "1234",
    })
    expect(latestState!.createMessage).toBe("Existing user promoted to staff with PIN assigned")
    expect(latestState!.email).toBe("")
    expect(refreshRows).toHaveBeenCalled()
  })

  it("shows invited message using returned invitation email", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ mode: "invited", invitation: { emailAddress: "invite@example.com" } }) as unknown as Response)
    const { state } = await renderHookHarness()

    await act(async () => {
      state.setEmail("ada@example.com")
      await latestState!.createStaff(submitEvent)
    })

    expect(latestState!.createMessage).toBe("Invitation sent to invite@example.com")
  })

  it("routes API and network failures to the shared error banner", async () => {
    const setError = vi.fn()
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ error: "Nope" }, false, 400) as unknown as Response)
    const { state } = await renderHookHarness(vi.fn(async () => undefined), setError)

    await act(async () => {
      await state.createStaff(submitEvent)
    })
    expect(setError).toHaveBeenLastCalledWith("Nope")

    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"))
    await act(async () => {
      await latestState!.createStaff(submitEvent)
    })
    expect(setError).toHaveBeenLastCalledWith("Network error while creating staff user")
  })
})
