type CompleteKioskCustomerFlowInput = {
  resetCustomerState: () => void
  isKioskTerminalFlow: boolean
}

export const completeKioskCustomerFlow = (input: CompleteKioskCustomerFlowInput) => {
  // Kiosk terminal flow: just reset the customer state, stay on the same page
  // NEVER sign out of Clerk - the staff session must remain active
  // NEVER redirect - the kiosk stays on the same terminal page
  input.resetCustomerState()
}
