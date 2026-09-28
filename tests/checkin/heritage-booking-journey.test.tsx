// @vitest-environment jsdom

import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  HeritageBookButton,
  HeritageCampaignBanner,
  HeritageCountryDialog,
  countryCodeToFlag,
  getDecorativeBookingFlag,
  isHeritageCampaignAcquiringNow,
} from "@/components/front/booking/HeritageCampaignBooking"
import type { ShareableBookingOccurrence } from "@/lib/checkin/shareable-booking"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const occurrence: ShareableBookingOccurrence = {
  id: "salsa-timba:2026-10-11:19:00",
  slug: "salsa-timba",
  title: "Salsa Timba",
  category: null,
  level: "Beginner",
  date: "2026-10-11",
  monthKey: "2026-10",
  time: "19:00",
  durationMinutes: 60,
  classType: "salsa-cubana",
  coverImageUrl: "/class.jpg",
  instructorName: "PLI Team",
  bookingUrl: "/courses/salsa-timba?enroll=1&qrBooking=1&date=2026-10-11&time=19%3A00",
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ""
})

describe("Heritage campaign booking presentation", () => {
  it("uses deterministic decorative flags without selecting the visitor's country", () => {
    expect(getDecorativeBookingFlag(occurrence.id)).toBe(getDecorativeBookingFlag(occurrence.id))
    expect(countryCodeToFlag("MX")).toBe("🇲🇽")

    const html = renderToStaticMarkup(
      <HeritageBookButton occurrence={occurrence} busy={false} disabled={false} onSelect={() => undefined} />,
    )
    expect(html).toContain("BOOK")
    expect(html).toContain("rotateY(180deg)")
    expect(html).toContain("Book Salsa Timba")
  })

  it("renders the red PLI campaign message and identifies photographed pins as examples", () => {
    const html = renderToStaticMarkup(<HeritageCampaignBanner />)
    expect(html).toContain("¡Feliz Mes de la Herencia Latina!")
    expect(html).toContain("Your country. Your pin. Your community.")
    expect(html).toContain("Argentina and Mexico country pins shown as examples")
    expect(html).toContain("bg-[#b61616]")
  })

  it("lets the visitor search and explicitly select a country before continuing", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    const onConfirm = vi.fn()
    await act(async () => root.render(
      <HeritageCountryDialog occurrence={occurrence} onCancel={() => undefined} onConfirm={onConfirm} />,
    ))

    const search = container.querySelector('input[aria-label="Search countries"]') as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(search, "Mexico")
      search.dispatchEvent(new Event("input", { bubbles: true }))
    })
    const mexico = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent?.includes("Mexico"))
    expect(mexico).toBeDefined()
    await act(async () => mexico?.click())
    const continueButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("CONTINUE TO BOOK"))
    await act(async () => continueButton?.click())

    expect(onConfirm).toHaveBeenCalledWith("MX")
    expect(container.textContent).toContain("flag on the class button is decorative")
    await act(async () => root.unmount())
  })

  it("opens the country step only during the configured New York acquisition window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-15T16:00:00.000Z"))
    expect(isHeritageCampaignAcquiringNow()).toBe(true)
    vi.setSystemTime(new Date("2026-11-01T16:00:00.000Z"))
    expect(isHeritageCampaignAcquiringNow()).toBe(false)
  })
})
