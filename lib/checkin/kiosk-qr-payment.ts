export const KIOSK_QR_POLL_INTERVAL_MS = 3_000

export type KioskQrCheckoutPhase =
  | "idle"
  | "creating"
  | "qr_ready"
  | "waiting_for_payment"
  | "complete"
  | "expired"
  | "error"

export type KioskQrCheckoutState = {
  phase: KioskQrCheckoutPhase
  sessionId: string | null
  url: string | null
  expiresAt: string | null
  awaitingWebhook: boolean
  purchaseId: string | null
  paymentStatus: string | null
  error: string | null
}

type KioskCardFastPathEligibilityInput = {
  isKioskTerminalFlow: boolean
  isCheckInExistingFlow: boolean
  paymentMethod: string
  date: string
  time: string
  contact: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const createEmptyKioskQrCheckoutState = (): KioskQrCheckoutState => ({
  phase: "idle",
  sessionId: null,
  url: null,
  expiresAt: null,
  awaitingWebhook: false,
  purchaseId: null,
  paymentStatus: null,
  error: null,
})

export const isKioskQrPendingPhase = (phase: KioskQrCheckoutPhase) =>
  phase === "qr_ready" || phase === "waiting_for_payment"

export const shouldPauseKioskInactivityForQrPhase = (phase: KioskQrCheckoutPhase) =>
  isKioskQrPendingPhase(phase)

export const buildKioskCheckoutQrImageUrl = (url: string, size = 260) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&data=${encodeURIComponent(url)}`

export const isKioskCardFastPathEligible = (input: KioskCardFastPathEligibilityInput) => {
  if (!input.isKioskTerminalFlow || !input.isCheckInExistingFlow || input.paymentMethod !== "stripe") {
    return false
  }

  const firstName = input.contact.firstName?.trim() || ""
  const lastName = input.contact.lastName?.trim() || ""
  const email = input.contact.email?.trim() || ""
  const phone = input.contact.phone?.trim() || ""

  return Boolean(
    input.date &&
      input.time &&
      firstName.length > 0 &&
      lastName.length > 0 &&
      EMAIL_REGEX.test(email) &&
      /^\+1\s\d{3}\s\d{3}\s\d{4}$/.test(phone)
  )
}

export const resolveKioskQrPhaseFromStatus = (status: string | null | undefined): KioskQrCheckoutPhase => {
  switch ((status || "").toLowerCase()) {
    case "complete":
      return "complete"
    case "expired":
    case "not_found":
      return "expired"
    default:
      return "waiting_for_payment"
  }
}
