// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  lenisConstructed: vi.fn(),
  raf: vi.fn(),
  destroy: vi.fn(),
}))

vi.mock("lenis", () => ({
  default: class {
    constructor(options: unknown) {
      mocks.lenisConstructed(options)
    }
    raf = mocks.raf
    destroy = mocks.destroy
  },
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}))

import SmoothScroll from "@/components/front/ui/SmoothScroll"

// Lenis only smooths mouse-wheel scrolling, but its requestAnimationFrame loop
// forces a frame on every vsync. On touch devices (the kiosk tablet) that loop
// was the top CPU cost (docs/ops/kiosk-performance-report.md).
const setMedia = (matches: Record<string, boolean>) => {
  window.matchMedia = ((query: string) => ({
    matches: matches[query] ?? false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

describe("SmoothScroll", () => {
  let container: HTMLDivElement
  let root: Root
  const rafSpy = vi.fn(() => 1)

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    mocks.lenisConstructed.mockReset()
    rafSpy.mockClear()
    window.requestAnimationFrame = rafSpy as unknown as typeof window.requestAnimationFrame
    window.cancelAnimationFrame = vi.fn()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const render = () => act(() => root.render(<SmoothScroll />))

  it("starts Lenis on wide screens with a mouse", () => {
    setMedia({ "(min-width: 1024px)": true, "(hover: hover) and (pointer: fine)": true })
    render()
    expect(mocks.lenisConstructed).toHaveBeenCalledTimes(1)
    expect(rafSpy).toHaveBeenCalled()
  })

  it("does not start Lenis or a frame loop on wide touch screens", () => {
    setMedia({ "(min-width: 1024px)": true, "(hover: hover) and (pointer: fine)": false })
    render()
    expect(mocks.lenisConstructed).not.toHaveBeenCalled()
    expect(rafSpy).not.toHaveBeenCalled()
  })

  it("still skips narrow screens and reduced motion", () => {
    setMedia({ "(min-width: 1024px)": false, "(hover: hover) and (pointer: fine)": true })
    render()
    setMedia({
      "(min-width: 1024px)": true,
      "(hover: hover) and (pointer: fine)": true,
      "(prefers-reduced-motion: reduce)": true,
    })
    act(() => root.unmount())
    root = createRoot(container)
    render()
    expect(mocks.lenisConstructed).not.toHaveBeenCalled()
  })
})
