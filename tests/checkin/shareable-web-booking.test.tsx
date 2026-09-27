import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BookingPageContent } from "@/components/front/booking/ShareableBookingPage"
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
        navigatingId={null}
        onSelect={() => undefined}
      />
    )

    expect(html).toContain(copy)
  })

  it("renders a future class and canonical booking action", () => {
    const html = renderToStaticMarkup(
      <BookingPageContent
        status="ready"
        occurrences={[readyOccurrence]}
        navigatingId={null}
        onSelect={() => undefined}
      />
    )

    expect(html).toContain("Salsa Timba")
    expect(html).toContain("2026-06-11")
    expect(html).toContain("7:00 PM")
    expect(html).toContain("60 min")
    expect(html).toContain(">Book<")
  })
})
