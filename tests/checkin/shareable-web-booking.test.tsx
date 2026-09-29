import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BookingBrandHeader, BookingPageContent } from "@/components/front/booking/ShareableBookingPage"
import { shouldHideFloatingChromeForPath } from "@/lib/checkin/use-hide-floating-chrome"
import type { ShareableBookingOccurrence } from "@/lib/checkin/shareable-booking"

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

  it("hides floating chrome only on the booking route", () => {
    expect(shouldHideFloatingChromeForPath("/booking")).toBe(true)
    expect(shouldHideFloatingChromeForPath("/booking/")).toBe(true)
    expect(shouldHideFloatingChromeForPath("/bookings")).toBe(false)
    expect(shouldHideFloatingChromeForPath("/")).toBe(false)
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
