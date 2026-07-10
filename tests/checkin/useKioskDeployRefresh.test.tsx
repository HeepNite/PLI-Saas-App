// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useKioskDeployRefresh } from "@/components/front/checkin/hooks/useKioskDeployRefresh"
import { KIOSK_DEPLOY_POLL_INTERVAL_MS } from "@/lib/checkin/kiosk-deploy-refresh"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type HookProps = Parameters<typeof useKioskDeployRefresh>[0]

const RUNNING_BUILD_ID = "sha-running"

const buildIdResponse = (buildId: string) =>
  ({ ok: true, json: async () => ({ buildId }) }) as Response

describe("useKioskDeployRefresh", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let fetchMock: ReturnType<typeof vi.fn>
  let reloadPage: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", RUNNING_BUILD_ID)
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    reloadPage = vi.fn<() => void>()
    window.sessionStorage.clear()
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  async function mount(props: Partial<HookProps> = {}) {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    const resolved: HookProps = {
      enabled: true,
      isFlowActive: () => false,
      reloadPage,
      ...props,
    }
    function Harness() {
      useKioskDeployRefresh(resolved)
      return null
    }
    await act(async () => root!.render(React.createElement(Harness)))
  }

  async function advanceOnePollTick() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(KIOSK_DEPLOY_POLL_INTERVAL_MS)
    })
  }

  it("reloads once when the server reports a new build id and the kiosk is idle", async () => {
    fetchMock.mockResolvedValue(buildIdResponse("sha-new"))

    await mount()
    await advanceOnePollTick()

    expect(fetchMock).toHaveBeenCalledWith("/api/build-id", { cache: "no-store" })
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it("does not reload while a customer flow is active", async () => {
    fetchMock.mockResolvedValue(buildIdResponse("sha-new"))

    await mount({ isFlowActive: () => true })
    await advanceOnePollTick()

    expect(fetchMock).toHaveBeenCalled()
    expect(reloadPage).not.toHaveBeenCalled()
  })

  it("does not spam reloads within the min reload interval", async () => {
    fetchMock.mockResolvedValue(buildIdResponse("sha-new"))

    await mount()
    await advanceOnePollTick() // 5 min — reloads
    await advanceOnePollTick() // 10 min — throttled (attempt was 5 min ago)

    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it("does not reload when the server build id matches the running one", async () => {
    fetchMock.mockResolvedValue(buildIdResponse(RUNNING_BUILD_ID))

    await mount()
    await advanceOnePollTick()

    expect(reloadPage).not.toHaveBeenCalled()
  })

  it("silently ignores fetch failures", async () => {
    fetchMock.mockRejectedValue(new Error("network down"))

    await mount()
    await advanceOnePollTick()

    expect(reloadPage).not.toHaveBeenCalled()
  })

  it("no-ops when the running build id is empty (local dev)", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "")

    await mount()
    await advanceOnePollTick()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(reloadPage).not.toHaveBeenCalled()
  })

  it("no-ops when disabled", async () => {
    await mount({ enabled: false })
    await advanceOnePollTick()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("checks immediately when the tab becomes visible", async () => {
    fetchMock.mockResolvedValue(buildIdResponse("sha-new"))

    await mount()
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it("stops polling on unmount", async () => {
    fetchMock.mockResolvedValue(buildIdResponse("sha-new"))

    await mount()
    await act(async () => root?.unmount())
    root = null

    await advanceOnePollTick()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps throttling a fresh mount after a reload, because the throttle is persisted in sessionStorage", async () => {
    fetchMock.mockResolvedValue(buildIdResponse("sha-new"))

    // First mount reloads once, "persisting" the throttle timestamp.
    await mount()
    await advanceOnePollTick()
    expect(reloadPage).toHaveBeenCalledTimes(1)

    // Simulate what a real reload does: wipe all in-memory JS state by
    // unmounting the tree and mounting a brand new component instance.
    // sessionStorage — unlike the old in-memory ref — survives this.
    await act(async () => root?.unmount())
    root = null
    await mount()

    // Still within the min reload interval (10 min): only 5 min elapsed
    // since the first reload attempt, so the fresh mount must NOT reload
    // again even though the running/server build ids still differ.
    await advanceOnePollTick()
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })

  it("falls back to the in-memory throttle without crashing when sessionStorage throws", async () => {
    fetchMock.mockResolvedValue(buildIdResponse("sha-new"))
    const getItemSpy = vi
      .spyOn(window.sessionStorage.__proto__, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError: storage disabled")
      })
    const setItemSpy = vi
      .spyOn(window.sessionStorage.__proto__, "setItem")
      .mockImplementation(() => {
        throw new Error("SecurityError: storage disabled")
      })

    await expect(mount()).resolves.not.toThrow()
    await expect(advanceOnePollTick()).resolves.not.toThrow()

    expect(reloadPage).toHaveBeenCalledTimes(1)

    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
  })

  it("reloads at most once when the interval tick and a visibilitychange race each other", async () => {
    const pendingResolvers: Array<(response: Response) => void> = []
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          pendingResolvers.push(resolve)
        })
    )

    await mount()

    await act(async () => {
      // Trigger the interval tick and a visibilitychange in the same tick,
      // before the first fetch has resolved. Without the in-flight guard,
      // both checks would call fetch and both would independently pass the
      // (still-null) throttle gate once their fetch resolves.
      await vi.advanceTimersByTimeAsync(KIOSK_DEPLOY_POLL_INTERVAL_MS)
      document.dispatchEvent(new Event("visibilitychange"))

      // Resolve every fetch that was actually issued while racing.
      pendingResolvers.forEach((resolve) => resolve(buildIdResponse("sha-new")))
      await vi.advanceTimersByTimeAsync(0)
    })

    // The in-flight guard means only the first check reaches fetch.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(reloadPage).toHaveBeenCalledTimes(1)
  })
})
