import React from "react"

import { requestTerminalConsecutiveOfferApi } from "@/lib/checkin/checkin-qr-api"
import type { ConsecutiveOffer } from "@/components/front/checkin/checkin.types"

type UseConsecutiveOfferStateOptions = {
  isKioskTerminalFlow: boolean
  activeCourseSlug: string
  activeDate: string
  activeTime: string
  requestTerminalOffer?: typeof requestTerminalConsecutiveOfferApi
}

export function useConsecutiveOfferState({
  isKioskTerminalFlow,
  activeCourseSlug,
  activeDate,
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
  const requestGenerationRef = React.useRef(0)

  const refreshConsecutiveOffer = React.useCallback(() => {
    setConsecutiveFetchKey((key) => key + 1)
  }, [])

  React.useEffect(() => {
    const requestGeneration = ++requestGenerationRef.current

    if (!isKioskTerminalFlow) {
      setConsecutiveOffer(null)
      setConsecutiveOfferSettled(true)
      return
    }
    if (!activeCourseSlug || !activeDate) {
      setConsecutiveOffer(null)
      setConsecutiveOfferSettled(true)
      return
    }

    setConsecutiveOffer(null)
    setConsecutiveOfferSettled(false)

    const controller = new AbortController()
    const isCurrentRequest = () =>
      requestGenerationRef.current === requestGeneration && !controller.signal.aborted

    requestTerminalOffer({
      courseSlug: activeCourseSlug,
      date: activeDate,
      time: activeTime || undefined,
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (!isCurrentRequest()) return
        setConsecutiveOffer(data ? (data as ConsecutiveOffer) : null)
      })
      .catch(() => {})
      .finally(() => {
        if (!isCurrentRequest()) return
        setConsecutiveOfferSettled(true)
      })

    return () => controller.abort()
  }, [isKioskTerminalFlow, activeCourseSlug, activeDate, activeTime, consecutiveFetchKey, requestTerminalOffer])

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
