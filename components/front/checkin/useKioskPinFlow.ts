"use client"

import React from "react"

// Shape returned by POST /api/checkin/phone/identify
type KioskPhoneIdentifySuccess = {
  identified: true
  userId?: string
  credentialKind: string
  requiresPinRotation: false
  sessionToken: string
  sessionExpiresAt: string
}

type KioskPhoneIdentifyFailure = {
  identified: false
  message?: string
}

type KioskPhoneIdentifyError = {
  error?: string
  message?: string
  severity?: "normal" | "warning" | "cooldown" | "emergency"
  blockedUntil?: string | null
  attemptsRemaining?: number
}

type UseKioskPinFlowParams<TBootstrap> = {
  isKioskTerminalFlow: boolean
  setBootstrap: React.Dispatch<React.SetStateAction<TBootstrap | null>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setSuccess: React.Dispatch<React.SetStateAction<string | null>>
}

export const useKioskPinFlow = <TBootstrap,>({
  isKioskTerminalFlow,
  setBootstrap,
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
      const res = await fetch("/api/checkin/phone/identify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ phone: kioskPhone }),
      })
      const data = (await res.json().catch(() => null)) as
        | KioskPhoneIdentifyFailure
        | KioskPhoneIdentifySuccess
        | KioskPhoneIdentifyError
        | null

      if (!res.ok) {
        const failure = data && "identified" in data && !data.identified ? (data as KioskPhoneIdentifyFailure) : null
        const errorPayload = data && !("identified" in data) ? (data as KioskPhoneIdentifyError) : null
        setKioskPinSessionToken("")
        setBootstrap(null)
        setKioskPinAttemptsRemaining(typeof errorPayload?.attemptsRemaining === "number" ? errorPayload.attemptsRemaining : null)
        setKioskPinBlockedUntil(typeof errorPayload?.blockedUntil === "string" ? errorPayload.blockedUntil : null)
        setKioskPinThrottleSeverity(errorPayload?.severity ?? null)
        const failureMessage = typeof failure?.message === "string" ? failure.message : null
        const errorMessage = typeof errorPayload?.message === "string" ? errorPayload.message : null
        setError(failureMessage || errorMessage || (typeof errorPayload?.error === "string" ? errorPayload.error : "Unable to identify this phone number."))
        return
      }

      if (!data || !("identified" in data) || !data.identified) {
        setError("We couldn't find an account with that phone number. Please try again.")
        return
      }

      const successData = data as KioskPhoneIdentifySuccess
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
  }, [isKioskTerminalFlow, kioskPhone, setBootstrap, setError, setSuccess])

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
