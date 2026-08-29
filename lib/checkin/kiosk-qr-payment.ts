import { normalizePhoneKey } from "@/lib/checkin/new-student-flow"
import { EMAIL_REGEX } from "@/lib/shared"

export const KIOSK_QR_POLL_INTERVAL_MS = 3_000
export const KIOSK_PAYMENT_TRANSITION_MIN_MS = 900
export const STAFF_TERMINAL_LATENCY_TARGETS_MS = {
  pinReady: 2_000,
  cardNextStep: 1_500,
  cashNextStep: 800,
} as const

export type StaffTerminalLatencySegment = "pin_ready" | "card_next_step" | "cash_next_step"

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

export const shouldPauseKioskInactivityForQrPhase = (phase: KioskQrCheckoutPhase) => {
  void phase
  return false
}

export const buildKioskCheckoutQrImageUrl = (url: string, size = 260) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&data=${encodeURIComponent(url)}`

export const buildSpecialClassReservationQrUrl = (slug: string) =>
  `/special-classes/${encodeURIComponent(slug)}`

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

export const getKioskPaymentTransitionRemainingMs = (startedAtMs: number, nowMs = Date.now()) =>
  Math.max(0, KIOSK_PAYMENT_TRANSITION_MIN_MS - (nowMs - startedAtMs))

export const isWithinStaffTerminalLatencyTarget = (
  segment: StaffTerminalLatencySegment,
  durationMs: number
) => {
  switch (segment) {
    case "pin_ready":
      return durationMs <= STAFF_TERMINAL_LATENCY_TARGETS_MS.pinReady
    case "card_next_step":
      return durationMs <= STAFF_TERMINAL_LATENCY_TARGETS_MS.cardNextStep
    case "cash_next_step":
      return durationMs <= STAFF_TERMINAL_LATENCY_TARGETS_MS.cashNextStep
  }
}

type KioskResolvingOverlayInput = {
  isKioskTerminalFlow: boolean
  mode: string
  hasActiveCustomerSession: boolean
  hasPendingPinRotation: boolean
  loadingBootstrap: boolean
  hasBootstrap: boolean
  hasPackage: boolean
  processingPackageCheckIn: boolean
  hasPackageCheckInResult: boolean
  hasExistingRegularBookingOverride: boolean
  hasVisibleError: boolean
  hasPackageOffer: boolean
  /**
   * True once EnrollModal has reached its target step and is ready to display.
   * For existing customers this could be packages or payments step.
   * When false (and override is set), the overlay stays up to cover the
   * transition inside the modal.
   */
  paymentsStepReady: boolean
  /** True if user already has a purchase for this exact session — show popup instead of flow */
  hasExistingPurchaseForSession?: boolean
  /** True when quick repeat overlay will handle the flow — hide resolving overlay */
  quickRepeatEligible?: boolean
  /**
   * True once a terminal package check-in failure has been recorded. When
   * true, the resolving spinner must exit — the failure overlay takes over.
   * Defaults to false.
   */
  hasPackageCheckInFailure?: boolean
}

/**
 * Returns true when the terminal existing-customer flow is still resolving:
 * - bootstrap in-flight, OR
 * - bootstrap just resolved but the EnrollModal hasn't opened yet (covers the
 *   React flush gap between setState(bootstrap) and the useEffect that sets
 *   existingRegularBookingOverride), OR
 * - EnrollModal is open but hasn't reached its target step yet (packages or payments).
 * Used to render a full-screen spinner that covers the intermediate UI.
 */
export const shouldShowKioskResolvingOverlay = (input: KioskResolvingOverlayInput): boolean => {
  if (!input.isKioskTerminalFlow || input.mode !== "existing" || !input.hasActiveCustomerSession) {
    return false
  }
  if (input.hasPendingPinRotation) return false
  // Quick repeat eligible — the quick repeat overlay handles the flow
  if (input.quickRepeatEligible) return false
  // Duplicate purchase detected — hide overlay so the popup can show
  if (input.hasExistingPurchaseForSession) return false
  // Package offer screen is the visible UI — hide the overlay to prevent flash.
  if (input.hasPackageOffer) return false
  if (input.loadingBootstrap) return true
  if (input.hasVisibleError) return false
  if (!input.hasBootstrap) return false
  // Package flow: cover both the API call and the one-render-cycle gap between
  // bootstrap arrival and the auto-trigger effect starting package check-in.
  if (input.hasPackage) return !input.hasPackageCheckInResult && !input.hasPackageCheckInFailure
  // Keep the overlay until the EnrollModal is actually open (override set).
  if (!input.hasExistingRegularBookingOverride) return true
  // EnrollModal is open but hasn't reached target step yet — keep covering the
  // transition (info skip → packages/payments render).
  if (!input.paymentsStepReady) return true
  return false
}

type PackageCheckInFailureOverlayInput = {
  isKioskTerminalFlow: boolean
  mode: string
  hasActiveCustomerSession: boolean
  hasPendingPinRotation: boolean
  loadingBootstrap: boolean
  hasBootstrap: boolean
  hasPackage: boolean
  hasPackageCheckInFailure: boolean
  hasExistingPurchaseForSession?: boolean
  hasPackageOffer: boolean
  quickRepeatEligible?: boolean
}

/**
 * Returns true when the kiosk terminal failure overlay (Retry + see-staff)
 * should render instead of the resolving spinner.
 *
 * Duplicates the SAME front-guards, in the SAME order, as
 * `shouldShowKioskResolvingOverlay` through `hasPackageOffer` — so
 * `quickRepeatEligible: true` deterministically yields `false` from BOTH
 * gates. `hasPackageCheckInFailure` occupies the same structural position
 * `hasPackageCheckInResult` occupies in the resolving overlay's `hasPackage`
 * branch.
 *
 * `hasVisibleError` is intentionally NOT mirrored: once a terminal package
 * check-in failure is recorded, the customer must always get Retry/see-staff
 * guidance rather than a bare inline-error state on an unattended kiosk.
 */
export const shouldShowPackageCheckInFailureOverlay = (input: PackageCheckInFailureOverlayInput): boolean => {
  if (!input.isKioskTerminalFlow || input.mode !== "existing" || !input.hasActiveCustomerSession) {
    return false
  }
  if (input.hasPendingPinRotation) return false
  // Same precedence as the resolving overlay: Quick Repeat wins.
  if (input.quickRepeatEligible) return false
  if (input.hasExistingPurchaseForSession) return false
  if (input.hasPackageOffer) return false
  if (input.loadingBootstrap) return false // nothing failed yet
  if (!input.hasBootstrap) return false
  if (!input.hasPackage) return false // package-specific gate
  return input.hasPackageCheckInFailure
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
