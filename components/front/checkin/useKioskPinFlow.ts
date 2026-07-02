"use client"

import React from "react"
import type { BootstrapResponse, ConsecutiveOffer } from "@/components/front/checkin/checkin.types"
import type { IdentifyAndBootstrapResponse } from "@/lib/checkin/types/identify-and-bootstrap"

// Error shape returned when identify-and-bootstrap fails (non-2xx)
type IdentifyAndBootstrapError = {
  identified?: false
  error?: string
  message?: string
  severity?: "normal" | "warning" | "cooldown" | "emergency"
  blockedUntil?: string | null
  attemptsRemaining?: number
}

/**
 * Maps the merged identify-and-bootstrap response to the BootstrapResponse
 * shape expected by the rest of the check-in UI. Both `fast` and `full` paths
 * carry the same core fields; the fast path omits Clerk-specific customer
 * fields, so we fill them with safe defaults.
 */
function mapIdentifyAndBootstrapToBootstrap(
  data: IdentifyAndBootstrapResponse
): BootstrapResponse {
  const isFullPath = data.path === "full"

  return {
    context: data.context,
    customer: {
      userId: data.customer.userId,
      clerkUserId: isFullPath ? (data as { customer: { clerkUserId: string } }).customer.clerkUserId : "",
      firstName: isFullPath ? (data as { customer: { firstName: string } }).customer.firstName : "",
      lastName: isFullPath ? (data as { customer: { lastName: string } }).customer.lastName : "",
      name: data.customer.name,
      email: data.customer.email,
      phone: data.customer.phone,
      hasAvatar: isFullPath ? (data as { customer: { hasAvatar: boolean } }).customer.hasAvatar : false,
    },
    package: data.package
      ? {
          id: data.package.id,
          packageId: data.package.packageId,
          packageLabel: data.package.packageLabel,
          isUnlimited: data.package.isUnlimited,
          remainingCredits: data.package.remainingCredits,
          expiresAt: data.package.expiresAt,
          status: data.package.status,
        }
      : null,
    // The merged endpoint does not return a full packages list or purchase
    // history — those are not needed for the kiosk phone flow.
    packages: [],
    purchaseHistory: [],
    hasPreviousPurchase: false,
    hasAnyCompletedPurchase: false,
    hasExistingPurchaseForSession: data.hasExistingPurchaseForSession,
    hasAnyActivePackage: data.hasAnyActivePackage,
    consecutiveOffer: data.consecutiveOffer ?? null,
    quickCheckout: data.quickCheckout ?? null,
  }
}

type UseKioskPinFlowParams<TBootstrap> = {
  isKioskTerminalFlow: boolean
  /** Class context fields forwarded to the merged endpoint. */
  contextPayload: {
    courseSlug?: string
    date?: string
    time?: string
    durationMinutes?: number
    linkedFromCourseSlug?: string
  }
  setBootstrap: React.Dispatch<React.SetStateAction<TBootstrap | null>>
  setConsecutiveOffer: (value: ConsecutiveOffer | null) => void
  setShowConsecutiveOverlay: (value: boolean) => void
  setShowConsecutivePaymentSelection: (value: boolean) => void
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setSuccess: React.Dispatch<React.SetStateAction<string | null>>
}

export const useKioskPinFlow = <TBootstrap,>({
  isKioskTerminalFlow,
  contextPayload,
  setBootstrap,
  setConsecutiveOffer,
  setShowConsecutiveOverlay,
  setShowConsecutivePaymentSelection,
  setError,
  setSuccess,
}: UseKioskPinFlowParams<TBootstrap>) => {
  const [kioskPhone, setKioskPhone] = React.useState("")
  const [kioskPhoneLoading, setKioskPhoneLoading] = React.useState(false)
  const [kioskPinSessionToken, setKioskPinSessionToken] = React.useState("")
  const [kioskPinAttemptsRemaining, setKioskPinAttemptsRemaining] = React.useState<number | null>(null)
  const [kioskPinBlockedUntil, setKioskPinBlockedUntil] = React.useState<string | null>(null)
  const [kioskPinThrottleSeverity, setKioskPinThrottleSeverity] = React.useState<"normal" | "warning" | "cooldown" | "emergency" | null>(null)

  const hasKioskPinSession = Boolean(kioskPinSessionToken)

  const resetKioskPinFlow = React.useCallback(() => {
    setKioskPhone("")
    setKioskPhoneLoading(false)
    setKioskPinSessionToken("")
    setKioskPinAttemptsRemaining(null)
    setKioskPinBlockedUntil(null)
    setKioskPinThrottleSeverity(null)
  }, [])

  const handlePinDigitInput = React.useCallback(
    (digit: string) => {
      // Phone digit collection (max 10 digits)
      setKioskPhone((current) => {
        const digits = current.replace(/\D/g, "")
        if (digits.length >= 10) return current
        return `${digits}${digit}`
      })
      setError(null)
    },
    [setError]
  )

  const handlePinBackspace = React.useCallback(() => {
    setKioskPhone((current) => current.replace(/\D/g, "").slice(0, -1))
    setError(null)
  }, [setError])

  const handlePinClear = React.useCallback(() => {
    setKioskPhone("")
    setError(null)
  }, [setError])

  const handleKioskPhoneIdentify = React.useCallback(async () => {
    if (!isKioskTerminalFlow) return
    setKioskPhoneLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/checkin/phone/identify-and-bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          phone: kioskPhone,
          courseSlug: contextPayload.courseSlug ?? "",
          date: contextPayload.date ?? "",
          time: contextPayload.time ?? "",
          durationMinutes: contextPayload.durationMinutes,
          linkedFromCourseSlug: contextPayload.linkedFromCourseSlug,
        }),
      })
      const data = (await res.json().catch(() => null)) as IdentifyAndBootstrapResponse | IdentifyAndBootstrapError | null

      if (!res.ok) {
        const errorPayload = data as IdentifyAndBootstrapError | null
        setKioskPinSessionToken("")
        setBootstrap(null)
        setKioskPinAttemptsRemaining(typeof errorPayload?.attemptsRemaining === "number" ? errorPayload.attemptsRemaining : null)
        setKioskPinBlockedUntil(typeof errorPayload?.blockedUntil === "string" ? errorPayload.blockedUntil : null)
        setKioskPinThrottleSeverity(errorPayload?.severity ?? null)
        const errorMessage = typeof errorPayload?.message === "string" ? errorPayload.message : null
        setError(errorMessage || (typeof errorPayload?.error === "string" ? errorPayload.error : "Unable to identify this phone number."))
        return
      }

      if (!data || !("identified" in data) || !data.identified) {
        setError("We couldn't find an account with that phone number. Please try again.")
        return
      }

      const successData = data as IdentifyAndBootstrapResponse
      const bootstrapData = mapIdentifyAndBootstrapToBootstrap(successData)

      // Populate bootstrap state before setting the session token so the
      // loadBootstrap effect (which fires when kioskPinSessionToken changes)
      // sees a non-null bootstrap and skips the redundant network call.
      setBootstrap(bootstrapData as unknown as TBootstrap)

      // Mirror the same consecutive-offer side-effects that useCheckInBootstrap
      // applies when it receives bootstrap data.
      const hasUsablePackage = Boolean(
        bootstrapData.package &&
          ((bootstrapData.package.isUnlimited && bootstrapData.package.remainingCredits == null) ||
            (bootstrapData.package.remainingCredits ?? 0) > 0)
      )
      if (hasUsablePackage && bootstrapData.consecutiveOffer) {
        setConsecutiveOffer(bootstrapData.consecutiveOffer)
      } else if (!hasUsablePackage) {
        setShowConsecutiveOverlay(false)
        setShowConsecutivePaymentSelection(false)
      }

      setKioskPinSessionToken(successData.sessionToken)
      setKioskPinAttemptsRemaining(null)
      setKioskPinBlockedUntil(null)
      setKioskPinThrottleSeverity(null)
      setKioskPhone("")
      setSuccess("Phone number verified. Loading your purchase options...")
    } catch {
      setError("Unable to identify this phone number.")
    } finally {
      setKioskPhoneLoading(false)
    }
  }, [isKioskTerminalFlow, kioskPhone, contextPayload, setBootstrap, setConsecutiveOffer, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection, setError, setSuccess])

  return {
    // Phone flow
    kioskPhone,
    kioskPhoneLoading,
    setKioskPhone,
    handleKioskPhoneIdentify,
    handlePinDigitInput,
    handlePinBackspace,
    handlePinClear,

    // Session
    hasKioskPinSession,
    kioskPinSessionToken,
    setKioskPinSessionToken,

    // Throttle state (kept for shell props compatibility)
    kioskPinAttemptsRemaining,
    setKioskPinAttemptsRemaining,
    kioskPinBlockedUntil,
    setKioskPinBlockedUntil,
    kioskPinThrottleSeverity,
    setKioskPinThrottleSeverity,

    // Reset
    resetKioskPinFlow,
  }
}
