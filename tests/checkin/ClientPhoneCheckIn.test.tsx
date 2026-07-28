// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useClientPhoneCheckIn: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams({
    courseSlug: "salsa-night",
    date: "2026-06-11",
    time: "20:00",
  }),
}))

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: { firstName: "ana" } }),
}))

vi.mock("@/components/front/checkin/hooks/useClientPhoneCheckIn", () => ({
  useClientPhoneCheckIn: (...args: unknown[]) => mocks.useClientPhoneCheckIn(...args),
}))

import ClientPhoneCheckIn from "@/components/front/checkin/ClientPhoneCheckIn"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const activePackage = {
  id: "pkg_1",
  packageLabel: "Salsa 8-pack",
  isUnlimited: false,
  remainingCredits: 4,
}

const consecutiveOffer = {
  linkedCourseSlug: "bachata-night",
  linkedCourseTitle: "Bachata Night",
  linkedCourseTime: "21:10",
  dropInConsecutiveCents: 1500,
  packageHolderConsecutiveCents: 1000,
  discountPercent: 50,
}

const checkedInResult = (withOffer: boolean) => ({
  loading: false,
  error: null,
  result: {
    status: "checked_in",
    courseTitle: "Salsa Night",
    attendance: {
      id: "att_1",
      status: "checked_in",
      checkedInAt: "2026-06-11T19:00:00.000Z",
      courseSlug: "salsa-night",
      courseTitle: "Salsa Night",
      startsAt: "2026-06-11T20:00:00.000Z",
    },
    package: activePackage,
    consecutiveOffer: withOffer ? consecutiveOffer : null,
  },
})

describe("ClientPhoneCheckIn redirect countdown", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    mocks.push.mockReset()
    mocks.useClientPhoneCheckIn.mockReturnValue(checkedInResult(false))
  })

  afterEach(() => {
    act(() => root?.unmount())
    root = null
    container?.remove()
    container = null
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const renderCheckIn = async () => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root?.render(<ClientPhoneCheckIn />))
    return container
  }

  const clickButton = async (label: string) => {
    const button = Array.from(container?.querySelectorAll("button") ?? [])
      .find((item) => item.textContent?.trim() === label)
    expect(button, `button ${label}`).toBeTruthy()
    await act(async () => button?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
  }

  it("redirects success without an offer after exactly 10 seconds", async () => {
    await renderCheckIn()

    await act(async () => vi.advanceTimersByTime(9_999))
    expect(mocks.push).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTime(1))
    expect(mocks.push).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith("/client-profile")
  })

  it.each(["Pay with Cash", "Pay with Card"])(
    "does not redirect while the active offer is in the %s transition",
    async (paymentMethod) => {
      mocks.useClientPhoneCheckIn.mockReturnValue(checkedInResult(true))
      vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)))
      const view = await renderCheckIn()

      await act(async () => vi.advanceTimersByTime(15_000))
      expect(mocks.push).not.toHaveBeenCalled()
      expect(view.textContent).toContain("Add Bachata Night")

      await clickButton("Add Class")
      await act(async () => vi.advanceTimersByTime(15_000))
      expect(mocks.push).not.toHaveBeenCalled()

      await clickButton(paymentMethod)
      expect(view.textContent).toContain("Processing...")
      await act(async () => vi.advanceTimersByTime(15_000))
      expect(mocks.push).not.toHaveBeenCalled()
    }
  )

  it("starts one countdown after No Thanks dismisses the terminal offer", async () => {
    mocks.useClientPhoneCheckIn.mockReturnValue(checkedInResult(true))
    await renderCheckIn()

    await act(async () => vi.advanceTimersByTime(15_000))
    expect(mocks.push).not.toHaveBeenCalled()

    await clickButton("No Thanks")
    await act(async () => vi.advanceTimersByTime(9_999))
    expect(mocks.push).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTime(1))
    expect(mocks.push).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTime(20_000))
    expect(mocks.push).toHaveBeenCalledTimes(1)
  })
})
