import { normalizePhoneKey } from "@/lib/checkin/new-student-flow"

export const KIOSK_QR_POLL_INTERVAL_MS = 3_000
export const KIOSK_PAYMENT_TRANSITION_MIN_MS = 900

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

type KioskInfoAutoAdvanceInput = KioskFastPathEligibilityInput & {
  activeStepKey: string
  open: boolean
  processing: boolean
  identityCheckBusy: boolean
  requiresSignIn: boolean
  hasError: boolean
}

type KioskInfoMaskInput = {
  isKioskTerminalFlow: boolean
  isCheckInExistingFlow: boolean
  activeStepKey: string
  open: boolean
  requiresSignIn: boolean
  hasError: boolean
  hydrating: boolean
  transitionPending: boolean
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const normalizeFirstName = (value?: string) => value?.trim().split(/\s+/)[0] || ""

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

export const shouldAutoAdvanceKioskInfoStep = (input: KioskInfoAutoAdvanceInput) => {
  if (!input.open || input.activeStepKey !== "info") {
    return false
  }

  if (input.processing || input.identityCheckBusy || input.requiresSignIn || input.hasError) {
    return false
  }

  return isKioskInfoFastPathEligible(input)
}

export const shouldMaskKioskInfoStep = (input: KioskInfoMaskInput) => {
  if (!input.open || !input.isKioskTerminalFlow || input.activeStepKey !== "info") {
    return false
  }

  if (input.requiresSignIn || input.hasError) {
    return false
  }

  return (input.isCheckInExistingFlow && input.hydrating) || input.transitionPending
}

export const getKioskPaymentTransitionMessage = (firstName?: string) => {
  const normalizedFirstName = normalizeFirstName(firstName)
  return normalizedFirstName
    ? `We're getting your payment ready, ${normalizedFirstName}.`
    : "We're getting your payment ready."
}

type KioskResolvingOverlayInput = {
  isKioskTerminalFlow: boolean
  mode: string
  hasActiveCustomerSession: boolean
  loadingBootstrap: boolean
  hasBootstrap: boolean
  hasExistingRegularBookingOverride: boolean
  hasVisibleError: boolean
  /**
   * True once EnrollModal has reached the payments step and is ready to display.
   * When false (and override is set), the overlay stays up to cover the
   * info→payments transition inside the modal.
   */
  paymentsStepReady: boolean
}

/**
 * Returns true when the terminal existing-customer flow is still resolving:
 * - bootstrap in-flight, OR
 * - bootstrap just resolved but the EnrollModal hasn't opened yet (covers the
 *   React flush gap between setState(bootstrap) and the useEffect that sets
 *   existingRegularBookingOverride), OR
 * - EnrollModal is open but hasn't reached the payments step yet (covers the
 *   internal info→payments transition gap inside the modal).
 * Used to render a full-screen spinner that covers the intermediate UI.
 */
export const shouldShowKioskResolvingOverlay = (input: KioskResolvingOverlayInput): boolean => {
  if (!input.isKioskTerminalFlow || input.mode !== "existing" || !input.hasActiveCustomerSession) {
    return false
  }
  if (input.loadingBootstrap) return true
  if (input.hasVisibleError) return false
  // Keep the overlay until the EnrollModal is actually open (override set).
  if (!input.hasExistingRegularBookingOverride) return true
  // EnrollModal is open but hasn't reached payments yet — keep covering the
  // internal transition (info skip → payments render).
  if (!input.paymentsStepReady) return true
  return false
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
