type CompleteKioskCustomerFlowInput = {
  resetCustomerState: () => void
  isKioskTerminalFlow: boolean
  isCustomerSignedIn: boolean
  redirectUrl: string
  signOut: (input: { redirectUrl: string }) => Promise<unknown> | unknown
}

export const completeKioskCustomerFlow = async (input: CompleteKioskCustomerFlowInput) => {
  input.resetCustomerState()

  if (!input.isKioskTerminalFlow || !input.isCustomerSignedIn) {
    return
  }

  await input.signOut({ redirectUrl: input.redirectUrl })
}
