/** @vitest-environment jsdom */
import React, { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const { push, redirect, useRouter } = vi.hoisted(() => ({
  push: vi.fn(),
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT") }),
  useRouter: vi.fn(() => ({ push })),
}))
vi.mock("next/navigation", () => ({ redirect, useRouter }))
vi.mock("@/components/front/booking/HeritageCampaignBooking", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/front/booking/HeritageCampaignBooking")>()),
  HeritageCampaignBanner: () => null,
  isHeritageCampaignAcquiringNow: () => false,
}))

import FridayBookingPage from "@/app/friday/page"
import MondayBookingPage from "@/app/monday/page"
import MondaySalsaBeginnerPage from "@/app/monday-salsa-beginner/page"
import SaturdayBookingPage from "@/app/saturday/page"
import SundayBookingPage from "@/app/sunday/page"
import ThursdayBookingPage from "@/app/thursday/page"
import TuesdayBookingPage from "@/app/tuesday/page"
import WednesdayBookingPage from "@/app/wednesday/page"
import ShareableBookingPage, { BookingBrandHeader, BookingPageContent } from "@/components/front/booking/ShareableBookingPage"
import { shouldHideFloatingChromeForPath } from "@/lib/checkin/use-hide-floating-chrome"
import { type ShareableBookingOccurrence } from "@/lib/checkin/shareable-booking"

const readyOccurrence: ShareableBookingOccurrence = {
  id: "salsa-timba:2026-06-11:19:00",
  slug: "salsa-timba",
  title: "Salsa Timba",
  category: null,
  level: "Beginner",
  durationMinutes: 60,
  date: "2026-06-11",
  monthKey: "2026-06",
  time: "19:00",
  classType: "salsa-cubana",
  coverImageUrl: "/class.jpg",
  instructorName: "PLI Team",
  bookingUrl: "/courses/salsa-timba?enroll=1&qrBooking=1&date=2026-06-11&time=19%3A00&durationMinutes=60",
}

describe("booking page brand and chrome", () => {
  it("renders centered PLI branding", () => {
    const html = renderToStaticMarkup(<BookingBrandHeader />)

    expect(html).toContain("%2Flogo%2Flogo-white.png")
    expect(html).toContain('alt="Palladium Latin Art"')
    expect(html).toContain("w-44")
    expect(html).toContain("text-center")
    expect(html).not.toContain(">BOOK<")
  })

  it("hides floating chrome on the catalog, every weekday, and legacy booking routes", () => {
    for (const path of [
      "/booking",
      "/monday",
      "/tuesday",
      "/wednesday",
      "/thursday",
      "/friday",
      "/saturday",
      "/sunday",
      "/monday-salsa-beginner",
    ]) {
      expect(shouldHideFloatingChromeForPath(path)).toBe(true)
      expect(shouldHideFloatingChromeForPath(`${path}/`)).toBe(true)
    }
    expect(shouldHideFloatingChromeForPath("/bookings")).toBe(false)
    expect(shouldHideFloatingChromeForPath("/")).toBe(false)
  })

  it("redirects the retired Monday Salsa Beginner route to Monday", () => {
    expect(() => MondaySalsaBeginnerPage()).toThrow("NEXT_REDIRECT")
    expect(redirect).toHaveBeenCalledWith("/monday")
  })

  it.each([
    ["/monday", MondayBookingPage, 1],
    ["/tuesday", TuesdayBookingPage, 2],
    ["/wednesday", WednesdayBookingPage, 3],
    ["/thursday", ThursdayBookingPage, 4],
    ["/friday", FridayBookingPage, 5],
    ["/saturday", SaturdayBookingPage, 6],
    ["/sunday", SundayBookingPage, 0],
  ])("renders %s through the shared weekday booking page", (_path, BookingPage, weekday) => {
    const page = BookingPage()

    expect(page.type).toBe(ShareableBookingPage)
    expect(page.props).toEqual({ weekday })
  })
})

describe("weekday booking page", () => {
  it("renders every supplied weekday occurrence without discovery controls", () => {
    const html = renderToStaticMarkup(
      <BookingPageContent
        status="ready"
        occurrences={[
          { ...readyOccurrence, id: "monday-salsa", date: "2026-06-08", title: "Monday Salsa" },
          { ...readyOccurrence, id: "monday-bachata", date: "2026-06-08", title: "Monday Bachata" },
        ]}
        selectedMonth="2026-05"
        selectedClassType="other"
        searchQuery="does-not-match"
        onMonthChange={() => undefined}
        onClassTypeChange={() => undefined}
        onSearchQueryChange={() => undefined}
        navigatingId={null}
        onSelect={() => undefined}
        weekdayName="Monday"
      />
    )

    expect(html).toContain("Monday Salsa")
    expect(html).toContain("Monday Bachata")
    expect(html).not.toContain("Search classes")
    expect(html).not.toContain("Filter by month")
  })

  it("renders a deterministic empty state for a weekday", () => {
    const html = renderToStaticMarkup(
      <BookingPageContent
        status="empty"
        occurrences={[]}
        selectedMonth="all"
        selectedClassType="all"
        searchQuery=""
        onMonthChange={() => undefined}
        onClassTypeChange={() => undefined}
        onSearchQueryChange={() => undefined}
        navigatingId={null}
        onSelect={() => undefined}
        weekdayName="Monday"
      />
    )

    expect(html).toContain("No Monday classes are currently scheduled")
  })

  it("preserves the canonical public booking handoff for a weekday selection", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-07T16:00:00-04:00"))
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    push.mockClear()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        courses: [{
          slug: "monday-salsa",
          title: "Monday Salsa",
          category: null,
          description: "Class",
          level: "Beginner",
          duration: "60 min",
          schedule: { day: "Mon", time: "19:00", starts: "Ongoing", availableWeekdays: [0], availableTimes: ["19:00"] },
          location: { address: "PLI" },
          instructors: [{ name: "PLI Team" }],
          heroMedia: { image: "/class.jpg" },
          enrollment: { services: [], packages: [] },
          scheduleRules: { rules: [{ weekday: 1, times: ["19:00"] }] },
        }],
      }),
    }))
    const container = document.createElement("div")
    const root = createRoot(container)

    await act(async () => {
      root.render(<ShareableBookingPage weekday={1} />)
      await Promise.resolve()
      await Promise.resolve()
    })
    const bookButton = container.querySelector<HTMLButtonElement>('[aria-label="Book Monday Salsa on 2026-06-08"]')
    expect(bookButton).not.toBeNull()

    await act(async () => bookButton?.click())
    const handoff = new URL(push.mock.calls[0]?.[0], "https://pli.test")
    expect(handoff.pathname).toBe("/courses/monday-salsa")
    expect(Object.fromEntries(handoff.searchParams)).toMatchObject({
      enroll: "1",
      qrBooking: "1",
      date: "2026-06-08",
      time: "19:00",
      durationMinutes: "60",
      bookingSource: "public_booking",
    })

    root.unmount()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
})

describe("BookingPageContent", () => {
  it.each([
    ["loading", "Loading upcoming classes"],
    ["empty", "No upcoming classes are available"],
    ["error", "We couldn’t load upcoming classes"],
  ] as const)("renders the %s state", (status, copy) => {
    const html = renderToStaticMarkup(
      <BookingPageContent
        status={status}
        occurrences={[]}
        selectedMonth="2026-06"
        selectedClassType="all"
        searchQuery=""
        onMonthChange={() => undefined}
        onClassTypeChange={() => undefined}
        onSearchQueryChange={() => undefined}
        navigatingId={null}
        onSelect={() => undefined}
      />
    )

    expect(html).toContain(copy)
  })

  it("renders the search/filter toolbar, date groups, and circular BOOK actions", () => {
    const html = renderToStaticMarkup(
      <BookingPageContent
        status="ready"
        occurrences={[readyOccurrence]}
        selectedMonth="2026-06"
        selectedClassType="all"
        searchQuery=""
        onMonthChange={() => undefined}
        onClassTypeChange={() => undefined}
        onSearchQueryChange={() => undefined}
        navigatingId={null}
        onSelect={() => undefined}
      />
    )

    expect(html).toContain('aria-label="Search classes"')
    expect(html).toContain("grid-cols-[2fr_1fr_1fr]")
    expect(html).toContain("grid-cols-[48px_minmax(0,1fr)_52px]")
    expect(html).toContain('aria-label="Filter by month"')
    expect(html).toContain('aria-label="Filter by class type"')
    expect(html).toContain(">Jun<")
    expect(html).not.toContain("Jun 26")
    expect(html).toContain("Salsa Timba")
    expect(html).toContain("7:00 PM · 60 min")
    expect(html).toContain("PLI Team")
    expect(html.indexOf("Salsa Timba")).toBeLessThan(html.indexOf("7:00 PM · 60 min"))
    expect(html.indexOf("7:00 PM · 60 min")).toBeLessThan(html.indexOf("PLI Team"))
    expect(html).toContain("rounded-full")
    expect(html).toContain(">BOOK<")
  })

  it("cycles decorative flags across the visible filtered rows", () => {
    const occurrences: ShareableBookingOccurrence[] = Array.from({ length: 9 }, (_, index) => ({
      ...readyOccurrence,
      id: `course-${index}:2026-06-11:19:00`,
      slug: `course-${index}`,
      title: `Course ${index}`,
      classType: index === 0 || index === 8 ? "bachata" : "salsa-cubana",
    }))
    const html = renderToStaticMarkup(
      <BookingPageContent
        status="ready"
        occurrences={occurrences}
        selectedMonth="2026-06"
        selectedClassType="bachata"
        searchQuery=""
        onMonthChange={() => undefined}
        onClassTypeChange={() => undefined}
        onSearchQueryChange={() => undefined}
        navigatingId={null}
        onSelect={() => undefined}
      />
    )

    expect(html).toContain("🇦🇷")
    expect(html).toContain("🇲🇽")
  })

  it("keeps discovery controls visible when no classes match", () => {
    const html = renderToStaticMarkup(
      <BookingPageContent
        status="ready"
        occurrences={[readyOccurrence]}
        selectedMonth="2026-06"
        selectedClassType="bachata"
        searchQuery="salsa"
        onMonthChange={() => undefined}
        onClassTypeChange={() => undefined}
        onSearchQueryChange={() => undefined}
        navigatingId={null}
        onSelect={() => undefined}
      />
    )

    expect(html).toContain("No matching classes")
    expect(html).toContain('aria-label="Search classes"')
    expect(html).toContain('aria-label="Filter by month"')
  })
})
