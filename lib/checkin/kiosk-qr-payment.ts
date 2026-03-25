import { normalizePhoneKey } from "@/lib/checkin/new-student-flow"

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

type KioskFastPathEligibilityInput = {
  isKioskTerminalFlow: boolean
  isCheckInExistingFlow: boolean
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

const hasValidKioskFastPathPhone = (value?: string) => {
  const digits = normalizePhoneKey(value || "")
  if (digits.length === 10) return true
  return digits.length === 11 && digits.startsWith("1")
}

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

export const isKioskInfoFastPathEligible = (input: KioskFastPathEligibilityInput) => {
  if (!input.isKioskTerminalFlow || !input.isCheckInExistingFlow) {
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
      hasValidKioskFastPathPhone(phone)
  )
}

export const isKioskCardFastPathEligible = (
  input: KioskFastPathEligibilityInput & { paymentMethod: string }
) => input.paymentMethod === "stripe" && isKioskInfoFastPathEligible(input)

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
