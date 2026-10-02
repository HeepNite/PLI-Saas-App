// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import { join } from "node:path"
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  HeritageBookButton,
  HeritageCampaignBanner,
  HeritageCampaignPromoDialog,
  HeritageCountryDialog,
  countryCodeToFlag,
  getDecorativeBookingFlag,
  isHeritageCampaignAcquiringNow,
} from "@/components/front/booking/HeritageCampaignBooking"
import type { ShareableBookingOccurrence } from "@/lib/checkin/shareable-booking"

const enrollModalSource = readFileSync(
  join(process.cwd(), "components/front/courses/EnrollModal.tsx"),
  "utf8",
)

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
  it("cycles visible rows through varied deterministic flag pins without selecting the visitor's country", () => {
    const firstCycle = Array.from({ length: 8 }, (_, index) => getDecorativeBookingFlag(occurrence.id, index))
    expect(new Set(firstCycle).size).toBe(8)
    expect(getDecorativeBookingFlag(occurrence.id)).toBe(getDecorativeBookingFlag(occurrence.id))
    expect(countryCodeToFlag("MX")).toBe("🇲🇽")

    const html = renderToStaticMarkup(
      <HeritageBookButton occurrence={occurrence} decorativeIndex={1} busy={false} disabled={false} onSelect={() => undefined} />,
    )
    expect(html).toContain("🇲🇽")
    expect(html).toContain("BOOK")
    expect(html).toContain("rotateY(180deg)")
    expect(html).toContain("Book Salsa Timba")
    expect(html).toContain("radial-gradient")
  })

  it("keeps the booking header compact with real pin cutouts and an accessible light sweep", () => {
    const html = renderToStaticMarkup(<HeritageCampaignBanner />)
    expect(html).toContain("¡Feliz Mes de la Herencia Latina!")
    expect(html).toContain("Your country. Your community.")
    expect(html).toContain("%2Fcampaigns%2Fmexico-pin.png")
    expect(html).toContain("%2Fcampaigns%2Fargentina-pin.png")
    expect(html).toContain("heritage-light-sweep")
    expect(html).toContain("motion-reduce:hidden")
    expect(html).not.toContain("Book online")
  })

  it("uses a concise flag collage in the timed promotion instead of the pin photograph", () => {
    const html = renderToStaticMarkup(<HeritageCampaignPromoDialog onClose={() => undefined} />)
    expect(html).toContain("Hispanic American and Spanish flags")
    expect(html).toContain("Book online. Choose your country. Pick up your pin.")
    expect(html).not.toContain("$15 Sunday &amp; Monday classes after pickup.")
    expect(html).not.toContain("heritage-country-pins")
    expect(html).not.toContain("photograph")
  })

  it("keeps the active booking form visible behind a translucent phone verification overlay", () => {
    expect(enrollModalSource).toContain('verificationState === "sms_pending"')
    expect(enrollModalSource).toContain('activateSessionOnSuccess={isQrMobileCompactFlow}')
    expect(enrollModalSource).toContain('bg-[#09070d]/55 backdrop-blur-[2px]')
    expect(enrollModalSource).not.toContain("<HeritageVerificationBackdrop")
    expect(enrollModalSource).not.toContain('data-heritage-verification-context="true"')
  })

  it("uses explicit existing-phone copy before account access", () => {
    expect(enrollModalSource).toContain('"This phone number already exists"')
  })

  it("lets the visitor search and explicitly select a country before continuing", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    const onConfirm = vi.fn()
    await act(async () => root.render(
      <HeritageCountryDialog occurrence={occurrence} onCancel={() => undefined} onConfirm={onConfirm} />,
    ))

    expect(document.documentElement.style.overflow).toBe("hidden")
    expect(document.body.style.overflow).toBe("hidden")
    expect(document.body.style.position).toBe("fixed")
    const countryList = container.querySelector('[role="listbox"]') as HTMLDivElement
    await act(async () => countryList.dispatchEvent(new Event("scroll", { bubbles: true })))
    expect(countryList.className).toContain("heritage-country-scroll--active")

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
    expect(document.documentElement.style.overflow).toBe("")
    expect(document.body.style.overflow).toBe("")
    expect(document.body.style.position).toBe("")
  })

  it("opens the country step only during the configured New York acquisition window", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-15T16:00:00.000Z"))
    expect(isHeritageCampaignAcquiringNow()).toBe(true)
    vi.setSystemTime(new Date("2026-11-01T16:00:00.000Z"))
    expect(isHeritageCampaignAcquiringNow()).toBe(false)
  })
})
