type CompleteKioskCustomerFlowInput = {
  resetCustomerState: () => void
  isKioskTerminalFlow: boolean
  isCustomerSignedIn: boolean
  redirectUrl: string
  sessionId?: string | null
  signOut: (input: { redirectUrl: string; sessionId?: string }) => Promise<unknown> | unknown
}

export const completeKioskCustomerFlow = async (input: CompleteKioskCustomerFlowInput) => {
  input.resetCustomerState()

  if (!input.isKioskTerminalFlow || !input.isCustomerSignedIn) {
    return
  }

  await input.signOut({
    redirectUrl: input.redirectUrl,
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
  })
}
