"use client"

import React from "react"
import type {
  KioskPinField,
  KioskPinIdentifyError,
  KioskPinIdentifyFailure,
  KioskPinIdentifySuccess,
  KioskPinRotationMode,
} from "@/components/front/checkin/checkin-kiosk.types"

import type { KioskPinThrottleSeverity } from "@/lib/security/kiosk-pin-throttle"
import {
  getActivePinSlotIndex,
  getKioskPinIdentifySuccessMessage,
  getKioskPinPanelCopy,
  resolveActiveKioskPinField,
  resolveKioskPinRotationMode,
} from "@/lib/checkin/kiosk-pin-policy"

// Shape returned by POST /api/checkin/phone/identify (same envelope as pin/identify)
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

// Merged identify+bootstrap endpoint response shapes
type MergedIdentifyResponse = {
  identified: true
  path: "fast" | "full"
  sessionToken: string
  sessionExpiresAt: string
  [key: string]: unknown
}

const PIN_LAST_DIGIT_REVEAL_MS = 700

type BootstrapContextPayload = {
  courseSlug?: string
  date?: string
  time?: string
  durationMinutes?: number
  linkedFromCourseSlug?: string
} | null

type UseKioskPinFlowParams<TBootstrap> = {
  isKioskTerminalFlow: boolean
  setBootstrap: React.Dispatch<React.SetStateAction<TBootstrap | null>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setSuccess: React.Dispatch<React.SetStateAction<string | null>>
  pinLastDigitRevealMs?: number
  /** Class context to send with the merged phone identify+bootstrap request */
  bootstrapContextPayload?: BootstrapContextPayload
}

export const useKioskPinFlow = <TBootstrap,>({
  isKioskTerminalFlow,
  setBootstrap,
  setError,
  setSuccess,
  pinLastDigitRevealMs = PIN_LAST_DIGIT_REVEAL_MS,
  bootstrapContextPayload = null,
}: UseKioskPinFlowParams<TBootstrap>) => {
  const [kioskPhone, setKioskPhone] = React.useState("")
  const [kioskPhoneLoading, setKioskPhoneLoading] = React.useState(false)
  const [bootstrapFromPhone, setBootstrapFromPhone] = React.useState(false)
  const [kioskPin, setKioskPin] = React.useState("")
  const [kioskPinSessionToken, setKioskPinSessionToken] = React.useState("")
  const [kioskPinLoading, setKioskPinLoading] = React.useState(false)
  const [kioskPinRotationRequired, setKioskPinRotationRequired] = React.useState(false)
  const [kioskPinRotationMode, setKioskPinRotationMode] = React.useState<KioskPinRotationMode | null>(null)
  const [kioskPinNext, setKioskPinNext] = React.useState("")
  const [kioskPinConfirm, setKioskPinConfirm] = React.useState("")
  const [kioskPinRotating, setKioskPinRotating] = React.useState(false)
  const [kioskPinAttemptsRemaining, setKioskPinAttemptsRemaining] = React.useState<number | null>(null)
  const [kioskPinBlockedUntil, setKioskPinBlockedUntil] = React.useState<string | null>(null)
  const [kioskPinThrottleSeverity, setKioskPinThrottleSeverity] = React.useState<KioskPinThrottleSeverity | null>(null)
  const [pinReveal, setPinReveal] = React.useState<null | { field: KioskPinField; index: number }>(null)
  const pinRevealTimeoutRef = React.useRef<number | null>(null)

  const hasKioskPinSession = Boolean(kioskPinSessionToken)
  const activePinField = resolveActiveKioskPinField({ hasKioskPinSession, nextPin: kioskPinNext })
  const kioskPinPanelCopy = React.useMemo(
    () => getKioskPinPanelCopy({ hasKioskPinSession, rotationMode: kioskPinRotationMode }),
    [hasKioskPinSession, kioskPinRotationMode]
  )
  const entryActiveSlot = getActivePinSlotIndex(kioskPin)
  const nextActiveSlot = getActivePinSlotIndex(kioskPinNext)
  const confirmActiveSlot = getActivePinSlotIndex(kioskPinConfirm)
  const entryRevealedIndex = pinReveal?.field === "entry" ? pinReveal.index : null
  const nextRevealedIndex = pinReveal?.field === "next" ? pinReveal.index : null
  const confirmRevealedIndex = pinReveal?.field === "confirm" ? pinReveal.index : null
  const canIdentify = !kioskPinLoading && kioskPin.length === 4
  const canRotate = !kioskPinRotating && kioskPinNext.length === 4 && kioskPinConfirm.length === 4

  const clearPinRevealTimeout = React.useCallback(() => {
    if (pinRevealTimeoutRef.current && typeof window !== "undefined") {
      window.clearTimeout(pinRevealTimeoutRef.current)
      pinRevealTimeoutRef.current = null
    }
  }, [])

  const clearPinRevealForField = React.useCallback(
    (field: KioskPinField) => {
      clearPinRevealTimeout()
      setPinReveal((current) => (current?.field === field ? null : current))
    },
    [clearPinRevealTimeout]
  )

  const revealLastPinDigit = React.useCallback(
    (field: KioskPinField, index: number) => {
      if (typeof window === "undefined") return
      clearPinRevealTimeout()
      setPinReveal({ field, index })
      pinRevealTimeoutRef.current = window.setTimeout(() => {
        setPinReveal((current) => (current?.field === field && current.index === index ? null : current))
        pinRevealTimeoutRef.current = null
      }, pinLastDigitRevealMs)
    },
    [clearPinRevealTimeout, pinLastDigitRevealMs]
  )

  const resetKioskPinFlow = React.useCallback(() => {
    clearPinRevealTimeout()
    setPinReveal(null)
    setKioskPhone("")
    setKioskPin("")
    setKioskPinSessionToken("")
    setKioskPinLoading(false)
    setKioskPinRotationRequired(false)
    setKioskPinRotationMode(null)
    setKioskPinNext("")
    setKioskPinConfirm("")
    setKioskPinRotating(false)
    setKioskPinAttemptsRemaining(null)
    setKioskPinBlockedUntil(null)
    setKioskPinThrottleSeverity(null)
    setBootstrapFromPhone(false)
  }, [clearPinRevealTimeout])

  const handlePinDigitInput = React.useCallback(
    (digit: string) => {
      if (!hasKioskPinSession) {
        // Primary path: collect phone digits (max 10)
        setKioskPhone((current) => {
          const digits = current.replace(/\D/g, "")
          if (digits.length >= 10) return current
          return `${digits}${digit}`
        })
        setError(null)
        return
      }

      if (kioskPinNext.length < 4) {
        setKioskPinNext((current) => {
          const nextValue = `${current}${digit}`.slice(0, 4)
          if (nextValue.length > current.length) {
            revealLastPinDigit("next", nextValue.length - 1)
          }
          return nextValue
        })
      } else {
        setKioskPinConfirm((current) => {
          const nextValue = `${current}${digit}`.slice(0, 4)
          if (nextValue.length > current.length) {
            revealLastPinDigit("confirm", nextValue.length - 1)
          }
          return nextValue
        })
      }

      setError(null)
    },
    [hasKioskPinSession, kioskPinNext.length, revealLastPinDigit, setError]
  )

  const handlePinBackspace = React.useCallback(() => {
    if (!hasKioskPinSession) {
      setKioskPhone((current) => current.replace(/\D/g, "").slice(0, -1))
      setError(null)
      return
    }

    if (kioskPinConfirm.length > 0) {
      setKioskPinConfirm((current) => current.slice(0, -1))
      clearPinRevealForField("confirm")
    } else {
      setKioskPinNext((current) => current.slice(0, -1))
      clearPinRevealForField("next")
    }

    setError(null)
  }, [clearPinRevealForField, hasKioskPinSession, kioskPinConfirm.length, setError])

  const handlePinClear = React.useCallback(() => {
    if (!hasKioskPinSession) {
      setKioskPhone("")
      setError(null)
      return
    }

    if (kioskPinConfirm.length > 0) {
      setKioskPinConfirm("")
      clearPinRevealForField("confirm")
    } else {
      setKioskPinNext("")
      clearPinRevealForField("next")
    }

    setError(null)
  }, [clearPinRevealForField, hasKioskPinSession, kioskPinConfirm.length, setError])

  const handleKioskPinIdentify = React.useCallback(async () => {
    if (!isKioskTerminalFlow) return
    setKioskPinLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/checkin/pin/identify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ pin: kioskPin }),
      })
      const data = (await res.json().catch(() => null)) as
        | KioskPinIdentifyFailure
        | KioskPinIdentifySuccess
        | KioskPinIdentifyError
        | null

      if (!res.ok) {
        const failure = data && "identified" in data && !data.identified ? data : null
        const errorPayload = data && !("identified" in data) ? data : null
        setKioskPinSessionToken("")
        setKioskPinRotationRequired(false)
        setKioskPinRotationMode(null)
        setBootstrap(null)
        setKioskPinAttemptsRemaining(typeof failure?.attemptsRemaining === "number" ? failure.attemptsRemaining : null)
        setKioskPinBlockedUntil(typeof failure?.blockedUntil === "string" ? failure.blockedUntil : null)
        setKioskPinThrottleSeverity(failure?.severity || errorPayload?.severity || null)
        const failureMessage = typeof failure?.message === "string" ? failure.message : null
        const errorMessage = typeof errorPayload?.message === "string" ? errorPayload.message : null
        if ((failure?.requiresPinRegeneration || errorPayload?.requiresPinRegeneration) && (failureMessage || errorMessage)) {
          setError(failureMessage || errorMessage)
          return
        }
        setError(failureMessage || errorMessage || (typeof errorPayload?.error === "string" ? errorPayload.error : "Unable to identify this student PIN."))
        return
      }

      if (!data || !("identified" in data)) {
        setKioskPinAttemptsRemaining(null)
        setKioskPinBlockedUntil(null)
        setKioskPinThrottleSeverity(null)
        setError("We couldn't match that PIN. Please try again.")
        return
      }

      if (!data.identified) {
        setKioskPinAttemptsRemaining(typeof data.attemptsRemaining === "number" ? data.attemptsRemaining : null)
        setKioskPinBlockedUntil(typeof data.blockedUntil === "string" ? data.blockedUntil : null)
        setKioskPinThrottleSeverity(data.severity || null)
        setError(typeof data.message === "string" ? data.message : "We couldn't match that PIN. Please try again.")
        return
      }

      const nextRotationMode = resolveKioskPinRotationMode(data)

      setKioskPinSessionToken(data.sessionToken)
      setKioskPinRotationRequired(Boolean(data.requiresPinRotation))
      setKioskPinRotationMode(nextRotationMode)
      setKioskPinAttemptsRemaining(null)
      setKioskPinBlockedUntil(null)
      setKioskPinThrottleSeverity(null)
      setKioskPin("")

      setSuccess(
        getKioskPinIdentifySuccessMessage({
          requiresPinRotation: data.requiresPinRotation,
          rotationMode: nextRotationMode,
        })
      )
    } catch {
      setError("Unable to identify this student PIN.")
    } finally {
      setKioskPinLoading(false)
    }
  }, [isKioskTerminalFlow, kioskPin, setBootstrap, setError, setSuccess])

  const handleKioskPhoneIdentify = React.useCallback(async () => {
    if (!isKioskTerminalFlow) return
    setKioskPhoneLoading(true)
    setError(null)
    setSuccess(null)

    // Use merged endpoint when class context is available; fall back to legacy
    // identify-only endpoint if context payload is missing (defensive).
    const hasMergedContext = Boolean(
      bootstrapContextPayload?.courseSlug &&
        bootstrapContextPayload?.date &&
        bootstrapContextPayload?.time
    )

    try {
      if (hasMergedContext && bootstrapContextPayload) {
        // Merged identify+bootstrap: single round-trip
        const res = await fetch("/api/checkin/phone/identify-and-bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            phone: kioskPhone,
            courseSlug: bootstrapContextPayload.courseSlug,
            date: bootstrapContextPayload.date,
            time: bootstrapContextPayload.time,
            durationMinutes: bootstrapContextPayload.durationMinutes,
            linkedFromCourseSlug: bootstrapContextPayload.linkedFromCourseSlug,
          }),
        })
        const data = (await res.json().catch(() => null)) as MergedIdentifyResponse | KioskPhoneIdentifyError | null

        if (!res.ok) {
          const errorPayload = data && !("identified" in data) ? (data as KioskPhoneIdentifyError) : null
          const identifiedFalsePayload = data && "identified" in data && !(data as { identified: boolean }).identified ? data : null
          setKioskPinSessionToken("")
          setKioskPinRotationRequired(false)
          setKioskPinRotationMode(null)
          setBootstrap(null)
          setBootstrapFromPhone(false)
          setKioskPinAttemptsRemaining(
            typeof errorPayload?.attemptsRemaining === "number" ? errorPayload.attemptsRemaining : null
          )
          setKioskPinBlockedUntil(
            typeof errorPayload?.blockedUntil === "string" ? errorPayload.blockedUntil : null
          )
          setKioskPinThrottleSeverity(errorPayload?.severity ?? null)
          const errMsg =
            typeof (identifiedFalsePayload as Record<string, unknown> | null)?.message === "string"
              ? String((identifiedFalsePayload as Record<string, unknown>).message)
              : typeof errorPayload?.message === "string"
              ? errorPayload.message
              : typeof errorPayload?.error === "string"
              ? errorPayload.error
              : "Unable to identify this phone number."
          setError(errMsg)
          return
        }

        if (!data || !("identified" in data) || !data.identified) {
          setError("We couldn't find an account with that phone number. Please try again.")
          return
        }

        const mergedData = data as MergedIdentifyResponse
        setKioskPinSessionToken(mergedData.sessionToken)
        setKioskPinRotationRequired(false)
        setKioskPinRotationMode(null)
        setKioskPinAttemptsRemaining(null)
        setKioskPinBlockedUntil(null)
        setKioskPinThrottleSeverity(null)
        setKioskPhone("")
        // Populate bootstrap directly from the merged response — no second round-trip needed
        setBootstrap(mergedData as unknown as TBootstrap)
        setBootstrapFromPhone(true)
        setSuccess("Phone number verified.")
      } else {
        // Legacy fallback: identify only, bootstrap will load via effect
        const res = await fetch("/api/checkin/phone/identify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          setKioskPinRotationRequired(false)
          setKioskPinRotationMode(null)
          setBootstrap(null)
          setBootstrapFromPhone(false)
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
        setKioskPinRotationRequired(false)
        setKioskPinRotationMode(null)
        setKioskPinAttemptsRemaining(null)
        setKioskPinBlockedUntil(null)
        setKioskPinThrottleSeverity(null)
        setKioskPhone("")
        setBootstrapFromPhone(false)
        setSuccess("Phone number verified. Loading your purchase options...")
      }
    } catch {
      setError("Unable to identify this phone number.")
    } finally {
      setKioskPhoneLoading(false)
    }
  }, [bootstrapContextPayload, isKioskTerminalFlow, kioskPhone, setBootstrap, setError, setSuccess])

  const handleKioskPinRotate = React.useCallback(async () => {
    if (!kioskPinSessionToken) return
    setKioskPinRotating(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/checkin/pin/rotate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          sessionToken: kioskPinSessionToken,
          nextPin: kioskPinNext,
          confirmPin: kioskPinConfirm,
        }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Unable to rotate this student PIN.")
        return
      }

      setKioskPinRotationRequired(false)
      setKioskPinRotationMode(null)
      setKioskPinNext("")
      setKioskPinConfirm("")
      setSuccess("PIN updated. Loading your purchase options...")
    } catch {
      setError("Unable to rotate this student PIN.")
    } finally {
      setKioskPinRotating(false)
    }
  }, [kioskPinConfirm, kioskPinNext, kioskPinSessionToken, setError, setSuccess])

  React.useEffect(
    () => () => {
      clearPinRevealTimeout()
    },
    [clearPinRevealTimeout]
  )

  return {
    activePinField,
    bootstrapFromPhone,
    canIdentify,
    canRotate,
    confirmActiveSlot,
    confirmRevealedIndex,
    entryActiveSlot,
    entryRevealedIndex,
    handleKioskPhoneIdentify,
    handleKioskPinIdentify,
    handleKioskPinRotate,
    kioskPhone,
    kioskPhoneLoading,
    setKioskPhone,
    handlePinBackspace,
    handlePinClear,
    handlePinDigitInput,
    hasKioskPinSession,
    kioskPin,
    kioskPinAttemptsRemaining,
    kioskPinBlockedUntil,
    kioskPinThrottleSeverity,
    kioskPinConfirm,
    kioskPinLoading,
    kioskPinNext,
    kioskPinPanelCopy,
    kioskPinRotating,
    kioskPinRotationMode,
    kioskPinRotationRequired,
    kioskPinSessionToken,
    nextActiveSlot,
    nextRevealedIndex,
    resetKioskPinFlow,
    setKioskPin,
    setKioskPinAttemptsRemaining,
    setKioskPinBlockedUntil,
    setKioskPinThrottleSeverity,
    setKioskPinConfirm,
    setKioskPinNext,
    setKioskPinRotationMode,
    setKioskPinRotationRequired,
    setKioskPinSessionToken,
  }
}
