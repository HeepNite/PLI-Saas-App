// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"
import { useConsecutiveOffer } from "@/components/front/courses/enroll/hooks/useConsecutiveOffer"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type HookParams = Parameters<typeof useConsecutiveOffer>[0]
type HookResult = ReturnType<typeof useConsecutiveOffer>

const offer: ConsecutiveOfferData = {
  linkedCourseSlug: "bachata",
  linkedCourseTitle: "Bachata",
  linkedCourseTime: "11:00",
  dropInConsecutiveCents: 1000,
  packageHolderConsecutiveCents: 500,
  regularDropInCents: 1500,
  discountPercent: 33,
  hasAttendedFirstClass: true,
}

const defaultParams = (override: Partial<HookParams> = {}): HookParams => ({
  courseSlug: "salsa",
  date: "2026-06-20",
  time: "10:00",
  consecutiveOffer: undefined,
  enabled: true,
  resetChoice: vi.fn(),
  resetAccepted: vi.fn(),
  resetAddedCents: vi.fn(),
  ...override,
})

describe("useConsecutiveOffer", () => {
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
      result = useConsecutiveOffer(params)
      return null
    }
    await act(async () => root!.render(<Harness />))
    return { params, getResult: () => result! }
  }

  it("fetches and resets previous consecutive choice after a successful response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: () => Promise.resolve(offer) } as Response)
    const params = defaultParams()
    const { getResult } = await mount(params)

    await act(async () => {})

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/checkin/terminal/consecutive-offer?courseSlug=salsa&date=2026-06-20&time=10%3A00",
      { signal: expect.any(AbortSignal) }
    )
    expect(getResult().fetchedOffer).toEqual(offer)
    expect(getResult().offerLoading).toBe(false)
    expect(params.resetAccepted).toHaveBeenCalledTimes(1)
    expect(params.resetAddedCents).toHaveBeenCalledTimes(1)
    expect(params.resetChoice).toHaveBeenCalledTimes(1)
  })

  it("does not fetch when a consecutive offer prop is already provided", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
    const params = defaultParams({ consecutiveOffer: offer })
    const { getResult } = await mount(params)

    await act(async () => {})

    expect(fetchMock).not.toHaveBeenCalled()
    expect(getResult().fetchedOffer).toBeNull()
    expect(getResult().offerLoading).toBe(false)
    expect(params.resetAccepted).not.toHaveBeenCalled()
    expect(params.resetAddedCents).not.toHaveBeenCalled()
    expect(params.resetChoice).not.toHaveBeenCalled()
  })

  it("does not fetch when disabled", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
    const params = defaultParams({ enabled: false })
    const { getResult } = await mount(params)

    await act(async () => {})

    expect(fetchMock).not.toHaveBeenCalled()
    expect(getResult().fetchedOffer).toBeNull()
    expect(getResult().offerLoading).toBe(false)
    expect(params.resetAccepted).not.toHaveBeenCalled()
    expect(params.resetAddedCents).not.toHaveBeenCalled()
    expect(params.resetChoice).not.toHaveBeenCalled()
  })

  it("resets prior choice when date or time is missing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
    const params = defaultParams({ time: "" })
    const { getResult } = await mount(params)

    await act(async () => {})

    expect(fetchMock).not.toHaveBeenCalled()
    expect(getResult().fetchedOffer).toBeNull()
    expect(getResult().offerLoading).toBe(false)
    expect(params.resetAccepted).toHaveBeenCalledTimes(1)
    expect(params.resetAddedCents).toHaveBeenCalledTimes(1)
    expect(params.resetChoice).toHaveBeenCalledTimes(1)
  })

  it("aborts the in-flight request on cleanup", async () => {
    let capturedSignal: AbortSignal | null = null
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      capturedSignal = init?.signal as AbortSignal
      return new Promise<Response>(() => {})
    })

    await mount()
    await act(async () => root?.unmount())
    root = null

    expect(capturedSignal).not.toBeNull()
    expect(capturedSignal!.aborted).toBe(true)
  })
})
