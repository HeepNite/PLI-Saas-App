import { resolveSafeQrRedirect } from "@/lib/checkin/qr-auth-resume"

export type QrBookingLinkParams = {
  courseSlug: string
  date?: string
  time?: string
  durationMinutes?: number
}

const FALLBACK_COURSE_CATALOG_URL = "/courses-library"

export function buildQrBookingUrl({
  courseSlug,
  date,
  time,
  durationMinutes,
}: QrBookingLinkParams) {
  const slug = courseSlug.trim()
  if (!slug) return FALLBACK_COURSE_CATALOG_URL

  const params = new URLSearchParams({ enroll: "1", qrBooking: "1" })
  if (date) params.set("date", date)
  if (time) params.set("time", time)
  if (typeof durationMinutes === "number" && Number.isFinite(durationMinutes)) {
    params.set("durationMinutes", String(Math.round(durationMinutes)))
  }

  return `/courses/${encodeURIComponent(slug)}?${params.toString()}`
}

/**
 * Builds the `/checkin` Welcome-screen URL (the "I'm new / I have an account"
 * banner) a scanned-QR customer starts from. Used when cancelling the booking
 * modal to return to that initial choice instead of stranding on the booking
 * overlay. Deliberately omits kiosk params so CheckInPageRouter renders the
 * WelcomeScreen (needs courseSlug+date+time and no kiosk params).
 */
export function buildQrWelcomeUrl({
  courseSlug,
  date,
  time,
  durationMinutes,
}: QrBookingLinkParams) {
  const slug = courseSlug.trim()
  const params = new URLSearchParams()
  if (slug) params.set("courseSlug", slug)
  if (date) params.set("date", date)
  if (time) params.set("time", time)
  if (typeof durationMinutes === "number" && Number.isFinite(durationMinutes)) {
    params.set("durationMinutes", String(Math.round(durationMinutes)))
  }
  const qs = params.toString()
  return qs ? `/checkin?${qs}` : "/checkin"
}

export function buildQrSignInUrl(checkInPathWithQuery: string) {
  const redirectUrl = resolveSafeQrRedirect(checkInPathWithQuery)

  return redirectUrl
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
    : "/sign-in"
}
