export type TerminalSensitiveStateInput = {
  isKioskTerminalFlow: boolean
  mode: "idle" | "existing" | "new"
  bootstrapOpen: boolean
  newBookingOpen: boolean
  existingBookingOpen: boolean
  phoneSignInOpen: boolean
  packageOfferOpen: boolean
  duplicatePurchaseOpen: boolean
  packageSuccessOpen: boolean
  kioskPinOpen: boolean
  kioskPinSessionActive: boolean
  pendingLoginPhone: boolean
  consecutiveOfferOpen: boolean
  consecutiveSuccessOpen: boolean
  consecutiveErrorOpen: boolean
}

export const hasTerminalSensitiveCustomerState = (input: TerminalSensitiveStateInput) => {
  if (!input.isKioskTerminalFlow) return false

  return (
    input.mode !== "idle" ||
    input.bootstrapOpen ||
    input.newBookingOpen ||
    input.existingBookingOpen ||
    input.phoneSignInOpen ||
    input.packageOfferOpen ||
    input.duplicatePurchaseOpen ||
    input.packageSuccessOpen ||
    input.kioskPinOpen ||
    input.kioskPinSessionActive ||
    input.pendingLoginPhone ||
    input.consecutiveOfferOpen ||
    input.consecutiveSuccessOpen ||
    input.consecutiveErrorOpen
  )
}
