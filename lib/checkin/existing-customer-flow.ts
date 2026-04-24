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
 * When contact is prefilled, we skip info and start at the appropriate step.
 * When going directly to payments, we need to calculate the correct index based on
 * whether photo/packages steps exist.
 */
export const getExistingCustomerInitialStep = (input?: {
  isKioskTerminalFlow?: boolean
  hasPrefilledContact?: boolean
  /** Whether photo step is included in the flow */
  requiresPhotoStep?: boolean
  /** Whether packages step is included in the flow */
  hasPackages?: boolean
  /** Whether to skip directly to payments (existing customers with all data) */
  skipToPayments?: boolean
}) => {
  if (!input?.isKioskTerminalFlow) {
    return EXISTING_CUSTOMER_INFO_STEP
  }

  // If we should skip directly to payments, calculate the correct index
  if (input.skipToPayments || input.hasPrefilledContact) {
    // Steps: info(0) → [photo(1)] → [packages] → payments
    let paymentsIndex = 1 // after info
    if (input.requiresPhotoStep) paymentsIndex++
    if (input.hasPackages) paymentsIndex++
    return paymentsIndex
  }

  return 0 // start at info
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
  effectiveCheckInWindowOpen: boolean
  hasActiveSession: boolean
}) => {
  if (!input.isKioskTerminalFlow || input.mode !== "existing") return false
  if (!input.hasPackage || input.processingPackageCheckIn || input.hasPackageCheckInResult) return false
  if (!input.effectiveCheckInWindowOpen) return false
  return input.hasActiveSession
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
