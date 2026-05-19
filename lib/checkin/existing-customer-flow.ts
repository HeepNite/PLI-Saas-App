import type { PackageOfferScenario } from "@/components/front/checkin/checkin.types"

const EXISTING_CUSTOMER_INFO_STEP = 2

export const hasExistingCustomerPrefillContact = (input?: {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
}) =>
  Boolean(
    input?.firstName?.trim() &&
      input?.lastName?.trim() &&
      input?.email?.trim() &&
      input?.phone?.trim()
  )

/**
 * Returns the initial step index for existing customer kiosk flow.
 * 
 * For kiosk terminal flows, the step order is: info → [photo] → [packages] → payments
 * 
 * Logic:
 * - If contact is NOT prefilled → start at info (0)
 * - If contact IS prefilled:
 *   - If needs photo → go to photo step
 *   - Else if packages available AND no active package → go to packages step
 *   - Else → go to payments step
 */
export const getExistingCustomerInitialStep = (input?: {
  isKioskTerminalFlow?: boolean
  hasPrefilledContact?: boolean
  /** Whether photo step is included in the flow */
  requiresPhotoStep?: boolean
  /** Whether packages step is included in the flow (course has packages) */
  hasPackages?: boolean
  /** Whether the user already has an active package */
  hasActivePackage?: boolean
}) => {
  if (!input?.isKioskTerminalFlow) {
    return EXISTING_CUSTOMER_INFO_STEP
  }

  // No prefilled contact → start at info
  if (!input.hasPrefilledContact) {
    return 0
  }

  // Steps after info: [photo] → [packages] → payments
  // Calculate the target step index
  
  // If needs photo, that's the first step after info
  if (input.requiresPhotoStep) {
    return 1 // photo step
  }

  // If packages available AND user doesn't have active package, go to packages
  if (input.hasPackages && !input.hasActivePackage) {
    // packages step index = 1 (no photo) or would be 2 (with photo, but we handled that above)
    return 1
  }

  // Otherwise go to payments
  // payments index = 1 (no photo, no packages) 
  //                = 2 (with packages but user has active package)
  //                = 2 (with photo, no packages) - handled above
  let paymentsIndex = 1
  if (input.hasPackages) paymentsIndex++ // packages step exists, skip it
  return paymentsIndex
}

export const shouldShowCheckInQrPanel = (input: {
  hideQrPanel: boolean
  hasQrImage: boolean
  isCompactViewport: boolean
  isQrEntry: boolean
  shellVariant: "qr" | "terminal"
}) => {
  if (input.hideQrPanel || !input.hasQrImage || input.isQrEntry) {
    return false
  }

  if (input.shellVariant === "terminal") {
    return true
  }

  return !input.isCompactViewport
}

export const shouldAutoOpenExistingPurchase = (input: {
  mode: "idle" | "existing" | "new"
  hasBootstrap: boolean
  isSignedIn: boolean
  hasKioskPinSession: boolean
  loadingBootstrap: boolean
  hasExistingRegularBookingOverride: boolean
  openNewBooking: boolean
  processingPackageCheckIn: boolean
  hasPackage: boolean
}) => {
  if (input.mode !== "existing") return false
  if (!input.hasBootstrap || input.loadingBootstrap) return false
  if (!input.isSignedIn && !input.hasKioskPinSession) return false
  if (input.hasExistingRegularBookingOverride || input.openNewBooking || input.processingPackageCheckIn) return false
  return !input.hasPackage
}

export const shouldShowPackageOffer = (input: {
  isKioskTerminalFlow: boolean
  hasPackage: boolean
  quickCheckoutServiceId: string | null
  quickCheckoutPackageId: string | null
  previousPackageId: string | null
  availablePackages: Array<{ id: string }>
}): "dropin-upsell" | "expired-rebuy" | "new-user-upsell" | null => {
  if (!input.isKioskTerminalFlow) return null
  if (input.hasPackage) return null
  if (input.availablePackages.length === 0) return null

  if (input.previousPackageId || input.quickCheckoutPackageId) {
    return "expired-rebuy"
  }

  if (input.quickCheckoutServiceId === "dropin") {
    return "dropin-upsell"
  }

  return null
}

export const shouldAutoTriggerPackageCheckIn = (input: {
  isKioskTerminalFlow: boolean
  mode: "idle" | "existing" | "new"
  hasPackage: boolean
  processingPackageCheckIn: boolean
  hasPackageCheckInResult: boolean
  hasExistingPurchaseForSession?: boolean
  effectiveCheckInWindowOpen: boolean
  hasActiveSession: boolean
  /** Whether a consecutive class offer was fetched for this course */
  hasConsecutiveOffer: boolean
  /** Whether the consecutive offer fetch has resolved (success or failure) */
  consecutiveOfferSettled: boolean
}) => {
  // Already checked in or currently processing → don't re-trigger
  if (input.hasPackageCheckInResult || input.processingPackageCheckIn) return false
  // Existing successful attendance/purchase should show the duplicate/status
  // popup, not run another package check-in success flow.
  if (input.hasExistingPurchaseForSession) return false
  // Not a kiosk terminal existing-customer flow → no auto-trigger
  if (!input.isKioskTerminalFlow || input.mode !== "existing") return false
  // No package or check-in window closed → no auto-trigger
  if (!input.hasPackage || !input.effectiveCheckInWindowOpen) return false
  // No active session → no auto-trigger
  if (!input.hasActiveSession) return false
  // Consecutive offer exists and is settled → suppress auto-trigger (caller shows overlay first)
  if (input.hasConsecutiveOffer && input.consecutiveOfferSettled) return false
  // Consecutive offer fetch not yet settled → wait (effect will re-fire when settled)
  if (!input.consecutiveOfferSettled) return false
  // No consecutive offer → original auto-trigger behavior
  return true
}

export const shouldSurfaceClosedWindowPackageError = (input: {
  isKioskTerminalFlow: boolean
  mode: "idle" | "existing" | "new"
  hasBootstrap: boolean
  hasPackage: boolean
  effectiveCheckInWindowOpen: boolean
  processingPackageCheckIn: boolean
  hasPackageCheckInResult: boolean
  hasExistingRegularBookingOverride: boolean
}) => {
  if (!input.isKioskTerminalFlow || input.mode !== "existing") return false
  if (!input.hasBootstrap || !input.hasPackage) return false
  if (input.effectiveCheckInWindowOpen) return false
  if (input.processingPackageCheckIn || input.hasPackageCheckInResult) return false
  return !input.hasExistingRegularBookingOverride
}

/**
 * Determines whether packageOfferContext should be preserved when bootstrap becomes null.
 * In scenario 3 (new-user-upsell), the offer is set AFTER the first purchase completes,
 * when bootstrap may be null. Clearing it would make the offer screen disappear immediately.
 */
export const shouldPreserveOfferOnBootstrapClear = (
  scenario: PackageOfferScenario | null
): boolean => scenario === "new-user-upsell"

/**
 * Resolves the action to take when the user declines a package offer.
 * - new-user-upsell: "No thanks, I'm done" → station completion
 * - existing customer (expired-rebuy, dropin-upsell): → existing purchase flow
 */
export const resolvePackageOfferDeclineAction = (
  scenario: PackageOfferScenario | null
): "station-completion" | "existing-purchase" =>
  scenario === "new-user-upsell" ? "station-completion" : "existing-purchase"

/**
 * Resolves what should happen after a package holder declines the consecutive
 * class offer.
 *
 * - `pre-checkin`: class A has NOT been checked in yet → the caller must
 *   perform the package check-in, then show the standard package success
 *   overlay so the operator can confirm completion (which then triggers
 *   station completion via the overlay's "Done" button or the kiosk
 *   inactivity timer). The caller must NOT call `handleStationCompletion`
 *   directly here — doing so wipes `packageCheckInResult` before the overlay
 *   can render and looks like a silent failure.
 *
 * - `post-checkin`: class A was already checked in BEFORE the offer was
 *   shown → the success overlay was already displayed. The caller dismisses
 *   the consecutive overlay and proceeds to station completion.
 *
 * This is intentionally derived from a single boolean so the caller can read
 * it BEFORE awaiting any check-in API call, avoiding stale-closure bugs that
 * arise when re-reading React state after `await`.
 */
export const resolvePackageConsecutiveDeclineAction = (input: {
  hasPackageCheckInResult: boolean
}): "pre-checkin" | "post-checkin" =>
  input.hasPackageCheckInResult ? "post-checkin" : "pre-checkin"

/**
 * Resolves what should happen when a PACKAGE HOLDER accepts the consecutive
 * class offer.
 *
 * - `pre-checkin-then-payment-selection`: class A has NOT been checked in yet
 *   AND the consecutive class has a positive price. The caller must check
 *   class A in first (via package), then show the Cash/Card payment
 *   selection for class B. The monetary add-on must NOT be created until the
 *   user picks a payment method.
 *
 * - `show-payment-selection`: class A was already checked in AND the
 *   consecutive class has a positive price. The caller must show Cash/Card
 *   selection. The monetary add-on must NOT be created until the user picks
 *   a payment method.
 *
 * - `direct-add`: the consecutive class is free (price 0, null, or
 *   negative). No payment collection is required, so the caller may add the
 *   class directly via `/api/checkin/qr/package` (without
 *   `consecutiveCashPayment`).
 *
 * RATIONALE: Hitting `/api/checkin/qr/package` directly with
 * `consecutiveAddOn: true` and a positive price (and no
 * `consecutiveCashPayment`) causes the backend to mark the monetary
 * purchase as `paid` with `paymentChannel: consecutive_addon` and no Stripe
 * IDs — money never collected. See Jhon Doe purchase
 * `cmpbkyowj001ow3gpqxwdpexa`.
 */
export const resolvePackageConsecutiveAcceptAction = (input: {
  hasPackageCheckInResult: boolean
  priceCents: number | null
}):
  | "pre-checkin-then-payment-selection"
  | "show-payment-selection"
  | "direct-add" => {
  const hasPositivePrice =
    typeof input.priceCents === "number" && input.priceCents > 0

  if (!hasPositivePrice) {
    return "direct-add"
  }

  return input.hasPackageCheckInResult
    ? "show-payment-selection"
    : "pre-checkin-then-payment-selection"
}

/**
 * Resolves what should happen when the user presses "Done" on the
 * KioskPackageSuccessOverlay (the credit-consumed confirmation screen).
 *
 * - `open-payment-selection`: the success overlay is showing because class A
 *   was checked in as part of a consecutive ACCEPT flow with a positive
 *   price. The credit-consumed confirmation has been acknowledged; the
 *   caller must NOW open the Cash/Card payment selection for class B
 *   (instead of resetting the station).
 *
 * - `complete-station`: the success overlay is showing for a normal package
 *   check-in (no pending consecutive add-on). The caller resets the station.
 *
 * RATIONALE: The original ACCEPT flow set `showConsecutivePaymentSelection`
 * immediately after recording `packageCheckInResult`, racing the success
 * overlay so the operator never saw the credit-consumed confirmation. The
 * confirmation must be acknowledged explicitly BEFORE the payment selection
 * appears.
 */
export const resolvePackageSuccessDoneAction = (input: {
  awaitingConsecutivePaymentSelection: boolean
}): "open-payment-selection" | "complete-station" =>
  input.awaitingConsecutivePaymentSelection
    ? "open-payment-selection"
    : "complete-station"
