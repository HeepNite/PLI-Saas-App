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

  const ensureIdempotencyKey = React.useCallback(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID()
    }
    return idempotencyKeyRef.current
  }, [])

  const resetAttempt = React.useCallback(() => {
    idempotencyKeyRef.current = null
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
      if (!selectedPlanId) {
        setErrorMessage("Select a package plan.")
        return
      }
      if (!reason.trim()) {
        setErrorMessage("Reason is required.")
        return
      }

      const idempotencyKey = ensureIdempotencyKey()

      setState("submitting")
      setErrorMessage(null)

      try {
        const res = await fetch(`/api/staff/students/${encodeURIComponent(studentId)}/packages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packagePlanId: selectedPlanId,
            reason: reason.trim(),
            ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
            idempotencyKey,
            confirmDuplicate: overrides.confirmDuplicate === true,
          }),
        })

        const data = await res.json().catch(() => ({ error: "Unknown error" }))

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
        setErrorMessage(err instanceof Error ? err.message : "Network error. Please try again.")
        setState("error")
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
