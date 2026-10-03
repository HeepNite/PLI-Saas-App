"use client"

import React from "react"
import type { ProfileHeritagePin } from "@/components/front/staff/historyCardAggregates"

type HeritagePinDeliveryControlProps = {
  userId: string
  heritagePin: ProfileHeritagePin | null | undefined
  canDeliver: boolean
  onDelivered: () => void | Promise<void>
}

export function HeritagePinDeliveryControl({
  userId,
  heritagePin,
  canDeliver,
  onDelivered,
}: HeritagePinDeliveryControlProps) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!canDeliver || heritagePin?.status !== "pending") return null

  const markDelivered = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/staff/students/${encodeURIComponent(userId)}/heritage-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseId: heritagePin.sourcePurchaseId }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || "Unable to mark the country pin delivered.")
      await onDelivered()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to mark the country pin delivered.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => void markDelivered()}
        className="w-full rounded-md border border-[var(--brand,#b61616)]/45 bg-[var(--brand,#b61616)]/12 px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand,#b61616)]/20 disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "Marking pin delivered…" : `Mark ${heritagePin.countryName} pin delivered`}
      </button>
      {error ? <p role="alert" className="mt-1.5 text-xs text-red-300">{error}</p> : null}
    </div>
  )
}
