import { describe, expect, it } from "vitest"
import { buildQrBookingUrl, buildQrSignInUrl, buildQrWelcomeUrl } from "@/lib/checkin/qr-booking-links"

describe("QR booking links", () => {
  it("builds a course booking URL for the scanned class", () => {
    expect(
      buildQrBookingUrl({
        courseSlug: "salsa-1",
        date: "2026-06-11",
        time: "19:30",
        durationMinutes: 60,
      })
    ).toBe("/courses/salsa-1?enroll=1&qrBooking=1&date=2026-06-11&time=19%3A30&durationMinutes=60")
  })

  it("uses the real catalog route when the QR is missing a course slug", () => {
    expect(buildQrBookingUrl({ courseSlug: "" })).toBe("/courses-library")
  })

  it("builds the /checkin Welcome-screen URL to return to on cancel", () => {
    expect(
      buildQrWelcomeUrl({
        courseSlug: "salsa-1",
        date: "2026-06-11",
        time: "19:30",
        durationMinutes: 60,
      })
    ).toBe("/checkin?courseSlug=salsa-1&date=2026-06-11&time=19%3A30&durationMinutes=60")
  })

  it("falls back to bare /checkin when no class context is available", () => {
    expect(buildQrWelcomeUrl({ courseSlug: "" })).toBe("/checkin")
  })

  it("keeps sign-in redirects scoped to check-in", () => {
    expect(buildQrSignInUrl("/checkin?courseSlug=salsa-1&date=2026-06-11&time=19%3A30&fromQr=1")).toBe(
      "/sign-in?redirect_url=%2Fcheckin%3FcourseSlug%3Dsalsa-1%26date%3D2026-06-11%26time%3D19%253A30%26fromQr%3D1"
    )
    expect(buildQrSignInUrl("/checkin?courseSlug=salsa-1")).toBe("/sign-in")
    expect(buildQrSignInUrl("/courses/salsa-1")).toBe("/sign-in")
  })
})
