// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useConsecutiveOfferState } from "@/components/front/checkin/hooks/useConsecutiveOfferState"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type HookParams = Parameters<typeof useConsecutiveOfferState>[0]
type HookResult = ReturnType<typeof useConsecutiveOfferState>

const offer = {
  linkedCourseSlug: "bachata",
  linkedCourseTitle: "Bachata",
  dropInConsecutiveCents: 1000,
  packageHolderConsecutiveCents: 500,
  regularDropInCents: 1500,
  discountPercent: 33,
  hasAttendedFirstClass: true,
}

const defaultParams = (override: Partial<HookParams> = {}): HookParams => ({
  isKioskTerminalFlow: true,
  activeCourseSlug: "salsa",
  activeTime: "20:00",
  requestTerminalOffer: vi.fn().mockResolvedValue({ res: { ok: true } as Response, data: offer }),
  ...override,
})

describe("useConsecutiveOfferState", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let result: HookResult | null = null

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    result = null
    vi.restoreAllMocks()
  })

  const mount = async (params = defaultParams()) => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    function Harness() {
      result = useConsecutiveOfferState(params)
      return null
    }
    await act(async () => root!.render(<Harness />))
    return { params, getResult: () => result! }
  }

  it("fetches the early terminal consecutive offer and settles", async () => {
    const { params, getResult } = await mount()

    await act(async () => {})

    expect(params.requestTerminalOffer).toHaveBeenCalledWith({
      courseSlug: "salsa",
      time: "20:00",
      signal: expect.any(AbortSignal),
    })
    expect(getResult().consecutiveOffer).toEqual(offer)
    expect(getResult().consecutiveOfferSettled).toBe(true)
  })

  it("settles without an offer when the bounded request rejects", async () => {
    const { getResult } = await mount(defaultParams({
      requestTerminalOffer: vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" })),
    }))

    await act(async () => {})

    expect(getResult().consecutiveOffer).toBeNull()
    expect(getResult().consecutiveOfferSettled).toBe(true)
  })

  it("settles without fetching outside kiosk terminal flow", async () => {
    const { params, getResult } = await mount(defaultParams({ isKioskTerminalFlow: false }))

    await act(async () => {})

    expect(params.requestTerminalOffer).not.toHaveBeenCalled()
    expect(getResult().consecutiveOfferSettled).toBe(true)
  })

  it("settles without fetching when the active course is missing", async () => {
    const { params, getResult } = await mount(defaultParams({ activeCourseSlug: "" }))

    await act(async () => {})

    expect(params.requestTerminalOffer).not.toHaveBeenCalled()
    expect(getResult().consecutiveOfferSettled).toBe(true)
  })

  it("exposes refreshConsecutiveOffer to re-run the early fetch", async () => {
    const { params, getResult } = await mount()
    await act(async () => {})

    await act(async () => getResult().refreshConsecutiveOffer())
    await act(async () => {})

    expect(params.requestTerminalOffer).toHaveBeenCalledTimes(2)
  })

  it("aborts the in-flight request on unmount", async () => {
    let capturedSignal: AbortSignal | null = null
    const requestTerminalOffer: HookParams["requestTerminalOffer"] = vi.fn(({ signal }) => {
      capturedSignal = signal
      return new Promise<{ res: Response; data: unknown }>(() => {})
    })
    await mount(defaultParams({ requestTerminalOffer }))

    await act(async () => root?.unmount())
    root = null

    expect(capturedSignal).not.toBeNull()
    expect(capturedSignal!.aborted).toBe(true)
  })
})
