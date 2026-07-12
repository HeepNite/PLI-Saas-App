import React from "react"
import { AddPackageState, DuplicateActivePackage } from "./types"

type UseAddPackageGrantArgs = {
  studentId: string
  onGranted?: () => void
}

type SubmitOverrides = {
  confirmDuplicate?: boolean
}

/**
 * Converts a date-only string (e.g. "2026-07-12" from `<input type="date">`)
 * into an ISO timestamp at the END of that day in the STAFF MEMBER'S LOCAL
 * TIME ZONE. Appending "T23:59:59" makes `new Date(...)` parse it as local
 * time instead of UTC midnight — critical for studios west of UTC (e.g.
 * America/New_York), where a same-day date parsed as UTC midnight can
 * already be in the past by the time it reaches the server, tripping the
 * `expiresAt must be in the future` validation for a genuinely future date.
 */
function endOfLocalDayIso(dateOnly: string): string {
  return new Date(`${dateOnly}T23:59:59`).toISOString()
}

/**
 * Owns the "grant a cash package" flow: plan/expiry/reason selection, the
 * per-attempt idempotency key, submit, and the duplicate-active-package
 * warn-and-confirm round trip against `POST /api/staff/students/[userId]/packages`.
 */
export function useAddPackageGrant({ studentId, onGranted }: UseAddPackageGrantArgs) {
  const [selectedPlanId, setSelectedPlanId] = React.useState("")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [state, setState] = React.useState<AddPackageState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [duplicate, setDuplicate] = React.useState<DuplicateActivePackage | null>(null)
  const [grantedPurchaseId, setGrantedPurchaseId] = React.useState<string | null>(null)

  // Stable for the lifetime of a single "attempt" (initial submit + any
  // duplicate-confirm resubmit of the SAME intent). Regenerated only when the
  // staff member starts a fresh attempt (field change after success/reset).
  const idempotencyKeyRef = React.useRef<string | null>(null)

  // Ref-based in-flight guard: `state` is only committed via React's async
  // state update, so a synchronous double-invoke of `submit` (double-click,
  // duplicate effect fire) within the same tick would still see the stale
  // "idle" state and both branches would proceed. A ref is written
  // synchronously and immediately visible to the second call.
  const isSubmittingRef = React.useRef(false)

  const ensureIdempotencyKey = React.useCallback(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID()
    }
    return idempotencyKeyRef.current
  }, [])

  const resetAttempt = React.useCallback(() => {
    idempotencyKeyRef.current = null
    // Deliberately do NOT touch `isSubmittingRef` here. It is the single
    // source of truth for "a request is currently in flight" and is only
    // ever written by `submit` itself (set on send, cleared in `finally`
    // once that request settles). If a field setter
    // (updateSelectedPlanId/updateExpiresAt/updateReason) cleared it via
    // this function while a PREVIOUS submit's fetch was still running, a
    // subsequent `submit()` could fire a SECOND in-flight fetch with a
    // DIFFERENT idempotency key before the first settles — the server can't
    // dedup two different keys, so that's a potential double purchase.
    // Reading React `state` here instead would work too, but would make
    // this callback's identity change on every state transition, which
    // cascades into every effect that depends on `reset`/`resetAttempt`
    // (e.g. remounting on studentId/open) re-firing on every keystroke.
    setState("idle")
    setErrorMessage(null)
    setDuplicate(null)
    setGrantedPurchaseId(null)
  }, [])

  const reset = React.useCallback(() => {
    setSelectedPlanId("")
    setExpiresAt("")
    setReason("")
    resetAttempt()
  }, [resetAttempt])

  const updateSelectedPlanId = React.useCallback((planId: string) => {
    setSelectedPlanId(planId)
    resetAttempt()
  }, [resetAttempt])

  const updateExpiresAt = React.useCallback((value: string) => {
    setExpiresAt(value)
    resetAttempt()
  }, [resetAttempt])

  const updateReason = React.useCallback((value: string) => {
    setReason(value)
    resetAttempt()
  }, [resetAttempt])

  const submit = React.useCallback(
    async (overrides: SubmitOverrides = {}) => {
      // Re-entrancy guard: a fast double-invoke (double-click, duplicate
      // effect fire, etc.) must not fire two overlapping requests.
      if (isSubmittingRef.current) return

      if (!selectedPlanId) {
        setErrorMessage("Select a package plan.")
        return
      }
      if (!reason.trim()) {
        setErrorMessage("Reason is required.")
        return
      }

      const idempotencyKey = ensureIdempotencyKey()

      isSubmittingRef.current = true
      setState("submitting")
      setErrorMessage(null)

      try {
        const res = await fetch(`/api/staff/students/${encodeURIComponent(studentId)}/packages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packagePlanId: selectedPlanId,
            reason: reason.trim(),
            ...(expiresAt ? { expiresAt: endOfLocalDayIso(expiresAt) } : {}),
            idempotencyKey,
            confirmDuplicate: overrides.confirmDuplicate === true,
          }),
        })

        const data = await res.json().catch(() => ({ error: "Unknown error" }))

        // Stale-response guard: if the field changed (and thus the
        // idempotency key was regenerated) while this request was in
        // flight, this response belongs to an abandoned attempt. Bail out
        // without touching state so it can't clobber fresher UI state.
        // `isSubmittingRef` is still released for this attempt in `finally`
        // below (see comment there) so a fresh submit isn't locked out.
        if (idempotencyKeyRef.current !== idempotencyKey) return

        if (res.status === 409 && data?.code === "DUPLICATE_ACTIVE_PACKAGE") {
          setDuplicate(data.existing ?? null)
          setState("duplicate")
          return
        }

        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            setErrorMessage("You don't have permission to grant packages.")
          } else if (res.status === 404) {
            setErrorMessage(data.error || "Package plan or student not found.")
          } else if (res.status === 400) {
            setErrorMessage(data.error || "Invalid request. Please check the plan and expiry.")
          } else {
            setErrorMessage(data.error || "An unexpected error occurred.")
          }
          setState("error")
          return
        }

        setGrantedPurchaseId(data?.data?.purchaseId ?? null)
        setState("success")
        onGranted?.()
      } catch (err) {
        if (idempotencyKeyRef.current !== idempotencyKey) return
        setErrorMessage(err instanceof Error ? err.message : "Network error. Please try again.")
        setState("error")
      } finally {
        // Always release the ref for THIS attempt once its request settles,
        // even if it was abandoned (idempotencyKeyRef.current no longer
        // matches, because `resetAttempt` intentionally leaves the ref
        // untouched while a request is in flight — see `resetAttempt`).
        // Without this, an abandoned attempt would permanently lock out
        // all future submits.
        isSubmittingRef.current = false
      }
    },
    [selectedPlanId, reason, expiresAt, studentId, ensureIdempotencyKey, onGranted]
  )

  const confirmDuplicateAndResubmit = React.useCallback(() => {
    void submit({ confirmDuplicate: true })
  }, [submit])

  const triggerSubmit = React.useCallback(() => {
    void submit()
  }, [submit])

  return React.useMemo(
    () => ({
      selectedPlanId,
      expiresAt,
      reason,
      state,
      errorMessage,
      duplicate,
      grantedPurchaseId,
      setSelectedPlanId: updateSelectedPlanId,
      setExpiresAt: updateExpiresAt,
      setReason: updateReason,
      submit: triggerSubmit,
      confirmDuplicateAndResubmit,
      reset,
    }),
    [
      selectedPlanId,
      expiresAt,
      reason,
      state,
      errorMessage,
      duplicate,
      grantedPurchaseId,
      updateSelectedPlanId,
      updateExpiresAt,
      updateReason,
      triggerSubmit,
      confirmDuplicateAndResubmit,
      reset,
    ]
  )
}
