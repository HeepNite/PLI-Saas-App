// @vitest-environment jsdom

import React, { act } from "react"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const authState = vi.hoisted(() => ({ signedIn: false, imageUrl: null as string | null }))
const navigationState = vi.hoisted(() => ({
  pathname: "/special-salsa-class",
  searchParams: new URLSearchParams(),
  router: { replace: vi.fn() },
}))
vi.mock("@clerk/nextjs", () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => authState.signedIn ? children : null,
  SignedOut: ({ children }: { children: React.ReactNode }) => authState.signedIn ? null : children,
  SignInButton: ({ children }: { children: React.ReactNode }) => <div data-sign-in>{children}</div>,
  useUser: () => ({ user: authState.signedIn ? { imageUrl: authState.imageUrl, externalAccounts: [] } : null }),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useRouter: () => navigationState.router,
  useSearchParams: () => navigationState.searchParams,
}))
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }))
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key === "signIn" ? "Sign in" : key }) }))
vi.mock("@/components/front/ui/LanguageSwitcher", () => ({ default: () => <span>Language</span> }))
vi.mock("@/components/ui/DarkModeToggle", () => ({ default: () => <button>Theme</button> }))
vi.mock("@/components/front/ui/HeaderLogo", () => ({ default: () => <span>PLI Logo</span> }))
vi.mock("@/components/front/ui/SearchInput", () => ({ default: () => <input aria-label="Search courses" placeholder="Search courses..." /> }))
vi.mock("@/components/front/FooterQuote", () => ({ default: () => <footer>Footer</footer> }))

import Header from "@/components/front/Header"
import HeaderActions from "@/components/front/ui/HeaderActions"
import PublicLayout from "@/components/layouts/PublicLayout"
import NotificationBar, { formatHumanRemainingTime } from "@/components/front/ui/NotificationBar"
import {
  FloatingChromeProvider,
  useFloatingChromeHidden,
} from "@/components/front/ui/FloatingChromeVisibility"
import { SpecialSalsaClassLanding } from "@/components/front/special-salsa-class/SpecialSalsaClassLanding"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function FloatingChromeProbe() {
  return <output data-floating-chrome-state>{useFloatingChromeHidden() ? "hidden" : "visible"}</output>
}

describe("special salsa class public UI", () => {
  beforeEach(() => {
    authState.signedIn = false
    authState.imageUrl = null
    navigationState.pathname = "/special-salsa-class"
    navigationState.searchParams = new URLSearchParams()
    navigationState.router.replace.mockReset()
    vi.restoreAllMocks()
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("formats the special countdown with readable complete units", () => {
    const minuteMs = 60_000
    const hourMs = 60 * minuteMs
    const dayMs = 24 * hourMs

    expect(formatHumanRemainingTime((6 * dayMs) + (2 * hourMs) + (10 * minuteMs))).toBe("6 days 2 hours 10 min")
    expect(formatHumanRemainingTime(dayMs + hourMs + minuteMs)).toBe("1 day 1 hour 1 min")
    expect(formatHumanRemainingTime((2 * hourMs) + (5 * minuteMs))).toBe("2 hours 5 min")
    expect(formatHumanRemainingTime(7 * minuteMs)).toBe("7 min")
    expect(formatHumanRemainingTime(59_999)).toBe("Less than 1 min")
  })

  it("renders the isolated special header with mobile search, menu, and signed-out Log in action", () => {
    const html = renderToStaticMarkup(<Header variant="special-event" />)
    expect(html).toContain("PLI Logo")
    expect(html).toContain("Search courses...")
    expect(html).toContain("Open menu")
    expect(html).toContain("Log in")
    expect(html).toContain("data-sign-in")
    expect(html).not.toContain("My profile")
    expect(html).not.toContain("Profile avatar")
  })

  it("links an authenticated special action with the real avatar and exact My profile label", () => {
    authState.signedIn = true
    authState.imageUrl = "https://images.example.test/customer.jpg"
    const html = renderToStaticMarkup(<HeaderActions variant="special-event" />)
    expect(html).toContain('href="/client-profile"')
    expect(html).toContain("My profile")
    expect(html).toContain('src="https://images.example.test/customer.jpg"')
    expect(html).toContain('alt="Profile avatar"')
    expect(html).not.toContain("Log in")
    expect(html).not.toContain("My courses")
  })

  it("suppresses floating chrome only when PublicLayout explicitly requests it", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <FloatingChromeProvider>
        <PublicLayout headerVariant="special-event" floatingChrome="hidden">
          <p>Special event</p>
        </PublicLayout>
        <FloatingChromeProbe />
      </FloatingChromeProvider>,
    ))
    expect(container.querySelector("[data-floating-chrome-state]")?.textContent).toBe("hidden")

    await act(async () => root.render(
      <FloatingChromeProvider>
        <PublicLayout headerVariant="compact">
          <p>Default page</p>
        </PublicLayout>
        <FloatingChromeProbe />
      </FloatingChromeProvider>,
    ))
    expect(container.querySelector("[data-floating-chrome-state]")?.textContent).toBe("visible")

    await act(async () => root.unmount())
    container.remove()
  })

  it("scopes the fixed-deadline promotion announcement to the special route", () => {
    const deadlineMs = new Date("2026-08-30T14:00:00.000Z").getTime()
    const active = renderToStaticMarkup(
      <PublicLayout
        headerVariant="special-event"
        specialEventNowMs={deadlineMs - (((6 * 24 + 2) * 60 + 10) * 60_000)}
      >
        <p>Special event</p>
      </PublicLayout>,
    )
    const expired = renderToStaticMarkup(
      <PublicLayout headerVariant="special-event" specialEventNowMs={deadlineMs}>
        <p>Special event</p>
      </PublicLayout>,
    )
    const generic = renderToStaticMarkup(
      <PublicLayout headerVariant="compact">
        <p>Default page</p>
      </PublicLayout>,
    )

    expect(active).toContain("Get your spot for $20 — save 20% until Sunday at 10:00 AM.")
    expect(active).toContain('href="/special-salsa-class?reserve=1"')
    expect(active).toContain("Reserve now")
    expect(active).toContain("6 days 2 hours 10 min")
    expect(active).toContain("data-promotion-time")
    expect(active).not.toContain("data-countdown-icon")
    expect(active).not.toMatch(/\d{2}:\d{2}:\d{2}/)
    expect(expired).not.toContain("Get your spot for $20")
    expect(generic).toContain("notif_announcement")
    expect(generic).toContain('href="/courses/salsa-nocturno?enroll=1"')
    expect(generic).toContain("12:00:00")
    expect(generic).toContain("data-countdown-icon")
  })

  it("updates the readable special countdown only when its minute label changes", async () => {
    vi.useFakeTimers()
    const deadlineMs = new Date("2026-08-30T14:00:00.000Z").getTime()
    const initialNowMs = deadlineMs - ((2 * 60 + 10) * 60_000) - 30_000
    vi.setSystemTime(initialNowMs)
    const intervalSpy = vi.spyOn(window, "setInterval")
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <NotificationBar
        message="Special offer"
        deadlineMs={deadlineMs}
        initialNowMs={initialNowMs}
        countdownFormat="human"
        hideOnExpiry
      />,
    ))
    expect(container.querySelector("[data-promotion-time]")?.textContent).toBe("2 hours 10 min")
    expect(intervalSpy).not.toHaveBeenCalled()

    await act(async () => vi.advanceTimersByTime(29_999))
    expect(container.querySelector("[data-promotion-time]")?.textContent).toBe("2 hours 10 min")

    await act(async () => vi.advanceTimersByTime(2))
    expect(container.querySelector("[data-promotion-time]")?.textContent).toBe("2 hours 9 min")

    await act(async () => root.unmount())
    container.remove()
  })

  it("switches every visible special-class price at the exact deadline", async () => {
    vi.useFakeTimers()
    const deadlineMs = new Date("2026-08-30T14:00:00.000Z").getTime()
    vi.setSystemTime(new Date(deadlineMs - 1_000))
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <SpecialSalsaClassLanding remaining={5} initialNowMs={deadlineMs - 1_000} initialDialogOpen />,
    ))
    expect(container.querySelector("[data-hero-price]")?.textContent).toContain("$20")
    expect(document.querySelector('button[type="submit"]')?.textContent).toBe("Reserve for $20")

    await act(async () => vi.advanceTimersByTime(1_000))
    expect(container.querySelector("[data-hero-price]")?.textContent).toContain("$25")
    expect(document.querySelector('button[type="submit"]')?.textContent).toBe("Reserve for $25")

    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it("removes the live promotion announcement instead of showing a zero countdown", async () => {
    vi.useFakeTimers()
    const deadlineMs = new Date("2026-08-30T14:00:00.000Z").getTime()
    vi.setSystemTime(new Date(deadlineMs - 59_999))
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(
      <NotificationBar
        message="Get your spot for $20 — save 20% until Sunday at 10:00 AM."
        deadlineMs={deadlineMs}
        initialNowMs={deadlineMs - 59_999}
        countdownFormat="human"
        hideOnExpiry
      />,
    ))
    expect(container.textContent).toContain("Less than 1 min")
    expect(container.textContent).toContain("Get your spot for $20")
    expect(container.querySelector("[data-countdown-icon]")).toBeNull()

    await act(async () => vi.advanceTimersByTime(59_999))
    expect(container.textContent).not.toContain("Get your spot for $20")
    expect(container.textContent).not.toContain("Less than 1 min")

    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  it("renders fixed textual facts and the dialog trigger without an inline form", () => {
    const html = renderToStaticMarkup(<SpecialSalsaClassLanding remaining={40} />)
    expect(html).toContain("Salsa de Cali")
    expect(html).toContain('aria-label="Promotional video for Salsa de Cali"')
    expect(html).toContain("Sunday, August 30, 2026")
    expect(html).toContain(">4:00 PM<")
    expect(html).not.toContain("America/New_York")
    expect(html).toContain("60 minutes")
    expect(html).toContain("$25")
    expect(html).toContain("54 Coles St, Jersey City")
    expect(html).toContain('/Videos/special-salsa.mp4')
    expect(html).toContain('type="video/mp4"')
    expect(existsSync(join(process.cwd(), "public/Videos/special-salsa.mp4"))).toBe(true)
    expect(html).toContain("autoPlay")
    expect(html).toContain("muted")
    expect(html).toContain("loop")
    expect(html).toContain("playsInline")
    expect(html).not.toMatch(/<video\b[^>]*\bcontrols(?:=|[\s>])/)
    expect(html).toContain('data-hero-video-toggle')
    expect(html).toContain('aria-label="Play promotional video"')
    expect(html).not.toContain('name="name"')
    expect(html).not.toContain('name="phone"')
    expect(html).not.toContain('name="email"')
    expect(html).not.toContain("Reserve for $25")
    expect(html).toContain("Eligible refunds are handled manually by PLI staff")
    expect(html).toContain("data-special-hero")
    expect(html).toContain("data-hero-video")
    expect(html).toContain("data-hero-details")
    expect(html).toContain("lg:grid-cols-")
    expect(html).toContain("object-cover")
    expect(html).toContain('aria-controls="special-reservation-dialog"')
    expect(html).toContain('aria-haspopup="dialog"')
  })

  it("keeps the portrait hero video fully visible over an inaccessible blurred backdrop", () => {
    const container = document.createElement("div")
    container.innerHTML = renderToStaticMarkup(<SpecialSalsaClassLanding remaining={40} />)
    const mediaPanel = container.querySelector("[data-hero-media]") as HTMLElement
    const foreground = container.querySelector("[data-hero-video-foreground]") as HTMLVideoElement
    const backdrop = container.querySelector("[data-hero-video-backdrop]") as HTMLVideoElement

    expect(mediaPanel.className).toContain("h-[380px]")
    expect(mediaPanel.className).toContain("lg:h-auto")
    expect(mediaPanel.className).toContain("lg:min-h-[540px]")
    expect(foreground.getAttribute("aria-label")).toBe("Promotional video for Salsa de Cali")
    expect(foreground.className).toContain("object-contain")
    expect(foreground.autoplay).toBe(true)
    expect(foreground.hasAttribute("muted")).toBe(true)
    expect(foreground.loop).toBe(true)
    expect(foreground.playsInline).toBe(true)
    expect(backdrop.getAttribute("aria-hidden")).toBe("true")
    expect(backdrop.getAttribute("tabindex")).toBe("-1")
    expect(backdrop.autoplay).toBe(false)
    expect(backdrop.className).toContain("object-cover")
    expect(backdrop.className).toContain("blur-")
    expect(backdrop.querySelector('source[type="video/mp4"]')?.getAttribute("src")).toBe("/Videos/special-salsa.mp4")
  })

  it("keeps hero metadata and keyboard controls on one unobscured bottom overlay row", () => {
    const container = document.createElement("div")
    container.innerHTML = renderToStaticMarkup(<SpecialSalsaClassLanding remaining={40} />)
    const overlay = container.querySelector("[data-hero-video-overlay]") as HTMLElement
    const metadata = overlay.querySelector("[data-hero-video-metadata]") as HTMLElement
    const controls = overlay.querySelector("[data-hero-video-controls]") as HTMLElement
    const gradient = container.querySelector("[data-hero-video-gradient]") as HTMLElement

    expect(overlay.className).toContain("bottom-4")
    expect(overlay.className).toContain("items-center")
    expect(overlay.className).toContain("justify-between")
    expect(metadata.className).toContain("items-center")
    expect(controls.className).toContain("items-center")
    expect(controls.querySelectorAll("button")).toHaveLength(2)
    expect(gradient.className).toContain("h-1/4")
    expect(gradient.className).toContain("from-black/65")
    expect(gradient.className).not.toContain("h-2/5")
    expect(gradient.className).not.toContain("via-black/70")
  })

  it("provides an accessible play control when autoplay cannot start", async () => {
    const play = vi.fn().mockRejectedValue(new Error("Autoplay blocked"))
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play)
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(<SpecialSalsaClassLanding remaining={5} />))
    await act(async () => Promise.resolve())

    const toggle = container.querySelector('[data-hero-video-toggle]') as HTMLButtonElement
    expect(toggle.getAttribute("aria-label")).toBe("Play promotional video")
    expect(toggle.getAttribute("aria-pressed")).toBe("false")

    await act(async () => toggle.click())

    expect(play).toHaveBeenCalledTimes(2)
    expect(toggle.getAttribute("aria-label")).toBe("Play promotional video")

    await act(async () => root.unmount())
    container.remove()
  })

  it("keeps the decorative backdrop paused for reduced motion users", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play)
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }))
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(<SpecialSalsaClassLanding remaining={5} />))

    expect(play).not.toHaveBeenCalled()

    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it("starts and pauses the decorative backdrop with the foreground play control", async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play)
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(<SpecialSalsaClassLanding remaining={5} />))
    const foreground = container.querySelector("[data-hero-video-foreground]") as HTMLVideoElement
    Object.defineProperty(foreground, "paused", { configurable: true, value: false })
    await act(async () => foreground.dispatchEvent(new Event("play")))

    expect(play).toHaveBeenCalledTimes(2)

    const backdrop = container.querySelector("[data-hero-video-backdrop]") as HTMLVideoElement
    const pauseForeground = vi.fn()
    const pauseBackdrop = vi.fn()
    Object.defineProperty(foreground, "pause", { configurable: true, value: pauseForeground })
    Object.defineProperty(backdrop, "pause", { configurable: true, value: pauseBackdrop })
    await act(async () => (container.querySelector('[data-hero-video-toggle]') as HTMLButtonElement).click())

    expect(pauseForeground).toHaveBeenCalledTimes(1)
    expect(pauseBackdrop).toHaveBeenCalledTimes(1)

    await act(async () => root.unmount())
    container.remove()
  })

  it("lets a visitor deliberately enable and disable the hero video sound", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => root.render(<SpecialSalsaClassLanding remaining={5} />))

    const video = container.querySelector("[data-hero-video-foreground]") as HTMLVideoElement
    const soundToggle = container.querySelector('[data-hero-video-sound-toggle]') as HTMLButtonElement
    expect(video.muted).toBe(true)
    expect(soundToggle.getAttribute("aria-label")).toBe("Turn sound on for promotional video")
    expect(soundToggle.getAttribute("aria-pressed")).toBe("false")

    await act(async () => soundToggle.click())

    expect(video.muted).toBe(false)
    expect(soundToggle.getAttribute("aria-label")).toBe("Mute promotional video")
    expect(soundToggle.getAttribute("aria-pressed")).toBe("true")

    await act(async () => soundToggle.click())

    expect(video.muted).toBe(true)
    expect(soundToggle.getAttribute("aria-label")).toBe("Turn sound on for promotional video")
    expect(soundToggle.getAttribute("aria-pressed")).toBe("false")

    await act(async () => root.unmount())
    container.remove()
  })

  it("renders one joined course card with media and details and no external form", () => {
    const container = document.createElement("div")
    container.innerHTML = renderToStaticMarkup(<SpecialSalsaClassLanding remaining={40} />)
    const hero = container.querySelector("[data-special-hero]") as HTMLElement
    const panels = Array.from(hero.children).filter((child) => child.hasAttribute("data-hero-panel"))

    expect(hero.getAttribute("data-hero-card")).toBe("joined")
    expect(panels).toHaveLength(2)
    expect(panels[0]?.hasAttribute("data-hero-media")).toBe(true)
    expect(panels[1]?.hasAttribute("data-hero-details")).toBe(true)
    expect(hero.querySelector("form")).toBeNull()
    expect(container.querySelector("form, #reserve, #special-reservation-dialog")).toBeNull()
    expect(hero.textContent).toContain("SPECIAL EVENT")
    expect(hero.textContent).toContain("SALSA CLASS")
    expect(hero.textContent).toContain("60 min")
    expect(hero.textContent).toContain("40 spots")
    expect(hero.textContent).toContain("$25")
    expect(hero.textContent).not.toContain("View details")
    expect(hero.textContent).not.toMatch(/rating|reviews?|stars?|instructor|level|popular|open group/i)
  })

  it("orders responsive facts before the price and sole hero action", () => {
    const container = document.createElement("div")
    container.innerHTML = renderToStaticMarkup(<SpecialSalsaClassLanding remaining={40} />)
    const details = container.querySelector("[data-hero-details]") as HTMLElement
    const factsRow = details.querySelector("[data-event-facts-row]") as HTMLElement
    const purchaseRow = details.querySelector("[data-purchase-row]") as HTMLElement
    const facts = Array.from(factsRow.children)
    const price = purchaseRow.querySelector("[data-hero-price]") as HTMLElement
    const action = purchaseRow.querySelector("[data-hero-cta]") as HTMLButtonElement
    const calendar = factsRow.querySelector("[data-date-card]") as HTMLElement
    const mapCard = factsRow.querySelector("[data-map-thumbnail]") as HTMLElement
    const mapLink = mapCard.querySelector("[data-map-link]") as HTMLAnchorElement
    const mapImageFrame = mapLink.querySelector("[data-map-image]") as HTMLElement
    const mapImage = mapLink.querySelector("img") as HTMLImageElement
    const mapCaption = mapLink.querySelector("[data-map-caption]") as HTMLElement
    const attribution = mapCard.querySelector("[data-map-attribution]") as HTMLElement
    const attributionLink = attribution.querySelector("a") as HTMLAnchorElement

    expect(factsRow.getAttribute("data-layout-row")).toBe("responsive")
    expect(factsRow.className).toContain("grid")
    expect(factsRow.className).toContain("grid-cols-2")
    expect(facts).toHaveLength(2)
    expect(facts.every((fact) => fact.className.includes("h-[216px]"))).toBe(true)
    expect(facts.every((fact) => !fact.className.includes("aspect-square"))).toBe(true)
    expect(calendar.textContent).toContain("AUGUST 2026")
    expect(mapImage.getAttribute("src")).toBe("/images/salsa-de-cali-coles-st-map.png")
    expect(mapImage.getAttribute("alt")).toBe("Close color street map with one PLI location marker near 54 Coles St, Jersey City")
    expect(mapImage.className).toContain("brightness-[0.82]")
    expect(mapImageFrame.className).not.toContain("brightness-")
    expect(mapCaption.className).not.toContain("brightness-")
    expect(attribution.className).not.toContain("brightness-")
    expect(mapLink.href).toBe("https://maps.apple.com/?q=54%20Coles%20St%2C%20Jersey%20City%2C%20NJ%2007302")
    expect(mapLink.target).toBe("_blank")
    expect(mapLink.rel).toBe("noopener noreferrer")
    expect(mapLink.getAttribute("aria-label")).toContain("Open 54 Coles St, Jersey City in Apple Maps")
    expect(mapImageFrame.textContent).toBe("")
    expect(mapCaption.textContent).toContain("54 Coles St, Jersey City")
    expect(mapCaption.querySelector("svg")).toBeNull()
    expect(mapImageFrame.compareDocumentPosition(mapCaption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(mapCard.tagName).toBe("DIV")
    expect(mapCard.querySelectorAll("[data-map-attribution]")).toHaveLength(1)
    expect(details.querySelectorAll("[data-map-attribution]")).toHaveLength(1)
    expect(mapLink.querySelector("[data-map-attribution]")).toBeNull()
    expect(mapLink.textContent).not.toContain("OpenStreetMap")
    expect(attribution.textContent).toBe("Map data © OpenStreetMap contributors")
    expect(mapCaption.compareDocumentPosition(attribution) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(attribution.parentElement).toBe(mapCard)
    expect(Array.from(details.children)).not.toContain(attribution)
    expect(attribution.closest("a")).toBeNull()
    expect(mapCard.querySelectorAll("a")).toHaveLength(2)
    expect(attributionLink.href).toBe("https://www.openstreetmap.org/copyright")
    expect(attributionLink.target).toBe("_blank")
    expect(attributionLink.rel).toBe("noopener noreferrer")
    expect(mapLink.className).toContain("focus-visible:ring-2")
    expect(mapLink.className).not.toMatch(/(?:^|\s)focus:ring-/)
    expect(mapLink.className).not.toMatch(/(?:^|\s)ring-2(?:\s|$)/)
    expect(mapCaption.className).toContain("h-9")
    expect(mapCaption.className).toContain("justify-center")
    expect(mapCaption.className).toContain("text-center")
    expect(mapCaption.className).toContain("text-[13px]")
    expect(mapCaption.className).toContain("tracking-[-0.075em]")
    expect(mapCaption.className).toContain("whitespace-nowrap")
    expect(mapCaption.querySelector("span")?.className).toContain("whitespace-nowrap")
    expect(purchaseRow.getAttribute("data-layout-row")).toBe("responsive")
    expect(purchaseRow.className).toContain("flex")
    expect(purchaseRow.className).toContain("justify-between")
    expect(purchaseRow.className).toContain("w-full")
    expect(action.className).toContain("inline-flex")
    expect(action.className).not.toContain("flex-1")
    expect(action.className).not.toContain("w-full")
    expect(action.className).toContain("text-[15px]")
    expect(action.className).toContain("sm:text-base")
    expect(action.className).not.toContain("text-xs")
    expect(action.className).not.toContain("sm:text-sm")
    expect(action.textContent).toBe("Reserve here")
    expect(details.textContent).not.toContain("Reserve for $25")
    expect(factsRow.compareDocumentPosition(purchaseRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(price.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(details.querySelectorAll("[data-hero-cta]")).toHaveLength(1)
    expect(details.querySelector("[data-view-details-cta]")).toBeNull()
    expect(details.textContent).not.toContain("View details")
  })

  it("renders a dominant August 30 date representation without a conventional calendar grid", () => {
    const container = document.createElement("div")
    container.innerHTML = renderToStaticMarkup(<SpecialSalsaClassLanding remaining={40} />)
    const calendar = container.querySelector("[data-date-card]") as HTMLElement
    const visual = calendar.querySelector("[data-date-representation]") as HTMLElement
    const eventTime = calendar.querySelector("time") as HTMLTimeElement
    const month = visual.querySelector("[data-date-month]") as HTMLElement
    const day = visual.querySelector("[data-date-day]") as HTMLElement
    const weekday = visual.querySelector("[data-date-weekday]") as HTMLElement
    const timeLabel = visual.querySelector("[data-event-time]") as HTMLElement
    const supportingLine = calendar.querySelector("[data-date-supporting-line]") as HTMLTimeElement

    expect(visual.getAttribute("aria-hidden")).toBeNull()
    expect(month.getAttribute("aria-hidden")).toBe("true")
    expect(day.getAttribute("aria-hidden")).toBe("true")
    expect(month.textContent).toBe("AUGUST 2026")
    expect(month.className).toContain("text-[13px]")
    expect(month.className).toContain("text-[#FB7185]")
    expect(day.textContent).toBe("30")
    expect(day.className).toContain("text-[84px]")
    expect(day.className).toContain("font-black")
    expect(weekday.textContent).toBe("SUNDAY AT")
    expect(weekday.className).toContain("text-[#FB7185]")
    expect(timeLabel.textContent).toBe("4:00 PM")
    expect(timeLabel.className).toContain("text-[#F8FAFC]")
    expect(supportingLine.className).toContain("justify-center")
    expect(supportingLine.className).toContain("flex-col")
    expect(supportingLine.className).toContain("items-center")
    expect(supportingLine.className).toContain("text-[13px]")
    expect(Array.from(supportingLine.children).map((child) => child.textContent)).toEqual(["SUNDAY AT", "4:00 PM"])
    expect(supportingLine.querySelector('[aria-hidden="true"]')).toBeNull()
    expect(calendar.querySelector("[data-calendar-footer]")).toBeNull()
    expect(calendar.textContent).not.toContain("Salsa de Cali")
    expect(calendar.querySelector("[data-calendar-weekdays], [data-calendar-days], [data-calendar-cell], [data-calendar-day]")).toBeNull()
    expect(calendar.querySelector("button, [role='grid'], [role='gridcell']")).toBeNull()
    expect(calendar.className).not.toMatch(/cursor-pointer|hover:/)
    expect(eventTime.dateTime).toBe("2026-08-30T16:00:00-04:00")
    expect(eventTime.getAttribute("aria-label")).toBe("Sunday, August 30, 2026 at 4:00 PM")
    expect(eventTime.textContent).toContain("4:00 PM")
  })

  it("ships only the close Coles Street map as a valid 1200 by 700 PNG", () => {
    const mapPath = join(process.cwd(), "public/images/salsa-de-cali-coles-st-map.png")
    const obsoleteStreetMapPath = join(process.cwd(), "public/images/salsa-de-cali-street-map.png")
    const obsoleteV2MapPath = join(process.cwd(), "public/images/salsa-de-cali-map-v2.png")
    const obsoleteMapPath = join(process.cwd(), "public/images/salsa-de-cali-map.png")
    expect(existsSync(mapPath)).toBe(true)
    expect(existsSync(obsoleteStreetMapPath)).toBe(false)
    expect(existsSync(obsoleteV2MapPath)).toBe(false)
    expect(existsSync(obsoleteMapPath)).toBe(false)
    if (!existsSync(mapPath)) return

    const png = readFileSync(mapPath)
    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(700)
    expect(png.byteLength).toBeGreaterThan(10_000)
  })

  it("opens one named dialog, focuses the name field, and returns focus after Escape", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<SpecialSalsaClassLanding remaining={5} />))

    const action = container.querySelector('[data-hero-cta]') as HTMLButtonElement
    await act(async () => action.click())

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(dialog.id).toBe("special-reservation-dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(dialog.getAttribute("aria-labelledby")).toBe("special-reservation-title")
    expect(dialog.getAttribute("aria-describedby")).toBe("special-reservation-description")
    expect(document.getElementById("special-reservation-title")?.textContent).toBe("Reserve your spot")
    expect(document.getElementById("special-reservation-description")?.textContent).toContain("40 spots")
    expect(document.activeElement).toBe(document.querySelector('input[name="name"]'))
    expect(document.body.style.overflow).toBe("hidden")

    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(action)
    expect(document.body.style.overflow).toBe("")

    await act(async () => root.unmount())
    container.remove()
  })

  it("consumes a direct reservation query and returns focus to the actual opener", async () => {
    navigationState.searchParams = new URLSearchParams("campaign=social&reserve=1")
    const bannerOpener = document.createElement("a")
    bannerOpener.href = "/special-salsa-class?campaign=social&reserve=1"
    bannerOpener.textContent = "Reserve now"
    document.body.appendChild(bannerOpener)
    bannerOpener.focus()
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    try {
      await act(async () => root.render(
        <SpecialSalsaClassLanding remaining={5} initialDialogOpen />,
      ))

      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
      expect(document.activeElement).toBe(document.querySelector('input[name="name"]'))

      await act(async () => (document.querySelector("[data-reservation-close]") as HTMLButtonElement).click())

      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(navigationState.router.replace).toHaveBeenCalledWith(
        "/special-salsa-class?campaign=social",
        { scroll: false },
      )
      expect(document.activeElement).toBe(bannerOpener)

      await act(async () => root.render(
        <SpecialSalsaClassLanding remaining={5} initialDialogOpen={false} />,
      ))
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    } finally {
      await act(async () => root.unmount())
      container.remove()
      bannerOpener.remove()
    }
  })

  it("uses the landing CTA as the focus fallback for a direct URL without an opener", async () => {
    navigationState.searchParams = new URLSearchParams("reserve=1")
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    document.body.focus()

    try {
      await act(async () => root.render(
        <SpecialSalsaClassLanding remaining={5} initialDialogOpen />,
      ))
      await act(async () => (document.querySelector("[data-reservation-close]") as HTMLButtonElement).click())

      expect(navigationState.router.replace).toHaveBeenCalledWith("/special-salsa-class", { scroll: false })
      expect(document.activeElement).toBe(container.querySelector("[data-hero-cta]"))
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it("contains keyboard focus and preserves entered values across validation and reopen", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<SpecialSalsaClassLanding remaining={5} />))

    const action = container.querySelector('[data-hero-cta]') as HTMLButtonElement
    await act(async () => action.click())
    const nameInput = document.querySelector('input[name="name"]') as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
    await act(async () => {
      valueSetter?.call(nameInput, "Ada Lovelace")
      nameInput.dispatchEvent(new Event("input", { bubbles: true }))
    })

    const form = document.querySelector("form") as HTMLFormElement
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect((document.querySelector('input[name="name"]') as HTMLInputElement).value).toBe("Ada Lovelace")
    expect(document.activeElement).toBe(document.querySelector('input[name="phone"]'))

    const closeButton = document.querySelector('[data-reservation-close]') as HTMLButtonElement
    const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement
    submitButton.focus()
    await act(async () => submitButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })))
    expect(document.activeElement).toBe(closeButton)
    await act(async () => closeButton.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })))
    expect(document.activeElement).toBe(submitButton)

    await act(async () => closeButton.click())
    await act(async () => action.click())
    expect((document.querySelector('input[name="name"]') as HTMLInputElement).value).toBe("Ada Lovelace")

    await act(async () => root.unmount())
    container.remove()
  })

  it("renders an authoritative sold-out state without exposing reservation controls", () => {
    const html = renderToStaticMarkup(<SpecialSalsaClassLanding remaining={0} />)
    expect(html).toContain("Sold out")
    expect(html).toContain("disabled")
    expect(html).not.toContain('name="name"')
  })

  it("opens and focuses the cancellation outcome without losing the retry form", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(
      <SpecialSalsaClassLanding
        remaining={5}
        cancelledAttemptId="c6c05f53-2cc6-4a78-a35e-61daf6f13cb2"
      />,
    ))

    const cancellation = document.querySelector('[role="status"]') as HTMLElement
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(cancellation.textContent).toContain("Payment was not completed")
    expect(document.activeElement).toBe(cancellation)
    expect(document.querySelector('input[name="name"]')).not.toBeNull()

    await act(async () => root.unmount())
    container.remove()
  })

  it("focuses the first invalid field and announces field-safe validation", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<SpecialSalsaClassLanding remaining={5} />))

    await act(async () => (container.querySelector('[data-hero-cta]') as HTMLButtonElement).click())
    const form = document.querySelector("form") as HTMLFormElement
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
    await act(async () => Promise.resolve())

    expect(document.activeElement).toBe(document.querySelector('input[name="name"]'))
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Please enter your name")
    expect(document.querySelector('input[name="name"]')?.getAttribute("aria-invalid")).toBe("true")

    await act(async () => root.unmount())
    container.remove()
  })

  it("focuses the raced sold-out outcome and resets the expired attempt", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "CHECKOUT_EXPIRED", error: "Checkout expired." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "SOLD_OUT", error: "This class is sold out." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }))
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("attempt-1").mockReturnValueOnce("attempt-2") })
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<SpecialSalsaClassLanding remaining={1} />))

    await act(async () => (container.querySelector('[data-hero-cta]') as HTMLButtonElement).click())

    for (const [name, value] of [["name", "Ada Lovelace"], ["phone", "+12015550123"], ["email", "ada@example.com"]]) {
      const input = document.querySelector(`input[name="${name}"]`) as HTMLInputElement
      await act(async () => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
        valueSetter?.call(input, value)
        input.dispatchEvent(new Event("input", { bubbles: true }))
      })
    }
    const form = document.querySelector("form") as HTMLFormElement
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))

    const soldOut = document.querySelector('[role="status"][data-sold-out]')
    expect(document.activeElement).toBe(soldOut)
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain("attempt-1")
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain("attempt-2")

    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
})
