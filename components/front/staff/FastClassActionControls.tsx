"use client"

import React from "react"
import type { FastClassActionPromoOffer, FastClassActionOptions, FastClassActionResponse } from "./studentsBoardTypes"

type FastClassActionControlsProps = {
  activePackage: { remainingCredits: number | null; isUnlimited: boolean } | null | undefined
  disabled?: boolean
  studentName: string
  userId: string | null
  onRefreshPaymentsBoard: () => void
}

const hasUsablePackageCredit = (activePackage: { remainingCredits: number | null; isUnlimited: boolean } | null | undefined) => {
  if (!activePackage) return false
  if (activePackage.isUnlimited) return true
  return typeof activePackage.remainingCredits === "number" && activePackage.remainingCredits > 0
}

const resolveFastClassActionLabel = (activePackage: { remainingCredits: number | null; isUnlimited: boolean } | null | undefined) =>
  hasUsablePackageCredit(activePackage) ? "Fast Sign" : "Fast Pay"

async function postFastClassAction(userId: string, options: FastClassActionOptions = {}) {
  const response = await fetch("/api/staff/students/fast-class-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, ...options }),
  })
  const payload = await response.json().catch(() => ({})) as FastClassActionResponse
  if (!response.ok) {
    throw new Error(payload.error || "Fast class action failed")
  }
  return payload
}

export function FastClassActionControls({
  activePackage,
  disabled = false,
  studentName,
  userId,
  onRefreshPaymentsBoard,
}: FastClassActionControlsProps) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [promoOffer, setPromoOffer] = React.useState<FastClassActionPromoOffer | null>(null)
  const label = resolveFastClassActionLabel(activePackage)
  const isDisabled = disabled || busy || !userId

  const runFastAction = async () => {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      const preview = await postFastClassAction(userId, { previewOnly: true })
      if (preview.promoOffer) {
        setPromoOffer(preview.promoOffer)
        return
      }
      const result = await postFastClassAction(userId)
      await onRefreshPaymentsBoard()
      setPromoOffer(result.promoOffer || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fast class action failed")
    } finally {
      setBusy(false)
    }
  }

  const acceptPromo = async () => {
    if (!userId || !promoOffer) return
    setBusy(true)
    setError(null)
    try {
      await postFastClassAction(userId, { includeConsecutive: true })
      setPromoOffer(null)
      await onRefreshPaymentsBoard()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promo check-in failed")
    } finally {
      setBusy(false)
    }
  }

  const declinePromo = async () => {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      await postFastClassAction(userId)
      setPromoOffer(null)
      await onRefreshPaymentsBoard()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fast class action failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={runFastAction}
        disabled={isDisabled}
        className="rounded-md border border-emerald-300/35 bg-emerald-400/12 px-2 py-1 text-[11px] font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`${label} for ${studentName}`}
      >
        {busy ? "Working…" : label}
      </button>
      {error ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`fast-action-error-title-${userId}`}
            className="w-full max-w-sm rounded-2xl border border-[var(--brand,#b61616)]/45 bg-[#131622] p-5 text-white shadow-[0_24px_80px_-24px_rgba(182,22,22,0.85)]"
          >
            <p id={`fast-action-error-title-${userId}`} className="text-base font-semibold">Action blocked</p>
            <p className="mt-2 text-sm text-white/80">{error}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded-full bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_32px_-18px_rgba(182,22,22,0.9)]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {promoOffer ? (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`fast-promo-title-${userId}`}
            className="w-full max-w-sm rounded-2xl border border-[var(--brand,#b61616)]/45 bg-[#131622] p-5 text-white shadow-[0_24px_80px_-24px_rgba(182,22,22,0.85)]"
          >
            <p id={`fast-promo-title-${userId}`} className="text-base font-semibold">Staying for the next class?</p>
            <p className="mt-2 text-sm text-white/80">{promoOffer.linkedCourseTitle}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={acceptPromo}
                disabled={busy}
                className="rounded-md bg-[var(--brand,#b61616)] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_24px_-14px_rgba(182,22,22,0.95)] transition hover:bg-[var(--brand,#b61616)]/90 disabled:opacity-50"
              >
                Yes, add promo
              </button>
              <button
                type="button"
                onClick={declinePromo}
                disabled={busy}
                className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 disabled:opacity-50"
              >
                No, only first class
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
