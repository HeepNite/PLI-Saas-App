"use client"

import React from "react"
import type { ProfileHeritagePin } from "@/components/front/staff/historyCardAggregates"

type HeritagePinDeliveryControlProps = {
  userId: string
  heritagePin: ProfileHeritagePin | null | undefined
  canDeliver: boolean
  onDelivered: () => void | Promise<void>
}

const countryCodeToFlag = (countryCode: string) =>
  countryCode
    .trim()
    .toUpperCase()
    .replace(/./g, (character) => String.fromCodePoint(127397 + character.charCodeAt(0)))

export function HeritagePinDeliveryControl({
  userId,
  heritagePin,
  canDeliver,
  onDelivered,
}: HeritagePinDeliveryControlProps) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!heritagePin) return null

  const isPending = heritagePin.status === "pending"
  const actionLabel = `Mark ${heritagePin.countryName} pin delivered`
  const statusLabel = `${heritagePin.countryName} Heritage pin ${isPending ? "pending" : "delivered"}`
  const flag = countryCodeToFlag(heritagePin.countryCode)

  const markDelivered = async () => {
    if (busy || !isPending || !canDeliver) return
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

  const flagPinClasses = `flex h-7 w-9 items-center justify-center bg-transparent text-3xl leading-none drop-shadow-[0_5px_5px_rgba(0,0,0,0.65)] transition-transform ${
    isPending
      ? "grayscale opacity-[0.65] hover:scale-110 focus:scale-110"
      : "hover:scale-110"
  }`

  return (
    <div className="group absolute -right-2 -top-2 z-20">
      {isPending && canDeliver ? (
        <button
          type="button"
          data-pin-shape="flag"
          aria-label={busy ? `Marking ${heritagePin.countryName} pin delivered` : actionLabel}
          disabled={busy}
          onClick={() => void markDelivered()}
          className={`${flagPinClasses} cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60`}
        >
          <span aria-hidden="true">{flag}</span>
        </button>
      ) : (
        <span data-pin-shape="flag" aria-label={statusLabel} role="img" className={flagPinClasses}>
          <span aria-hidden="true">{flag}</span>
        </span>
      )}

      <span className="pointer-events-none absolute left-1/2 top-full mt-1 w-max max-w-44 -translate-x-1/2 rounded-md border border-white/15 bg-[#131622]/95 px-2 py-1 text-center text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {isPending ? (canDeliver ? actionLabel : `${heritagePin.countryName} pin pending`) : `${heritagePin.countryName} pin delivered`}
      </span>
      {error ? (
        <p role="alert" className="absolute left-1/2 top-full mt-8 w-52 -translate-x-1/2 rounded-md bg-red-950/95 px-2 py-1 text-center text-[10px] text-red-200 shadow-lg">
          {error}
        </p>
      ) : null}
    </div>
  )
}
