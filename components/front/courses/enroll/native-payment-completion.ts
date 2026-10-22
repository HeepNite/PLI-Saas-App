/** How long a native PAID confirmation stays visible before the kiosk resets. */
export const NATIVE_PAYMENT_SUCCESS_DISPLAY_MS = 5_000

type NativePaymentCompletionInput = {
  total: number
  setProcessing: (value: boolean) => void
  setSuccess: (value: boolean) => void
  setSuccessMessage: (value: string | null) => void
  onComplete?: () => void
}

export const completeNativePaymentLifecycle = ({
  total,
  setProcessing,
  setSuccess,
  setSuccessMessage,
  onComplete,
}: NativePaymentCompletionInput) => {
  setSuccessMessage(`Payment approved — $${total.toFixed(2)}`)
  setSuccess(true)
  setProcessing(false)
  return window.setTimeout(() => onComplete?.(), NATIVE_PAYMENT_SUCCESS_DISPLAY_MS)
}
