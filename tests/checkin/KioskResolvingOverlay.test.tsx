// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  KioskPackageCheckInFailureOverlay,
  KioskResolvingOverlay,
} from "@/components/front/checkin/KioskResolvingOverlay"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("KioskResolvingOverlay", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const render = async (node: React.ReactElement) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(node))
    return container
  }

  it("shows kiosk-appropriate English-only default copy (no 'niños' text)", async () => {
    const view = await render(<KioskResolvingOverlay />)

    expect(view.textContent).toContain("Hang tight")
    expect(view.textContent).not.toContain("niños")
  })

  it("prefers an explicit message over the default copy", async () => {
    const view = await render(<KioskResolvingOverlay message="Still checking you in… (attempt 2 of 3)" />)

    expect(view.textContent).toContain("Still checking you in… (attempt 2 of 3)")
    expect(view.textContent).not.toContain("Hang tight")
  })
})

describe("KioskPackageCheckInFailureOverlay", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const render = async (node: React.ReactElement) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(node))
    return container
  }

  it("shows the failure message, Retry action, and 'see the front desk' guidance", async () => {
    const onRetry = vi.fn()
    const onDone = vi.fn()
    const view = await render(
      <KioskPackageCheckInFailureOverlay
        message="We couldn't check you in. Please see the front desk."
        onRetry={onRetry}
        onDone={onDone}
      />
    )

    expect(view.textContent).toContain("We couldn't check you in. Please see the front desk.")
    expect(view.textContent).toContain("Please see the front desk for help.")

    const retryButton = view.querySelector("button")
    expect(retryButton?.textContent).toBe("Retry")

    await act(async () => {
      retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
  })

  it("auto-resets to idle (onDone) after autoDoneMs elapses", async () => {
    vi.useFakeTimers()
    const onRetry = vi.fn()
    const onDone = vi.fn()
    await render(
      <KioskPackageCheckInFailureOverlay
        message="Server error"
        autoDoneMs={10_000}
        onRetry={onRetry}
        onDone={onDone}
      />
    )

    expect(onDone).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(10_000))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it("does not auto-reset when autoDoneMs is not provided", async () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    await render(
      <KioskPackageCheckInFailureOverlay message="Server error" onRetry={vi.fn()} onDone={onDone} />
    )

    await act(async () => vi.advanceTimersByTimeAsync(60_000))
    expect(onDone).not.toHaveBeenCalled()
  })

  it("cancels the pending auto-reset timer on unmount (Retry unmounting the overlay cancels it)", async () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout")
    await render(
      <KioskPackageCheckInFailureOverlay
        message="Server error"
        autoDoneMs={10_000}
        onRetry={vi.fn()}
        onDone={vi.fn()}
      />
    )
    clearTimeoutSpy.mockClear()

    await act(async () => root?.unmount())
    root = null

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})
