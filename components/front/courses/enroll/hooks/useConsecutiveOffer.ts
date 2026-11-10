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

/** A stuck lookup must not hold the flow: past this, continue without a promo. */
export const CONSECUTIVE_OFFER_LOOKUP_TIMEOUT_MS = 4000

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
  // Key of the last finished lookup. Loading is derived from it so the very
  // first render already reports "loading": auto-advance effects run in that
  // same commit and must not skip the offer step before the fetch resolves.
  const [resolvedKey, setResolvedKey] = React.useState<string | null>(null)
  const requestKey = `${courseSlug}|${date}|${time}`
  const shouldFetch = !consecutiveOffer && enabled && Boolean(date) && Boolean(time)
  const offerLoading = shouldFetch && resolvedKey !== requestKey

  React.useEffect(() => {
    if (consecutiveOffer) {
      setFetchedOffer(null)
      return
    }

    if (!enabled) {
      setFetchedOffer(null)
      return
    }

    if (!date || !time) {
      setFetchedOffer(null)
      resetAccepted()
      resetAddedCents()
      resetChoice()
      return
    }

    const controller = new AbortController()
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, CONSECUTIVE_OFFER_LOOKUP_TIMEOUT_MS)
    const params = new URLSearchParams({ courseSlug, date, time })
    void fetch(`/api/checkin/terminal/consecutive-offer?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((offer: ConsecutiveOfferData | null) => {
        setFetchedOffer(offer)
        setResolvedKey(`${courseSlug}|${date}|${time}`)
        resetAccepted()
        resetAddedCents()
        resetChoice()
      })
      .catch((error) => {
        if (!timedOut && error instanceof DOMException && error.name === "AbortError") return
        setFetchedOffer(null)
        setResolvedKey(`${courseSlug}|${date}|${time}`)
        resetAccepted()
        resetAddedCents()
        resetChoice()
      })
      .finally(() => clearTimeout(timeoutId))

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [consecutiveOffer, courseSlug, date, enabled, resetAccepted, resetAddedCents, resetChoice, time])

  return { fetchedOffer, offerLoading }
}
