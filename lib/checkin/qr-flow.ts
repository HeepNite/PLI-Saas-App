/**
 * True when the current browser URL belongs to the QR-mobile checkout flow.
 *
 * The check-in surfaces carry `?fromQr=1` (see the check-in QR link), and the
 * scanned-QR booking navigates to `/courses/...` with `?qrBooking=1` (see
 * `buildQrBookingUrl`). Used to hide distracting global chrome (chat widget,
 * back-to-top button) while a customer is checking in / booking from a scan.
 *
 * Client-only: returns false during SSR (no `window`).
 */
export function detectQrFlow(): boolean {
  if (typeof window === "undefined") return false
  const params = new URLSearchParams(window.location.search)
  return params.get("fromQr") === "1" || params.get("qrBooking") === "1"
}
