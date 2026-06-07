import React from "react"

import { requestTerminalConsecutiveOfferApi } from "@/lib/checkin/checkin-qr-api"
import type { ConsecutiveOffer } from "@/components/front/checkin/checkin.types"

type UseConsecutiveOfferStateOptions = {
  isKioskTerminalFlow: boolean
  activeCourseSlug: string
  activeTime: string
  requestTerminalOffer?: typeof requestTerminalConsecutiveOfferApi
}

export function useConsecutiveOfferState({
  isKioskTerminalFlow,
  activeCourseSlug,
  activeTime,
  requestTerminalOffer = requestTerminalConsecutiveOfferApi,
}: UseConsecutiveOfferStateOptions) {
  const [consecutiveOffer, setConsecutiveOffer] = React.useState<ConsecutiveOffer | null>(null)
  const [consecutiveOfferSettled, setConsecutiveOfferSettled] = React.useState(false)
  const [showConsecutiveOverlay, setShowConsecutiveOverlay] = React.useState(false)
  const [showConsecutivePaymentSelection, setShowConsecutivePaymentSelection] = React.useState(false)
  const [consecutiveProcessing, setConsecutiveProcessing] = React.useState(false)
  const [consecutiveProcessingAction, setConsecutiveProcessingAction] = React.useState<"accept" | "decline" | "cash" | "card" | null>(null)
  const [consecutiveSuccess, setConsecutiveSuccess] = React.useState<{ courseTitle: string } | null>(null)
  const [consecutiveError, setConsecutiveError] = React.useState<string | null>(null)
  const [consecutiveFetchKey, setConsecutiveFetchKey] = React.useState(0)
  const [pendingNewBooking, setPendingNewBooking] = React.useState(false)

  const refreshConsecutiveOffer = React.useCallback(() => {
    setConsecutiveFetchKey((key) => key + 1)
  }, [])

  React.useEffect(() => {
    if (!isKioskTerminalFlow) {
      setConsecutiveOffer(null)
      setConsecutiveOfferSettled(true)
      return
    }
    if (!activeCourseSlug) {
      setConsecutiveOffer(null)
      setConsecutiveOfferSettled(true)
      return
    }

    setConsecutiveOfferSettled(false)

    const controller = new AbortController()

    requestTerminalOffer({
      courseSlug: activeCourseSlug,
      time: activeTime || undefined,
      signal: controller.signal,
    })
      .then(({ data }) => {
        setConsecutiveOffer(data ? (data as ConsecutiveOffer) : null)
      })
      .catch(() => {})
      .finally(() => {
        setConsecutiveOfferSettled(true)
      })

    return () => controller.abort()
  }, [isKioskTerminalFlow, activeCourseSlug, activeTime, consecutiveFetchKey, requestTerminalOffer])

  return {
    consecutiveOffer,
    setConsecutiveOffer,
    consecutiveOfferSettled,
    setConsecutiveOfferSettled,
    showConsecutiveOverlay,
    setShowConsecutiveOverlay,
    showConsecutivePaymentSelection,
    setShowConsecutivePaymentSelection,
    consecutiveProcessing,
    setConsecutiveProcessing,
    consecutiveProcessingAction,
    setConsecutiveProcessingAction,
    consecutiveSuccess,
    setConsecutiveSuccess,
    consecutiveError,
    setConsecutiveError,
    pendingNewBooking,
    setPendingNewBooking,
    refreshConsecutiveOffer,
  }
}
