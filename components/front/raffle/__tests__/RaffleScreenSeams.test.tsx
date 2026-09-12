// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { RaffleDrawVideoOverlay } from "@/components/front/raffle/RaffleScreenSeams"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

describe("RaffleDrawVideoOverlay", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  function findVideo(): HTMLVideoElement {
    return container!.querySelector("video") as HTMLVideoElement
  }

  it("is hidden outside a draw and visible while one is active", async () => {
    const onEnded = vi.fn()
    await act(async () => {
      root!.render(<RaffleDrawVideoOverlay videoUrl="/raffle/draw.mp4" active={false} onEnded={onEnded} />)
    })
    expect(findVideo().hidden).toBe(true)

    await act(async () => {
      root!.render(<RaffleDrawVideoOverlay videoUrl="/raffle/draw.mp4" active={true} onEnded={onEnded} />)
    })
    expect(findVideo().hidden).toBe(false)
  })

  it("treats jsdom's unimplemented play() (no promise returned) as finished immediately", async () => {
    // jsdom's HTMLMediaElement.play() logs "not implemented" and returns
    // undefined rather than a Promise — the real-browser contract always
    // returns one, so a non-promise return means playback cannot actually
    // start here, and must not block the reveal.
    const onEnded = vi.fn()
    await act(async () => {
      root!.render(<RaffleDrawVideoOverlay videoUrl="/raffle/draw.mp4" active={true} onEnded={onEnded} />)
    })
    expect(onEnded).toHaveBeenCalledTimes(1)
  })

  it("treats a rejected play() promise as finished immediately, without blocking on `ended`", async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() =>
      Promise.reject(new Error("NotAllowedError"))
    )
    const onEnded = vi.fn()
    await act(async () => {
      root!.render(<RaffleDrawVideoOverlay videoUrl="/raffle/draw.mp4" active={true} onEnded={onEnded} />)
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(onEnded).toHaveBeenCalledTimes(1)
  })

  it("waits for the native `ended` event while play() is genuinely in progress", async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => new Promise<void>(() => {}))
    const onEnded = vi.fn()
    await act(async () => {
      root!.render(<RaffleDrawVideoOverlay videoUrl="/raffle/draw.mp4" active={true} onEnded={onEnded} />)
    })
    expect(onEnded).not.toHaveBeenCalled()

    await act(async () => {
      findVideo().dispatchEvent(new Event("ended"))
    })
    expect(onEnded).toHaveBeenCalledTimes(1)
  })

  it("does not call play() again on a re-render that keeps the draw active", async () => {
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => new Promise<void>(() => {}))
    const onEnded = vi.fn()
    await act(async () => {
      root!.render(<RaffleDrawVideoOverlay videoUrl="/raffle/draw.mp4" active={true} onEnded={onEnded} />)
    })
    await act(async () => {
      root!.render(<RaffleDrawVideoOverlay videoUrl="/raffle/draw.mp4" active={true} onEnded={onEnded} />)
    })
    expect(playSpy).toHaveBeenCalledTimes(1)
  })
})
