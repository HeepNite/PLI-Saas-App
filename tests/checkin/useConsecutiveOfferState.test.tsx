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
  activeDate: "2026-08-07",
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
    function Harness({ hookParams }: { hookParams: HookParams }) {
      result = useConsecutiveOfferState(hookParams)
      return null
    }
    await act(async () => root!.render(<Harness hookParams={params} />))
    return {
      params,
      getResult: () => result!,
      rerender: async (nextParams: HookParams) => {
        await act(async () => root!.render(<Harness hookParams={nextParams} />))
      },
    }
  }

  it("fetches the early terminal consecutive offer and settles", async () => {
    const { params, getResult } = await mount()

    await act(async () => {})

    expect(params.requestTerminalOffer).toHaveBeenCalledWith({
      courseSlug: "salsa",
      date: "2026-08-07",
      time: "20:00",
      signal: expect.any(AbortSignal),
    })
    expect(getResult().consecutiveOffer).toEqual(offer)
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

  it("only settles and publishes the offer for the current course, date, and time context", async () => {
    type RequestResult = Awaited<ReturnType<NonNullable<HookParams["requestTerminalOffer"]>>>
    const requests: Array<{
      signal: AbortSignal
      resolve: (value: RequestResult) => void
    }> = []
    const requestTerminalOffer: HookParams["requestTerminalOffer"] = vi.fn(({ signal }) =>
      new Promise<RequestResult>((resolve) => requests.push({ signal: signal!, resolve }))
    )
    const firstParams = defaultParams({ requestTerminalOffer })
    const { getResult, rerender } = await mount(firstParams)

    const secondOffer = { ...offer, linkedCourseSlug: "rueda", linkedCourseTitle: "Rueda" }
    await rerender(defaultParams({
      activeDate: "2026-08-14",
      requestTerminalOffer,
    }))

    expect(requests).toHaveLength(2)
    expect(requests[0].signal.aborted).toBe(true)
    expect(getResult().consecutiveOffer).toBeNull()
    expect(getResult().consecutiveOfferSettled).toBe(false)

    await act(async () => {
      requests[0].resolve({ res: { ok: true } as Response, data: offer })
      await Promise.resolve()
    })

    expect(getResult().consecutiveOffer).toBeNull()
    expect(getResult().consecutiveOfferSettled).toBe(false)

    await act(async () => {
      requests[1].resolve({ res: { ok: true } as Response, data: secondOffer })
      await Promise.resolve()
    })

    expect(requestTerminalOffer).toHaveBeenLastCalledWith({
      courseSlug: "salsa",
      date: "2026-08-14",
      time: "20:00",
      signal: expect.any(AbortSignal),
    })
    expect(getResult().consecutiveOffer).toEqual(secondOffer)
    expect(getResult().consecutiveOfferSettled).toBe(true)
  })
})
