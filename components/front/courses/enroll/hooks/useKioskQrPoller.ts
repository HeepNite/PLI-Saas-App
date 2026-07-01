import React from "react"
import { createKioskQrPoller } from "@/components/front/courses/enroll/effects/kiosk-qr-poller"
import { createEmptyKioskQrCheckoutState, type KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"

type UseKioskQrPollerProps = {
  open: boolean
  isKioskTerminalFlow: boolean
  sessionId: string | null
  kioskQrCheckoutPending: boolean
  completeDropInCheckInAfterCardPayment: (args: { purchaseId: string | null }) => Promise<string | null | undefined>
  setSuccessMessage: (value: React.SetStateAction<string | null>) => void
  setSuccess: (value: React.SetStateAction<boolean>) => void
  setRequiresSignIn: (value: React.SetStateAction<boolean>) => void
  setExistingAccountDetected: (value: React.SetStateAction<boolean>) => void
  setResumeAfterSignInStep: (value: React.SetStateAction<number | null>) => void
  setPendingAutoPay: (value: React.SetStateAction<boolean>) => void
  setKioskQrCheckout: React.Dispatch<React.SetStateAction<KioskQrCheckoutState>>
}

export function useKioskQrPoller({
  open,
  isKioskTerminalFlow,
  sessionId,
  kioskQrCheckoutPending,
  completeDropInCheckInAfterCardPayment,
  setSuccessMessage,
  setSuccess,
  setRequiresSignIn,
  setExistingAccountDetected,
  setResumeAfterSignInStep,
  setPendingAutoPay,
  setKioskQrCheckout,
}: UseKioskQrPollerProps): void {
  React.useEffect(() => {
    if (!open || !isKioskTerminalFlow || !sessionId || !kioskQrCheckoutPending) {
      return
    }

    return createKioskQrPoller({
      sessionId,
      onOutcome: async (outcome) => {
        if (outcome.type === "complete") {
          const completionMessage = await completeDropInCheckInAfterCardPayment({
            purchaseId: outcome.purchaseId,
          })
          setSuccessMessage(
            completionMessage ||
              (outcome.paymentStatus
                ? `Payment recorded successfully (${outcome.paymentStatus}).`
                : "Payment recorded successfully.")
          )
          setSuccess(true)
          setRequiresSignIn(false)
          setExistingAccountDetected(false)
          setResumeAfterSignInStep(null)
          setPendingAutoPay(false)
          setKioskQrCheckout(createEmptyKioskQrCheckoutState())
          return
        }

        if (outcome.type === "error") {
          console.warn("Unable to poll hosted checkout session status", outcome.error)
          setKioskQrCheckout((prev) => ({
            ...prev,
            phase: "error",
            awaitingWebhook: false,
            error: outcome.message,
          }))
          return
        }

        setKioskQrCheckout((prev) => ({
          ...prev,
          ...outcome.state,
        }))
      },
    })
  }, [
    completeDropInCheckInAfterCardPayment,
    isKioskTerminalFlow,
    kioskQrCheckoutPending,
    open,
    sessionId,
    setExistingAccountDetected,
    setKioskQrCheckout,
    setRequiresSignIn,
    setResumeAfterSignInStep,
    setSuccess,
    setSuccessMessage,
    setPendingAutoPay,
  ])
}
