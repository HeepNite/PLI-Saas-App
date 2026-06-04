import React from "react"

import { useKioskQrCheckoutPoller } from "@/components/front/checkin/hooks/useKioskQrCheckoutPoller"
import type { ConsecutiveOffer } from "@/components/front/checkin/checkin.types"
import type { KioskQrCheckoutState } from "@/lib/checkin/kiosk-qr-payment"

// ─── Types ────────────────────────────────────────────────────────────────────

type UseConsecutiveOfferUiHandlersOptions = {
  handleStationCompletion: () => void | Promise<void>
  refreshConsecutiveOffer: () => void
  setConsecutiveSuccess: (value: { courseTitle: string } | null) => void
  setShowConsecutiveOverlay: (value: boolean) => void
  setConsecutiveError: (value: string | null) => void
  setConsecutiveOffer: (value: ConsecutiveOffer | null) => void
  handleConsecutiveAccept: () => void | Promise<void>
  handleConsecutivePayCard: () => void | Promise<void>
  consecutiveQrCheckout: KioskQrCheckoutState
  setConsecutiveQrCheckout: React.Dispatch<React.SetStateAction<KioskQrCheckoutState>>
  handleConsecutiveQrComplete: () => void
}

type UseConsecutiveOfferUiHandlersResult = {
  handleConsecutiveSuccessDone: () => void
  handleConsecutiveRetry: () => void
  handleConsecutiveErrorDismiss: () => void
  handleConsecutiveQrRetry: () => void
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConsecutiveOfferUiHandlers({
  handleStationCompletion,
  refreshConsecutiveOffer,
  setConsecutiveSuccess,
  setShowConsecutiveOverlay,
  setConsecutiveError,
  setConsecutiveOffer,
  handleConsecutiveAccept,
  handleConsecutivePayCard,
  consecutiveQrCheckout,
  setConsecutiveQrCheckout,
  handleConsecutiveQrComplete,
}: UseConsecutiveOfferUiHandlersOptions): UseConsecutiveOfferUiHandlersResult {
  const handleConsecutiveSuccessDone = React.useCallback(() => {
    setConsecutiveSuccess(null)
    setShowConsecutiveOverlay(false)
    refreshConsecutiveOffer()
    void handleStationCompletion()
  }, [handleStationCompletion, refreshConsecutiveOffer, setConsecutiveSuccess, setShowConsecutiveOverlay])

  const handleConsecutiveRetry = React.useCallback(() => {
    setConsecutiveError(null)
    void handleConsecutiveAccept()
  }, [handleConsecutiveAccept, setConsecutiveError])

  const handleConsecutiveErrorDismiss = React.useCallback(() => {
    setConsecutiveError(null)
    setConsecutiveOffer(null)
    refreshConsecutiveOffer()
    void handleStationCompletion()
  }, [handleStationCompletion, refreshConsecutiveOffer, setConsecutiveError, setConsecutiveOffer])

  const handleConsecutiveQrRetry = React.useCallback(() => {
    void handleConsecutivePayCard()
  }, [handleConsecutivePayCard])

  // ─── Poll consecutive QR checkout status ──────────────────────────────────
  useKioskQrCheckoutPoller({
    checkoutState: consecutiveQrCheckout,
    setCheckoutState: setConsecutiveQrCheckout,
    onComplete: handleConsecutiveQrComplete,
  })

  return {
    handleConsecutiveSuccessDone,
    handleConsecutiveRetry,
    handleConsecutiveErrorDismiss,
    handleConsecutiveQrRetry,
  }
}
