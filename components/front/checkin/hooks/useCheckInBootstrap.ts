import React from "react"

import { requestCheckInBootstrapApi } from "@/lib/checkin/checkin-qr-api"
import type { BootstrapResponse, ConsecutiveOffer } from "@/components/front/checkin/checkin.types"

type UseCheckInBootstrapOptions = {
  contextIsValid: boolean
  contextPayload: Record<string, unknown>
  getToken: (options: { skipCache: boolean }) => Promise<string | null>
  hasActiveClerkSession: boolean
  kioskPinSessionToken: string
  photoFlowContext: string
  setError: (value: string | null) => void
  setConsecutiveOffer: (value: ConsecutiveOffer | null) => void
  setShowConsecutiveOverlay: (value: boolean) => void
  setShowConsecutivePaymentSelection: (value: boolean) => void
  requestBootstrap?: typeof requestCheckInBootstrapApi
}

const hasUsablePackage = (data: Partial<BootstrapResponse> | null | undefined) =>
  Boolean(
    data?.package &&
      ((data.package.isUnlimited && data.package.remainingCredits == null) ||
        (data.package.remainingCredits ?? 0) > 0)
  )

export function useCheckInBootstrap({
  contextIsValid,
  contextPayload,
  getToken,
  hasActiveClerkSession,
  kioskPinSessionToken,
  photoFlowContext,
  setError,
  setConsecutiveOffer,
  setShowConsecutiveOverlay,
  setShowConsecutivePaymentSelection,
  requestBootstrap = requestCheckInBootstrapApi,
}: UseCheckInBootstrapOptions) {
  const [loadingBootstrap, setLoadingBootstrap] = React.useState(false)
  const [bootstrap, setBootstrap] = React.useState<BootstrapResponse | null>(null)

  const loadBootstrap = React.useCallback(async () => {
    if (!contextIsValid) return
    if (!hasActiveClerkSession && !kioskPinSessionToken) return
    setLoadingBootstrap(true)
    setError(null)
    try {
      const token = await getToken({ skipCache: true })
      const { res, data } = await requestBootstrap({
        token,
        payload: {
          ...contextPayload,
          flowContext: photoFlowContext,
          ...(kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
        },
      })
      if (!res.ok) {
        setBootstrap(null)
        setError(typeof data?.error === "string" ? data.error : null)
        return
      }

      const nextBootstrap = data as BootstrapResponse
      setBootstrap(nextBootstrap)
      if (hasUsablePackage(nextBootstrap) && nextBootstrap.consecutiveOffer) {
        setConsecutiveOffer(nextBootstrap.consecutiveOffer)
      } else if (!hasUsablePackage(nextBootstrap)) {
        // No-credit / no-package customers should not see the consecutive
        // overlay, but the terminal prefetch offer must remain available for
        // the EnrollModal purchase/drop-in flow.
        setShowConsecutiveOverlay(false)
        setShowConsecutivePaymentSelection(false)
      }
    } catch {
      setBootstrap(null)
      setError(null)
    } finally {
      setLoadingBootstrap(false)
    }
  }, [contextIsValid, contextPayload, getToken, hasActiveClerkSession, kioskPinSessionToken, photoFlowContext, requestBootstrap, setConsecutiveOffer, setError, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection])

  return {
    bootstrap,
    loadingBootstrap,
    setBootstrap,
    loadBootstrap,
  }
}
