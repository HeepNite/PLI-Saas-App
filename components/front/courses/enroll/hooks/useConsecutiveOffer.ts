import React from "react"
import type { ConsecutiveOfferData } from "@/components/front/checkin/ConsecutiveClassOffer"

type UseConsecutiveOfferInput = {
  courseSlug: string
  date: string
  time: string
  consecutiveOffer: ConsecutiveOfferData | undefined
  enabled: boolean
  resetChoice: () => void
  resetAccepted: () => void
  resetAddedCents: () => void
}

type UseConsecutiveOfferResult = {
  fetchedOffer: ConsecutiveOfferData | null
  offerLoading: boolean
}

export function useConsecutiveOffer({
  courseSlug,
  date,
  time,
  consecutiveOffer,
  enabled,
  resetChoice,
  resetAccepted,
  resetAddedCents,
}: UseConsecutiveOfferInput): UseConsecutiveOfferResult {
  const [fetchedOffer, setFetchedOffer] = React.useState<ConsecutiveOfferData | null>(null)
  const [offerLoading, setOfferLoading] = React.useState(false)

  React.useEffect(() => {
    if (consecutiveOffer) {
      setFetchedOffer(null)
      setOfferLoading(false)
      return
    }

    if (!enabled) {
      setFetchedOffer(null)
      setOfferLoading(false)
      return
    }

    if (!date || !time) {
      setFetchedOffer(null)
      setOfferLoading(false)
      resetAccepted()
      resetAddedCents()
      resetChoice()
      return
    }

    setOfferLoading(true)
    const controller = new AbortController()
    const params = new URLSearchParams({ courseSlug, date, time })
    void fetch(`/api/checkin/terminal/consecutive-offer?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((offer: ConsecutiveOfferData | null) => {
        setFetchedOffer(offer)
        setOfferLoading(false)
        resetAccepted()
        resetAddedCents()
        resetChoice()
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setFetchedOffer(null)
        setOfferLoading(false)
        resetAccepted()
        resetAddedCents()
        resetChoice()
      })

    return () => controller.abort()
  }, [consecutiveOffer, courseSlug, date, enabled, resetAccepted, resetAddedCents, resetChoice, time])

  return { fetchedOffer, offerLoading }
}
