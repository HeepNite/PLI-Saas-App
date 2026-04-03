type CompleteKioskCustomerFlowInput = {
  resetCustomerState: () => void
  isKioskTerminalFlow: boolean
  resetUrl?: string
  replaceUrl?: (url: string) => Promise<unknown> | unknown
  signOutCustomerSession?: () => Promise<unknown> | unknown
}

export const completeKioskCustomerFlow = async (input: CompleteKioskCustomerFlowInput) => {
  try {
    if (input.isKioskTerminalFlow && input.signOutCustomerSession) {
      await input.signOutCustomerSession()
    }
  } finally {
    input.resetCustomerState()

    if (!input.isKioskTerminalFlow || !input.resetUrl || !input.replaceUrl) {
      return
    }

    await input.replaceUrl(input.resetUrl)
  }
}
