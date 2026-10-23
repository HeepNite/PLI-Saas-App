"use client"

import React from "react"
import type { PaymentRow } from "@/components/front/staff/staffAdminTypes"

type VerifyResolutionControlProps = {
  payment: PaymentRow
  formatMoney: (amountCents: number, currency?: string) => string
  onResolved: () => void | Promise<void>
}

type PendingAction = "collected" | "dismissed"

const VERIFY_REASON_LABELS: Record<string, string> = {
  card_declined: "Card declined",
  payment_failed: "Payment failed",
  checkout_expired: "Checkout expired",
  cancelled: "Cancelled",
  attempt_no_charge: "Attempt, no charge",
  in_progress: "Payment in progress",
}

const REASON_MAX_LENGTH = 300

/**
 * Manual resolution of a verify item (D4): staff confirm it was collected at the desk,
 * or dismiss it as not owed with a required reason. Resolved rows show the outcome.
 */
export function VerifyResolutionControl({ payment, formatMoney, onResolved }: VerifyResolutionControlProps) {
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null)
  const [reason, setReason] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const resolution = payment.verifyResolution
  if (resolution) {
    return (
      <p data-verify-resolution={payment.id} className="w-full text-[11px] text-white/60">
        {resolution.action === "collected"
          ? `Collected by ${resolution.byName || "staff"}`
          : `Dismissed: ${resolution.reason || "no reason"}`}
      </p>
    )
  }
  if (payment.verify !== true) return null

  const amountLabel = formatMoney(payment.amount, payment.currency)
  const reasonLabel = VERIFY_REASON_LABELS[payment.verifyReason || ""] || "Verify"
  const trimmedReason = reason.trim()
  const canConfirm = !busy && (pendingAction !== "dismissed" || trimmedReason.length > 0)

  const close = () => {
    setPendingAction(null)
    setReason("")
    setError(null)
  }

  const confirm = async () => {
    if (!pendingAction || !canConfirm) return
    setBusy(true)
    setError(null)
    try {
      const body = pendingAction === "dismissed"
        ? { action: "verify_dismissed", reason: trimmedReason }
        : { action: "verify_collected" }
      const response = await fetch(`/api/staff/payments/${encodeURIComponent(payment.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Unable to resolve this verify item.")
      close()
      await onResolved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to resolve this verify item.")
    } finally {
      setBusy(false)
    }
  }

  const actionButtonClass =
    "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"

  return (
    <div data-verify-item={payment.id} className="w-full space-y-1.5 text-[11px] text-yellow-200">
      <p className="flex items-center justify-between gap-2">
        <span className="truncate">{payment.courseTitle || "Payment"} · {reasonLabel}</span>
        <span className="font-semibold">{amountLabel}</span>
      </p>
      {payment.verifyReason === "in_progress" ? (
        // The card process has not ended; resolving now could collect twice once Stripe finishes.
        <p className="text-right text-white/60">Payment in progress — wait for the result</p>
      ) : pendingAction ? (
        <div role="dialog" aria-label="Resolve verify item" className="space-y-2 rounded-lg border border-yellow-400/30 bg-black/40 p-2">
          <p className="text-white/85">
            {pendingAction === "collected"
              ? `Confirm ${amountLabel} was collected at the desk?`
              : `Dismiss ${amountLabel} as not owed?`}
          </p>
          {pendingAction === "dismissed" ? (
            <textarea
              aria-label="Dismiss reason"
              value={reason}
              maxLength={REASON_MAX_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason (required)"
              rows={2}
              className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-yellow-300/60"
            />
          ) : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} disabled={busy} className={`${actionButtonClass} border-white/20 text-white/75`}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={!canConfirm}
              className={`${actionButtonClass} border-yellow-300/60 bg-yellow-400/20 text-yellow-100`}
            >
              Confirm
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPendingAction("collected")}
            className={`${actionButtonClass} border-emerald-300/50 text-emerald-200`}
          >
            Collected
          </button>
          <button
            type="button"
            onClick={() => setPendingAction("dismissed")}
            className={`${actionButtonClass} border-white/25 text-white/75`}
          >
            Dismiss
          </button>
        </div>
      )}
      {error ? <p role="alert" className="text-red-300">{error}</p> : null}
    </div>
  )
}
