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

export function buildQrSignInUrl(checkInPathWithQuery: string) {
  const redirectUrl = checkInPathWithQuery.startsWith("/checkin")
    ? checkInPathWithQuery
    : "/checkin"

  return `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
}
