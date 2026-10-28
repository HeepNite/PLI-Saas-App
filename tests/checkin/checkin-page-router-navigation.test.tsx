// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  linkHrefs: [] as string[],
  searchParams: new URLSearchParams(),
}))

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}))

vi.mock("next/link", async () => {
  const React = await import("react")
  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => {
      mocks.linkHrefs.push(href)
      return React.createElement("a", { href, ...props }, children)
    },
  }
})

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement("img", props),
}))

import CheckInPageRouter from "@/components/front/checkin/CheckInPageRouter"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe("CheckInPageRouter QR navigation", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(() => {
    mocks.push.mockReset()
    mocks.linkHrefs.length = 0
    mocks.searchParams = new URLSearchParams({
      courseSlug: "salsa-1",
      date: "2026-06-11",
      time: "19:30",
      durationMinutes: "60",
      kioskQrCashGrant: "signed.grant",
      enroll: "1",
      step: "2",
    })
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
    vi.restoreAllMocks()
  })

  const renderRouter = async () => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root!.render(<CheckInPageRouter />))
  }

  it("opens the selected QR class with internal navigation and preserves every query parameter", async () => {
    await renderRouter()

    const newCustomerButton = Array.from(container!.querySelectorAll("button"))
      .find((button) => button.textContent === "I'm new")
    await act(async () => newCustomerButton?.click())

    expect(mocks.push).toHaveBeenCalledWith(
      "/courses/salsa-1?courseSlug=salsa-1&date=2026-06-11&time=19%3A30&durationMinutes=60&kioskQrCashGrant=signed.grant&enroll=1&step=2&qrBooking=1"
    )
  })

  it("opens QR sign-in with a client Link and the complete check-in return URL", async () => {
    await renderRouter()

    expect(mocks.linkHrefs).toEqual([
      "/sign-in?redirect_url=%2Fcheckin%3FcourseSlug%3Dsalsa-1%26date%3D2026-06-11%26time%3D19%253A30%26durationMinutes%3D60%26kioskQrCashGrant%3Dsigned.grant%26enroll%3D1%26step%3D2",
    ])
  })
})
