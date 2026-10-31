// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useNowTick } from "@/components/front/checkin/hooks/useNowTick"

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }

type Props = { onTick: (now: Date) => void; enabled?: boolean; immediate?: boolean }

function Probe({ onTick, enabled, immediate }: Props) {
  useNowTick(30_000, onTick, { enabled, immediate })
  return null
}

function mount(props: Props) {
  const container = document.createElement("div")
  const root = createRoot(container)
  act(() => root.render(<Probe {...props} />))
  return {
    rerender: (next: Props) => act(() => root.render(<Probe {...next} />)),
    unmount: () => act(() => root.unmount()),
  }
}

describe("useNowTick", () => {
  beforeEach(() => {
    testGlobal.IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it("ticks every interval and stops on unmount", () => {
    const onTick = vi.fn()
    const view = mount({ onTick })
    expect(onTick).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(60_000))
    expect(onTick).toHaveBeenCalledTimes(2)
    expect(onTick.mock.calls[0][0]).toBeInstanceOf(Date)
    view.unmount()
    act(() => vi.advanceTimersByTime(60_000))
    expect(onTick).toHaveBeenCalledTimes(2)
  })

  it("honors enabled and emits immediately when requested", () => {
    const onTick = vi.fn()
    const view = mount({ onTick, enabled: false, immediate: true })
    act(() => vi.advanceTimersByTime(30_000))
    expect(onTick).not.toHaveBeenCalled()
    view.rerender({ onTick, enabled: true, immediate: true })
    expect(onTick).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(30_000))
    expect(onTick).toHaveBeenCalledTimes(2)
    view.unmount()
  })
})
