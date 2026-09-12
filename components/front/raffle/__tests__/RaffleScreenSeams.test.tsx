// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  DRAW_ANIMATION_MS,
  RaffleDrawVideoOverlay,
  RaffleQrPanel,
} from "@/components/front/raffle/RaffleScreenSeams"

const playable = () => vi.spyOn(window.HTMLMediaElement.prototype, "play").mockResolvedValue(undefined)

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
testGlobal.IS_REACT_ACT_ENVIRONMENT = true

const toCanvasMock = vi.fn().mockResolvedValue(undefined)
vi.mock("qrcode", () => ({ toCanvas: toCanvasMock }))

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
    playable()
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

  it("falls back to the animation when play() returns no promise", async () => {
    // jsdom's HTMLMediaElement.play() logs "not implemented" and returns
    // undefined rather than a Promise — the real-browser contract always
    // returns one, so a non-promise return means playback cannot start
    // here, and the animation must take over instead of blocking.
    vi.useFakeTimers()
    const onEnded = vi.fn()
    await act(async () => {
      root!.render(<RaffleDrawVideoOverlay videoUrl="/raffle/draw.mp4" active={true} onEnded={onEnded} />)
    })
    expect(container!.querySelector('[data-testid="raffle-draw-animation"]')).not.toBeNull()
    expect(onEnded).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(DRAW_ANIMATION_MS)
    })
    expect(onEnded).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it("runs the animation when the event has no video at all", async () => {
    vi.useFakeTimers()
    const onEnded = vi.fn()
    await act(async () => {
      root!.render(<RaffleDrawVideoOverlay videoUrl="" active={true} onEnded={onEnded} />)
    })
    expect(container!.querySelector("video")).toBeNull()
    expect(container!.querySelector('[data-testid="raffle-draw-animation"]')).not.toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(DRAW_ANIMATION_MS)
    })
    expect(onEnded).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it("renders nothing outside a draw when there is no usable video", async () => {
    const onEnded = vi.fn()
    await act(async () => {
      root!.render(<RaffleDrawVideoOverlay videoUrl="" active={false} onEnded={onEnded} />)
    })
    expect(container!.querySelector('[data-testid="raffle-draw-animation"]')).toBeNull()
    expect(onEnded).not.toHaveBeenCalled()
  })

  it("falls back to the animation when play() is refused", async () => {
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
    expect(container!.querySelector('[data-testid="raffle-draw-animation"]')).not.toBeNull()
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

describe("RaffleQrPanel", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    toCanvasMock.mockClear()
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
  })

  it("renders a placeholder when there is no entry URL yet", async () => {
    await act(async () => {
      root!.render(<RaffleQrPanel entryUrl={null} />)
    })
    expect(container!.querySelector('[data-testid="raffle-qr-placeholder"]')).not.toBeNull()
    expect(container!.querySelector("img")).toBeNull()
  })

  it("renders the api.qrserver.com image and the URL as text", async () => {
    const entryUrl = "https://pli.test/raffle/ple-launch"
    await act(async () => {
      root!.render(<RaffleQrPanel entryUrl={entryUrl} />)
    })
    const img = container!.querySelector("img") as HTMLImageElement
    expect(img.src).toBe(`https://api.qrserver.com/v1/create-qr-code/?size=160x160&format=png&data=${encodeURIComponent(entryUrl)}`)
    expect(container!.textContent).toContain(entryUrl)
  })

  it("swaps to a locally rendered canvas when the remote image fails to load", async () => {
    const entryUrl = "https://pli.test/raffle/ple-launch"
    await act(async () => {
      root!.render(<RaffleQrPanel entryUrl={entryUrl} />)
    })
    const img = container!.querySelector("img") as HTMLImageElement

    await act(async () => {
      img.dispatchEvent(new Event("error"))
      await Promise.resolve()
    })

    expect(container!.querySelector("img")).toBeNull()
    const canvas = container!.querySelector('[data-testid="raffle-qr-canvas"]')
    expect(canvas).not.toBeNull()
    expect(toCanvasMock).toHaveBeenCalledWith(canvas, entryUrl, expect.objectContaining({ width: 160 }))
    // The URL stays visible as text even after the fallback renders.
    expect(container!.textContent).toContain(entryUrl)
  })

  it("resets to the remote image and clears the failure flag when the URL changes", async () => {
    const firstUrl = "https://pli.test/raffle/first"
    await act(async () => {
      root!.render(<RaffleQrPanel entryUrl={firstUrl} />)
    })
    const img = container!.querySelector("img") as HTMLImageElement
    await act(async () => {
      img.dispatchEvent(new Event("error"))
      await Promise.resolve()
    })
    expect(container!.querySelector('[data-testid="raffle-qr-canvas"]')).not.toBeNull()

    const secondUrl = "https://pli.test/raffle/second"
    await act(async () => {
      root!.render(<RaffleQrPanel entryUrl={secondUrl} />)
    })
    expect(container!.querySelector("img")).not.toBeNull()
    expect(container!.querySelector('[data-testid="raffle-qr-canvas"]')).toBeNull()
  })
})
