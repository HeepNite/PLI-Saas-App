// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useStaffPortalShellAdmin } from "@/components/front/staff/useStaffPortalShellAdmin"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const getTokenMock = vi.fn<(options?: { skipCache?: boolean }) => Promise<string | null>>()

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ getToken: getTokenMock }),
}))

type HookState = ReturnType<typeof useStaffPortalShellAdmin>

function HookHarness({ onState, setError }: { onState: (state: HookState) => void; setError: (message: string | null) => void }) {
  const state = useStaffPortalShellAdmin({
    currentRole: "admin",
    resolvedCurrentCategory: "manager",
    navItems: [],
    searchParams: { get: () => null },
    expandAssistantRail: vi.fn(),
    setError,
  })
  React.useEffect(() => {
    onState(state)
  }, [onState, state])
  return null
}

describe("useStaffAuthedFetch (via useStaffPortalShellAdmin)", () => {
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
    getTokenMock.mockReset()
  })

  async function renderHook(setError: (message: string | null) => void = vi.fn()) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<HookHarness setError={setError} onState={(state) => { latestState = state }} />))
    return latestState!
  }

  it("resolves with the retried response on a transient 401 and does not redirect", async () => {
    getTokenMock.mockResolvedValue("fresh-token")
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal("fetch", fetchMock)
    const setError = vi.fn()

    const state = await renderHook(setError)

    let response: Response | undefined
    await act(async () => {
      response = await state.staffAuthedFetch("/api/staff/payments/pulse")
    })

    expect(response?.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getTokenMock).toHaveBeenCalledTimes(1)
    expect(getTokenMock).toHaveBeenCalledWith({ skipCache: true })
    // handleStaffAuthFailure was never invoked — its only observable side
    // effect (setError with the session-expired message) did not fire.
    expect(setError).not.toHaveBeenCalled()
  })

  it("returns the 401 response after exactly one retry and does NOT redirect (caller owns that)", async () => {
    getTokenMock.mockResolvedValue("fresh-token")
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 401 })
    vi.stubGlobal("fetch", fetchMock)
    const setError = vi.fn()

    const state = await renderHook(setError)

    let response: Response | undefined
    await act(async () => {
      response = await state.staffAuthedFetch("/api/staff/payments/pulse")
    })

    // On a persistent 401 the wrapper surfaces the 401 response as-is; the
    // redirect is the caller's `handleStaffAuthFailure(res.status)` check, the
    // single choke point. So the wrapper itself must NOT redirect (no setError).
    expect(response?.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getTokenMock).toHaveBeenCalledTimes(1)
    expect(setError).not.toHaveBeenCalled()
  })

  it("still retries once and surfaces the response when the token refresh rejects (offline)", async () => {
    getTokenMock.mockRejectedValue(new Error("clerk offline"))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
    vi.stubGlobal("fetch", fetchMock)
    const setError = vi.fn()

    const state = await renderHook(setError)

    let response: Response | undefined
    let threw = false
    await act(async () => {
      try {
        response = await state.staffAuthedFetch("/api/staff/payments/pulse")
      } catch {
        threw = true
      }
    })

    // A failed refresh must not throw out of the wrapper: it still retries once
    // and returns whatever the retry yields.
    expect(threw).toBe(false)
    expect(response?.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getTokenMock).toHaveBeenCalledTimes(1)
    expect(setError).not.toHaveBeenCalled()
  })

  it("passes 403 through unchanged without retrying or refreshing the token", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 403 })
    vi.stubGlobal("fetch", fetchMock)
    const setError = vi.fn()

    const state = await renderHook(setError)

    let response: Response | undefined
    await act(async () => {
      response = await state.staffAuthedFetch("/api/staff/payments/pulse")
    })

    expect(response?.status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getTokenMock).not.toHaveBeenCalled()
    // staffAuthedFetch itself must not call handleStaffAuthFailure for a
    // non-401 status — that call is the caller's responsibility.
    expect(setError).not.toHaveBeenCalled()
  })

  it("bounds the retry to exactly one attempt per failed request (no retry storm)", async () => {
    getTokenMock.mockResolvedValue("fresh-token")
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    vi.stubGlobal("fetch", fetchMock)

    const state = await renderHook()

    await act(async () => {
      await state.staffAuthedFetch("/api/staff/payments/pulse")
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getTokenMock).toHaveBeenCalledTimes(1)
  })
})
