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
})
