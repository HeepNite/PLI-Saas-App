const EXISTING_CUSTOMER_INFO_STEP = 2

export const getExistingCustomerInitialStep = (input?: { isKioskTerminalFlow?: boolean }) =>
  input?.isKioskTerminalFlow ? 0 : EXISTING_CUSTOMER_INFO_STEP

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
