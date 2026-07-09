import React from "react"

import { requestPackageCheckInApi } from "@/lib/checkin/checkin-qr-api"
import {
  backoffDelays,
  classifyPackageCheckInFailure,
  isRetryablePackageFailure,
  resolvePackageSuccessDoneAction,
  PACKAGE_CHECK_IN_MAX_ATTEMPTS,
  type PackageCheckInFailure,
  type PackageCheckInOutcome,
} from "@/lib/checkin/existing-customer-flow"
import type { BootstrapResponse } from "@/components/front/checkin/checkin.types"

export type PackageCheckInResult = {
  attendanceId?: string | null
  remainingCredits: number | null
  points: number
}

type RequestPackageCheckIn = typeof requestPackageCheckInApi

type UseCheckInPackageFlowOptions = {
  bootstrap: BootstrapResponse | null
  getToken: (options: { skipCache: boolean }) => Promise<string | null>
  hasActiveClerkSession: boolean
  kioskPinSessionToken: string
  effectiveCheckInWindowOpen: boolean
  photoFlowContext: string
  isKioskTerminalFlow: boolean
  setProcessingPackageCheckIn: (value: boolean) => void
  awaitingConsecutivePaymentSelection: boolean
  setError: (value: string | null) => void
  setSuccess: (value: string | null) => void
  loadBootstrap: () => Promise<void>
  checkConsecutiveOfferAfterCheckIn: () => Promise<boolean>
  handleStationCompletion: () => void | Promise<void>
  setAwaitingConsecutivePaymentSelection: (value: boolean) => void
  setShowConsecutiveOverlay: (value: boolean) => void
  setShowConsecutivePaymentSelection: (value: boolean) => void
  requestPackageCheckIn?: RequestPackageCheckIn
}

const isAbortError = (error: unknown): boolean =>
  Boolean(error && typeof error === "object" && "name" in error && (error as { name?: unknown }).name === "AbortError")

export function useCheckInPackageFlow({
  bootstrap,
  getToken,
  hasActiveClerkSession,
  kioskPinSessionToken,
  effectiveCheckInWindowOpen,
  photoFlowContext,
  isKioskTerminalFlow,
  setProcessingPackageCheckIn,
  awaitingConsecutivePaymentSelection,
  setError,
  setSuccess,
  loadBootstrap,
  checkConsecutiveOfferAfterCheckIn,
  handleStationCompletion,
  setAwaitingConsecutivePaymentSelection,
  setShowConsecutiveOverlay,
  setShowConsecutivePaymentSelection,
  requestPackageCheckIn = requestPackageCheckInApi,
}: UseCheckInPackageFlowOptions) {
  const [packageCheckInResult, setPackageCheckInResult] = React.useState<PackageCheckInResult | null>(null)
  const [packageCheckInFailure, setPackageCheckInFailure] = React.useState<PackageCheckInFailure | null>(null)
  const [packageCheckInAttempts, setPackageCheckInAttempts] = React.useState(0)
  const [retryBackoffActive, setRetryBackoffActive] = React.useState(false)
  const packageCheckInBackoffTimeoutRef = React.useRef<number | null>(null)

  // Bumped every time an in-flight (or about-to-schedule) package check-in
  // request must be invalidated: unmount, station reset, non-kiosk dismiss,
  // or a manual Retry. `handlePackageCheckIn` captures the generation before
  // awaiting the API call and re-checks it afterwards (and inside the backoff
  // timer callback) so a stale request's continuation can never write shared
  // state for a customer session that has already moved on.
  const packageCheckInGenerationRef = React.useRef(0)

  const clearPackageCheckInBackoff = React.useCallback(() => {
    packageCheckInGenerationRef.current += 1
    if (packageCheckInBackoffTimeoutRef.current !== null) {
      window.clearTimeout(packageCheckInBackoffTimeoutRef.current)
      packageCheckInBackoffTimeoutRef.current = null
    }
    setRetryBackoffActive(false)
  }, [])

  const completeStationPackageFlow = React.useCallback(() => {
    void handleStationCompletion()
    setPackageCheckInResult(null)
  }, [handleStationCompletion])

  // Mirrors handlePackageCheckIn's own pre-flight guards below (bootstrap,
  // session, package, window). Kept as a SEPARATE set of guards — never
  // null, always a typed failure — so the other two callers of this
  // function (useConsecutiveOfferActions.ts's accept/decline pre-checkin
  // branches) can discriminate the union the same way `handlePackageCheckIn`
  // does, without relying on handlePackageCheckIn's own early returns.
  const performPackageCheckInApi = React.useCallback(async (): Promise<PackageCheckInOutcome> => {
    if (!bootstrap) {
      return { kind: "client_precondition", message: "Sign in first to complete package check-in." }
    }
    if (!hasActiveClerkSession && !kioskPinSessionToken) {
      return { kind: "client_precondition", message: "Sign in first to complete package check-in." }
    }
    if (!bootstrap.package) {
      return { kind: "client_precondition", message: "No active package available for this class." }
    }
    if (!effectiveCheckInWindowOpen) {
      return { kind: "closed_window", message: "The check-in window for this class is closed." }
    }

    try {
      const token = await getToken({ skipCache: true })
      const { res, data } = await requestPackageCheckIn({
        token,
        payload: {
          courseSlug: bootstrap.context.courseSlug,
          date: bootstrap.context.date,
          time: bootstrap.context.time,
          durationMinutes: bootstrap.context.durationMinutes,
          flowContext: photoFlowContext,
          ...(kioskPinSessionToken ? { kioskSessionToken: kioskPinSessionToken } : {}),
        },
      })
      if (!res.ok) {
        return classifyPackageCheckInFailure({
          kind: "http",
          status: res.status,
          body: data,
          retryAfterHeader: res.headers?.get("Retry-After") ?? null,
        })
      }

      return {
        remainingCredits: data?.package && typeof data.package.remainingCredits === "number" ? data.package.remainingCredits : null,
        attendanceId: typeof data?.attendance?.id === "string" ? data.attendance.id : null,
        points: typeof data?.points?.awarded === "number" ? data.points.awarded : 0,
      }
    } catch (error) {
      return classifyPackageCheckInFailure(isAbortError(error) ? { kind: "timeout" } : { kind: "network" })
    }
  }, [bootstrap, effectiveCheckInWindowOpen, getToken, hasActiveClerkSession, kioskPinSessionToken, photoFlowContext, requestPackageCheckIn])

  // Routes a terminal (non-retryable, or retry-budget-exhausted) failure to
  // the right surface. Kiosk: records the terminal failure state —
  // `KioskPackageCheckInFailureOverlay` is the sole kiosk failure surface
  // (PR3; the PR2-era transient `setError` parity call was removed here).
  // Non-kiosk: transient inline error only — never touches kiosk-only state.
  const applyKioskOrNonKioskFailure = React.useCallback((failure: PackageCheckInFailure) => {
    if (isKioskTerminalFlow) {
      setPackageCheckInFailure(failure)
      return
    }
    setError(failure.message)
  }, [isKioskTerminalFlow, setError])

  const handlePackageCheckIn = React.useCallback(async () => {
    // Captured before any `await` so the continuation below can detect a
    // session reset/dismiss/manual-retry that happened while the request was
    // in flight (see `packageCheckInGenerationRef` above) and bail out
    // without writing state that belongs to a customer session that's gone.
    const generation = packageCheckInGenerationRef.current

    // Defensive re-entrancy guard: the auto-trigger effect's own gate
    // already blocks firing while a backoff is pending or a terminal
    // failure was recorded, but this protects direct callers (e.g. a
    // stale-closure re-invoke) from double-processing on the kiosk path.
    if (isKioskTerminalFlow && (retryBackoffActive || packageCheckInFailure)) return

    if (!bootstrap) {
      applyKioskOrNonKioskFailure({ kind: "client_precondition", message: "Sign in first to complete package check-in." })
      return
    }
    if (!hasActiveClerkSession && !kioskPinSessionToken) {
      applyKioskOrNonKioskFailure({ kind: "client_precondition", message: "Sign in first to complete package check-in." })
      return
    }
    if (!bootstrap.package) {
      applyKioskOrNonKioskFailure({ kind: "client_precondition", message: "No active package available for this class." })
      return
    }
    if (!effectiveCheckInWindowOpen) {
      applyKioskOrNonKioskFailure({ kind: "closed_window", message: "The check-in window for this class is closed." })
      return
    }

    setProcessingPackageCheckIn(true)
    setError(null)
    setSuccess(null)

    const outcome = await performPackageCheckInApi()

    // The customer session that started this request is gone (station
    // reset, non-kiosk dismiss, unmount, or a manual Retry) — discard the
    // result silently. Writing state or scheduling a backoff here would leak
    // this request's outcome into whatever session is active now. Still
    // release the processing flag: it has no other owner on this discarded
    // path, and leaving it `true` would permanently block every future
    // package check-in on this persistently-mounted kiosk.
    if (packageCheckInGenerationRef.current !== generation) {
      setProcessingPackageCheckIn(false)
      return
    }

    if ("kind" in outcome) {
      setProcessingPackageCheckIn(false)

      if (!isKioskTerminalFlow) {
        setError(outcome.message)
        return
      }

      const canScheduleRetry =
        isRetryablePackageFailure(outcome.kind) && packageCheckInAttempts + 1 < PACKAGE_CHECK_IN_MAX_ATTEMPTS

      if (canScheduleRetry) {
        setRetryBackoffActive(true)
        const delayMs = outcome.retryAfterMs ?? backoffDelays[packageCheckInAttempts] ?? backoffDelays[backoffDelays.length - 1]
        packageCheckInBackoffTimeoutRef.current = window.setTimeout(() => {
          packageCheckInBackoffTimeoutRef.current = null
          // Same staleness guard as above: a reset/dismiss/manual-retry that
          // happened during the backoff window already bumped the
          // generation (via `clearPackageCheckInBackoff`), so this callback
          // must not resurrect retry state for a session that's gone. Still
          // release the processing flag for the same reason as above.
          if (packageCheckInGenerationRef.current !== generation) {
            setProcessingPackageCheckIn(false)
            return
          }
          setRetryBackoffActive(false)
          setPackageCheckInAttempts((prev) => prev + 1)
        }, delayMs)
        return
      }

      // Retry budget exhausted or non-retryable — terminal, no further
      // backoff. Neither setter fires on the backoff-scheduled branch above.
      // Kiosk-only branch (non-kiosk already returned above) — no `setError`
      // here: `KioskPackageCheckInFailureOverlay` is the sole kiosk surface.
      setPackageCheckInFailure(outcome)
      return
    }

    if (isKioskTerminalFlow) {
      setPackageCheckInResult(outcome)
      setProcessingPackageCheckIn(false)
      void checkConsecutiveOfferAfterCheckIn()
      return
    }

    const successParts = ["Package check-in completed."]
    if (outcome.remainingCredits !== null) successParts.push(`Remaining credits: ${outcome.remainingCredits}.`)
    if (outcome.points > 0) successParts.push(`Points earned: +${outcome.points}.`)
    setSuccess(successParts.join(" "))
    await loadBootstrap()
    setProcessingPackageCheckIn(false)
  }, [
    applyKioskOrNonKioskFailure,
    bootstrap,
    checkConsecutiveOfferAfterCheckIn,
    effectiveCheckInWindowOpen,
    hasActiveClerkSession,
    isKioskTerminalFlow,
    kioskPinSessionToken,
    loadBootstrap,
    packageCheckInAttempts,
    packageCheckInFailure,
    performPackageCheckInApi,
    retryBackoffActive,
    setError,
    setProcessingPackageCheckIn,
    setSuccess,
  ])

  // Manual Retry only clears state — it does NOT call handlePackageCheckIn
  // directly. Clearing packageCheckInFailure/packageCheckInAttempts makes
  // shouldAutoTriggerPackageCheckIn re-evaluate true, and the auto-trigger
  // EFFECT (not this click handler) performs the actual re-attempt. This
  // avoids a stale-closure double-invoke race between a direct call here
  // and the effect firing on the same state change. Kiosk-only.
  const handleRetryPackageCheckIn = React.useCallback(() => {
    clearPackageCheckInBackoff()
    setPackageCheckInFailure(null)
    setPackageCheckInAttempts(0)
  }, [clearPackageCheckInBackoff])

  const handlePackageSuccessDone = React.useCallback(() => {
    const action = resolvePackageSuccessDoneAction({ awaitingConsecutivePaymentSelection })
    if (action === "open-payment-selection") {
      setAwaitingConsecutivePaymentSelection(false)
      setPackageCheckInResult(null)
      setShowConsecutiveOverlay(true)
      setShowConsecutivePaymentSelection(true)
      return
    }
    completeStationPackageFlow()
  }, [awaitingConsecutivePaymentSelection, completeStationPackageFlow, setAwaitingConsecutivePaymentSelection, setShowConsecutiveOverlay, setShowConsecutivePaymentSelection])

  React.useEffect(() => clearPackageCheckInBackoff, [clearPackageCheckInBackoff])

  return {
    packageCheckInResult,
    setPackageCheckInResult,
    packageCheckInFailure,
    setPackageCheckInFailure,
    packageCheckInAttempts,
    setPackageCheckInAttempts,
    retryBackoffActive,
    clearPackageCheckInBackoff,
    performPackageCheckInApi,
    handlePackageCheckIn,
    handlePackageSuccessDone,
    handleRetryPackageCheckIn,
  }
}
